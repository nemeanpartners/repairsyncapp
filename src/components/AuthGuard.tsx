import React from "react";
import { auth } from "../firebase";
import { GoogleAuthProvider, signInWithPopup, signInWithRedirect } from "firebase/auth";
import { toast } from "sonner";
import { PublicLandingPage } from "../pages/PublicLandingPage";
import { useAuth } from "../providers/AuthProvider";
import { SubscriptionRequired } from "./SubscriptionRequired";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    try {
      if (isMobile) {
        await signInWithRedirect(auth, provider);
      } else {
        await signInWithPopup(auth, provider);
        toast.success("Logged in successfully");
      }
    } catch (error: any) {
      console.error(error);
      if (
        error.code === "auth/popup-blocked" ||
        error.message?.includes("popup")
      ) {
        toast.loading("Popup blocked, attempting redirect...", { duration: 2000 });
        await signInWithRedirect(auth, provider);
      } else {
        toast.error("Login failed. Please check your browser settings.");
      }
    }
  };

  const handleGuestLogin = async () => {
    try {
      const { signInAnonymously } = await import("firebase/auth");
      await signInAnonymously(auth);
      toast.success("Logged in as Guest");
    } catch (error) {
      console.error(error);
      toast.error("Guest login failed.");
    }
  };

  if (loading) {
    return <div className="h-screen w-full flex items-center justify-center bg-[#09090b] text-zinc-500">Authenticating...</div>;
  }

  if (!user) {
    return <PublicLandingPage onLogin={handleLogin} onGuestLogin={handleGuestLogin} />;
  }

  if (!user.isAnonymous && profile && profile.hasAccess === false) {
    // Show restricted access screen
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-[#09090b] text-zinc-500 gap-6">
        <div className="text-center">
            <h1 className="text-2xl font-black tracking-tight text-white mb-2">RepairSync restricted</h1>
            <p className="text-sm font-medium text-zinc-400">Authenticated base complete. No active access allocated for this account.</p>
        </div>
        <button 
           onClick={handleLogin}
           className="px-6 py-3 bg-zinc-900 text-white rounded-xl shadow-lg border border-zinc-800 hover:bg-zinc-800 font-bold tracking-tight text-sm flex items-center gap-3 transition-colors active:scale-95 cursor-pointer"
        >
           Switch Google Account
        </button>
      </div>
    );
  }

  if (!user.isAnonymous && profile && !profile.subscriptionActive) {
    return <SubscriptionRequired />;
  }

  return <>{children}</>;
}
