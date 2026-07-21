import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { CheckCircle2, Loader2, Smartphone } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { apiUrl } from "../lib/apiRuntime";
import { deepLinkToApp } from "../lib/billing";
import { useAuth } from "../providers/AuthProvider";
import { isNativeWrapperApp } from "../services/native/nativeApp";

type ConfirmationState = "loading" | "success" | "error";

export function PaymentSuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const [state, setState] = useState<ConfirmationState>("loading");
  const [message, setMessage] = useState("Confirming your subscription...");

  const sessionId = searchParams.get("session_id");
  const appReturnUrl = useMemo(
    () =>
      deepLinkToApp(
        `/settings?session_id=${encodeURIComponent(sessionId || "")}`,
      ),
    [sessionId],
  );

  useEffect(() => {
    let cancelled = false;

    async function syncSession() {
      if (!sessionId) {
        setState("error");
        setMessage("Stripe session ID missing from the return URL.");
        return;
      }

      try {
        const response = await axios.get(
          apiUrl(`/api/billing/checkout-session/${sessionId}`),
        );
        if (cancelled) return;

        if (response.data?.subscriptionActive) {
          await refreshProfile();
          if (cancelled) return;

          setState("success");
          setMessage(
            "Your subscription is active. Returning you to Settings...",
          );
          setTimeout(() => {
            navigate("/settings", { replace: true });
          }, 1200);
          return;
        }

        setState("error");
        setMessage(
          "Payment completed, but subscription activation has not been confirmed yet.",
        );
      } catch (error: any) {
        if (cancelled) return;
        setState("error");
        setMessage(
          error?.response?.data?.error ||
            error?.message ||
            "Unable to verify payment session.",
        );
      }
    }

    void syncSession();
    return () => {
      cancelled = true;
    };
  }, [appReturnUrl, sessionId]);

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 px-6 pt-[calc(2.5rem+env(safe-area-inset-top))] pb-[calc(2.5rem+env(safe-area-inset-bottom))] flex items-center justify-center">
      <div className="w-full max-w-xl rounded-2xl border border-zinc-800 bg-zinc-950 p-8 text-center">
        {state === "loading" ? (
          <Loader2 className="w-12 h-12 mx-auto mb-5 text-emerald-400 animate-spin" />
        ) : (
          <CheckCircle2 className="w-12 h-12 mx-auto mb-5 text-emerald-400" />
        )}
        <h1 className="text-3xl font-black tracking-tight mb-3">
          RepairSync Billing
        </h1>
        <p className="text-sm text-zinc-300 mb-6">{message}</p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => navigate("/settings")}
            className="px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-black flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            Continue to Settings
          </button>
        </div>

        {state === "error" ? (
          <p className="text-xs text-amber-300 mt-5">
            If the webhook is still processing, wait a few seconds and try
            opening the app again.
          </p>
        ) : null}
      </div>
    </div>
  );
}
