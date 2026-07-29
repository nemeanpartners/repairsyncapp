import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User, signOut as firebaseSignOut } from "firebase/auth";
import { auth, authPersistenceReady, db } from "../firebase";
import axios from "axios";
import { collectionGroup, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { buildDefaultBillingProfile, UserBillingProfile } from "../lib/billing";
import { companyRootDoc, setActiveCompanyId } from "../lib/companyFirestore";

const PROFILE_CACHE_KEY_PREFIX = "repairsync.userProfile.";

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

  const getFallbackCompanyId = (currentUser: User) => currentUser.uid;

  const getCachedProfile = (uid: string): UserBillingProfile | null => {
    try {
      const cached = window.localStorage.getItem(`${PROFILE_CACHE_KEY_PREFIX}${uid}`);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  };

  const cacheProfile = (uid: string, nextProfile: UserBillingProfile) => {
    try {
      window.localStorage.setItem(`${PROFILE_CACHE_KEY_PREFIX}${uid}`, JSON.stringify(nextProfile));
    } catch {
      // localStorage can be unavailable in private or embedded browser contexts.
    }
  };

  const findInviteForUser = async (currentUser: User) => {
    const email = currentUser.email?.trim().toLowerCase();
    if (!email) return null;

    const inviteQuery = query(collectionGroup(db, "users"), where("email", "==", email));
    const snapshot = await getDocs(inviteQuery);
    const inviteDoc = snapshot.docs.find((candidate) => candidate.ref.path.startsWith("companies/"));
    if (!inviteDoc) return null;

    const [, companyId] = inviteDoc.ref.path.split("/");
    return {
      companyId,
      data: inviteDoc.data(),
    };
  };

  const syncUserProfile = async (currentUser: User) => {
    if (currentUser.isAnonymous) {
      const demoProfile = {
        ...buildDefaultBillingProfile(currentUser.metadata.creationTime),
        companyId: "demo",
        companyName: "RepairSync Demo",
        role: "member" as const,
        permissions: [],
      };
      setActiveCompanyId("demo");
      setProfile(demoProfile);
      cacheProfile(currentUser.uid, demoProfile);
      return;
    }

    const userRef = doc(db, "users", currentUser.uid);
    const snapshot = await getDoc(userRef);
    const fallbackCompanyId = getFallbackCompanyId(currentUser);

    if (!snapshot.exists()) {
      const invite = await findInviteForUser(currentUser);
      const defaultProfile = buildDefaultBillingProfile(currentUser.metadata.creationTime);
      const companyId = invite?.companyId || fallbackCompanyId;
      const role: UserBillingProfile["role"] =
        invite?.data?.role === "admin" ? "admin" : invite ? "tech" : "admin";
      const permissions = Array.isArray(invite?.data?.permissions)
        ? invite.data.permissions
        : role === "admin"
          ? ["admin"]
          : ["tickets", "customers", "messages", "tasks"];
      const companyName = invite?.data?.companyName || null;
      const profile = {
        ...defaultProfile,
        companyId,
        companyName,
        role,
        permissions,
        hasAccess: invite ? invite.data?.hasAccess !== false : defaultProfile.hasAccess,
      };
      await setDoc(
        userRef,
        {
          uid: currentUser.uid,
          email: currentUser.email || null,
          displayName: currentUser.displayName || null,
          photoURL: currentUser.photoURL || null,
          companyId,
          companyName,
          role,
          permissions,
          invitedBy: invite?.data?.invitedBy || null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          ...profile,
        },
        { merge: true },
      );
      setActiveCompanyId(companyId);
      await setDoc(companyRootDoc(companyId), {
        ...(companyName ? { companyName } : {}),
        ...(role === "admin" ? { ownerUid: currentUser.uid, ownerEmail: currentUser.email || null } : {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      await setDoc(companyRootDoc(companyId), {
        setupRequired: role === "admin" && !companyName,
      }, { merge: true });
      await setDoc(doc(db, "companies", companyId, "users", currentUser.uid), {
        uid: currentUser.uid,
        email: currentUser.email?.trim().toLowerCase() || null,
        displayName: currentUser.displayName || invite?.data?.displayName || null,
        role,
        permissions,
        hasAccess: profile.hasAccess,
        linkedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setProfile(profile);
      cacheProfile(currentUser.uid, profile);
      return;
    }

    const data = snapshot.data() || {};
    const defaultProfile = buildDefaultBillingProfile(currentUser.metadata.creationTime);
    const companyId = data.companyId || data.company_id || data.organizationId || fallbackCompanyId;
    const companyName = data.companyName || data.businessName || null;
    const role = data.role === "admin" ? "admin" : data.role === "tech" ? "tech" : "member";
    const permissions = Array.isArray(data.permissions)
      ? data.permissions
      : role === "admin"
        ? ["admin"]
        : ["tickets", "customers", "messages", "tasks"];
    const normalizedProfile: UserBillingProfile = {
      companyId,
      companyName,
      role,
      permissions,
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
      data.companyId === undefined ||
      data.role === undefined;

    if (needsBackfill) {
      await setDoc(
        userRef,
        {
          updatedAt: serverTimestamp(),
          companyId,
          companyName,
          role,
          permissions,
          ...normalizedProfile,
        },
        { merge: true },
      );
    }

    setActiveCompanyId(companyId);
    await setDoc(companyRootDoc(companyId), {
      ...(companyName ? { companyName } : {}),
      updatedAt: serverTimestamp(),
    }, { merge: true }).catch((error) => {
      console.warn("Failed to ensure company document", error);
    });
    setProfile(normalizedProfile);
    cacheProfile(currentUser.uid, normalizedProfile);
  };

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    
    authPersistenceReady.finally(() => {
      if (cancelled) {
        return;
      }

      unsubscribe = onAuthStateChanged(auth, async (user) => {
        // Update axios default headers globally
        if (user) {
          const immediateCompanyId = user.isAnonymous ? "demo" : getFallbackCompanyId(user);
          const cachedProfile = getCachedProfile(user.uid);

          setActiveCompanyId(cachedProfile?.companyId || immediateCompanyId);
          setUser(user);
          setProfile(cachedProfile);
          setLoading(false);

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
          void syncUserProfile(user).catch((error) => {
            console.error("Failed to sync user billing profile", error);
          });
        } else {
          setUser(null);
          setProfile(null);
          delete axios.defaults.headers.common['x-user-id'];
          delete axios.defaults.headers.common["x-user-email"];
          delete axios.defaults.headers.common['x-is-guest'];
          setLoading(false);
        }
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
