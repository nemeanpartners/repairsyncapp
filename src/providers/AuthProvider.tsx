import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User, signOut as firebaseSignOut } from "firebase/auth";
import { auth, db } from "../firebase";
import axios from "axios";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { buildDefaultBillingProfile, UserBillingProfile } from "../lib/billing";

interface AuthContextType {
  user: User | null;
  profile: UserBillingProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserBillingProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const syncUserProfile = async (currentUser: User) => {
    if (currentUser.isAnonymous) {
      setProfile(buildDefaultBillingProfile(currentUser.metadata.creationTime));
      return;
    }

    const userRef = doc(db, "users", currentUser.uid);
    const snapshot = await getDoc(userRef);

    if (!snapshot.exists()) {
      const defaultProfile = buildDefaultBillingProfile(currentUser.metadata.creationTime);
      await setDoc(
        userRef,
        {
          email: currentUser.email || null,
          displayName: currentUser.displayName || null,
          photoURL: currentUser.photoURL || null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          ...defaultProfile,
        },
        { merge: true },
      );
      setProfile(defaultProfile);
      return;
    }

    const data = snapshot.data() || {};
    const defaultProfile = buildDefaultBillingProfile(currentUser.metadata.creationTime);
    const normalizedProfile: UserBillingProfile = {
      hasAccess: data.hasAccess !== false,
      billingRequired:
        typeof data.billingRequired === "boolean"
          ? data.billingRequired
          : defaultProfile.billingRequired,
      subscriptionActive:
        typeof data.subscriptionActive === "boolean"
          ? data.subscriptionActive
          : defaultProfile.subscriptionActive,
      subscriptionStatus: data.subscriptionStatus || defaultProfile.subscriptionStatus,
      subscriptionPlan: data.subscriptionPlan || null,
      subscriptionInterval: data.subscriptionInterval || null,
      subscriptionSource: data.subscriptionSource || defaultProfile.subscriptionSource,
      subscriptionGrandfathered:
        typeof data.subscriptionGrandfathered === "boolean"
          ? data.subscriptionGrandfathered
          : defaultProfile.subscriptionGrandfathered,
      stripeCustomerId: data.stripeCustomerId || null,
      stripeSubscriptionId: data.stripeSubscriptionId || null,
      subscriptionCurrentPeriodEnd: data.subscriptionCurrentPeriodEnd || null,
      subscriptionCheckoutCompletedAt: data.subscriptionCheckoutCompletedAt || null,
    };

    const needsBackfill =
      data.billingRequired === undefined ||
      data.subscriptionActive === undefined ||
      data.subscriptionStatus === undefined ||
      data.subscriptionGrandfathered === undefined;

    if (needsBackfill) {
      await setDoc(
        userRef,
        {
          updatedAt: serverTimestamp(),
          ...normalizedProfile,
        },
        { merge: true },
      );
    }

    setProfile(normalizedProfile);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      
      // Update axios default headers globally
      if (user) {
        axios.defaults.headers.common['x-user-id'] = user.uid;
        if (user.email) {
          axios.defaults.headers.common["x-user-email"] = user.email;
        } else {
          delete axios.defaults.headers.common["x-user-email"];
        }
        if (user.isAnonymous) {
          axios.defaults.headers.common['x-is-guest'] = 'true';
        } else {
          delete axios.defaults.headers.common['x-is-guest'];
        }
        try {
          await syncUserProfile(user);
        } catch (error) {
          console.error("Failed to sync user billing profile", error);
          setProfile(null);
        }
      } else {
        delete axios.defaults.headers.common['x-user-id'];
        delete axios.defaults.headers.common["x-user-email"];
        delete axios.defaults.headers.common['x-is-guest'];
        setProfile(null);
      }
      
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  const refreshProfile = async () => {
    if (!auth.currentUser) {
      setProfile(null);
      return;
    }
    await syncUserProfile(auth.currentUser);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, refreshProfile }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
