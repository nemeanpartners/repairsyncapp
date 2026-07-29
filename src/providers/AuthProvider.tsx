import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User, signOut as firebaseSignOut } from "firebase/auth";
import { auth, authPersistenceReady, db } from "../firebase";
import axios from "axios";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { buildDefaultBillingProfile, UserBillingProfile } from "../lib/billing";
import { companyRootDoc, setActiveCompanyId } from "../lib/companyFirestore";

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
      setActiveCompanyId("demo");
      setProfile({
        ...buildDefaultBillingProfile(currentUser.metadata.creationTime),
        companyId: "demo",
        companyName: "RepairSync Demo",
      });
      return;
    }

    const userRef = doc(db, "users", currentUser.uid);
    const snapshot = await getDoc(userRef);
    const fallbackCompanyId = `company_${currentUser.uid}`;

    if (!snapshot.exists()) {
      const defaultProfile = buildDefaultBillingProfile(currentUser.metadata.creationTime);
      const companyName = currentUser.displayName || "New Repair Business";
      const profile = {
        ...defaultProfile,
        companyId: fallbackCompanyId,
        companyName,
      };
      await setDoc(
        userRef,
        {
          uid: currentUser.uid,
          email: currentUser.email || null,
          displayName: currentUser.displayName || null,
          photoURL: currentUser.photoURL || null,
          companyId: fallbackCompanyId,
          companyName,
          role: "admin",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          ...profile,
        },
        { merge: true },
      );
      setActiveCompanyId(fallbackCompanyId);
      await setDoc(companyRootDoc(fallbackCompanyId), {
        companyName,
        ownerUid: currentUser.uid,
        ownerEmail: currentUser.email || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setProfile(profile);
      return;
    }

    const data = snapshot.data() || {};
    const defaultProfile = buildDefaultBillingProfile(currentUser.metadata.creationTime);
    const companyId = data.companyId || data.company_id || data.organizationId || fallbackCompanyId;
    const companyName = data.companyName || data.businessName || null;
    const normalizedProfile: UserBillingProfile = {
      companyId,
      companyName,
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
      data.subscriptionGrandfathered === undefined ||
      data.companyId === undefined;

    if (needsBackfill) {
      await setDoc(
        userRef,
        {
          updatedAt: serverTimestamp(),
          companyId,
          companyName,
          ...normalizedProfile,
        },
        { merge: true },
      );
    }

    setActiveCompanyId(companyId);
    await setDoc(companyRootDoc(companyId), {
      companyName: companyName || "New Repair Business",
      updatedAt: serverTimestamp(),
    }, { merge: true }).catch((error) => {
      console.warn("Failed to ensure company document", error);
    });
    setProfile(normalizedProfile);
  };

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    
    authPersistenceReady.finally(() => {
      if (cancelled) {
        return;
      }

      unsubscribe = onAuthStateChanged(auth, async (user) => {
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

    });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
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
      {loading ? (
        <div className="flex min-h-screen w-full items-center justify-center bg-white text-zinc-600">
          <div className="flex flex-col items-center gap-4">
            <div className="h-9 w-9 animate-spin rounded-full border-4 border-zinc-200 border-t-zinc-900" />
            <div className="text-sm font-semibold tracking-wide">Loading RepairSync...</div>
          </div>
        </div>
      ) : children}
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
