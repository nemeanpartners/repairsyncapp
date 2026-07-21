import React from 'react';
import { ShieldAlert } from "lucide-react";

export const Logo = ({ className = "w-10 h-10" }: { className?: string }) => {
  return (
    <ShieldAlert className={className} />
  );
};
