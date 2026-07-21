import React from "react";
import { AlertTriangle, ArrowRight } from "lucide-react";

export function DemoModeBanner({ onSignUp }: { onSignUp?: () => void }) {
  return (
    <div className="bg-amber-100 border-b border-amber-200 px-4 py-2 flex items-center justify-between text-sm flex-wrap gap-2 z-50 relative">
      <div className="flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
        <span className="font-semibold text-amber-900">
          Demo Mode — You are viewing sample data only. Features like SMS dispatch and exports are disabled.
        </span>
      </div>
      {onSignUp && (
        <button
          onClick={onSignUp}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg transition-colors text-xs shadow-sm"
        >
          Book Demo / Sign In <ArrowRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
