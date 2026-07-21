import { CreditCard, LogOut, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../providers/AuthProvider";

export function SubscriptionRequired() {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-[#09090b] text-zinc-500 gap-6 px-6">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
          <ShieldCheck className="w-7 h-7 text-emerald-400" />
        </div>
        <h1 className="text-2xl font-black tracking-tight text-white mb-2">
          Subscription required
        </h1>
        <p className="text-sm font-medium text-zinc-400">
          Your account is signed in, but a RepairSync subscription has not been activated yet.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={() => navigate("/payments")}
          className="px-6 py-3 bg-emerald-600 text-white rounded-xl shadow-lg hover:bg-emerald-500 font-bold tracking-tight text-sm flex items-center justify-center gap-3 transition-colors"
        >
          <CreditCard className="w-4 h-4" />
          Get Subscription Now
        </button>
        <button
          onClick={() => void signOut()}
          className="px-6 py-3 bg-zinc-900 text-zinc-200 rounded-xl border border-zinc-800 hover:bg-zinc-800 font-bold tracking-tight text-sm flex items-center justify-center gap-3 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
}
