import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../providers/AuthProvider";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { companyDoc } from "../lib/companyFirestore";

export function AdminRouteGuard({ children }: { children: React.ReactNode }) {
  const { user, profile, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function checkAdmin() {
      if (authLoading) return;

      if (!user || user.isAnonymous) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      if (profile?.role === "admin" || profile?.permissions?.includes("admin")) {
        setIsAdmin(true);
        setLoading(false);
        return;
      }

      const emailBytes = user.email?.toLowerCase();
      if (emailBytes) {
        try {
          const { getDoc } = await import("firebase/firestore");
          const userDoc = await getDoc(companyDoc("users", user.uid));
          if (userDoc.exists() && userDoc.data().role === 'admin') {
            setIsAdmin(true);
          } else {
            setIsAdmin(false);
          }
        } catch (e: any) {
          console.error("Error fetching user role", e);
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
      setLoading(false);
    }

    checkAdmin();
  }, [authLoading, user, profile]);

  if (authLoading || loading) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center p-8 bg-zinc-50 border border-zinc-200 rounded-xl max-w-sm mx-auto mt-20 shadow-sm">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400 mb-4" />
        <p className="text-zinc-600 font-medium">Verifying access...</p>
      </div>
    );
  }

  if (isAdmin === false) {
    toast.error("You do not have permission to access the admin area.");
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
