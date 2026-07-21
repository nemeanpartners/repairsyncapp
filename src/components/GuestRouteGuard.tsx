import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../providers/AuthProvider";
import { toast } from "sonner";

export function GuestRouteGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  
  if (user?.isAnonymous) {
    toast.error("Guest accounts cannot access this page.");
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
}
