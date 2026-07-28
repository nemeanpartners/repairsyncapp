import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { apiUrl } from "../lib/apiRuntime";
import { SubscriptionInterval, SubscriptionPlan } from "../lib/billing";
import { useAuth } from "../providers/AuthProvider";
import { openExternalUrl } from "../services/native/nativeApp";
import {
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  signInWithRedirect,
} from "firebase/auth";
import { auth } from "../firebase";

type NativeIAPPurchaseResult = {
  productId: string;
  transactionId: string;
  originalTransactionId?: string | null;
  receiptData: string;
  restored?: boolean;
};

declare global {
  interface Window {
    RepairSyncIAP?: {
      isAvailable?: boolean;
      purchase: (productId: string) => boolean;
      restore: () => boolean;
    };
  }
}

const APPLE_IAP_PRODUCT_IDS: Record<
  Exclude<SubscriptionPlan, "enterprise">,
  Record<SubscriptionInterval, string>
> = {
  starter: {
    monthly:
      import.meta.env.VITE_APPLE_IAP_STARTER_MONTHLY_PRODUCT_ID ||
      "com.repairsyncios.sms.starter.monthly",
    yearly:
      import.meta.env.VITE_APPLE_IAP_STARTER_YEARLY_PRODUCT_ID ||
      "com.repairsyncios.sms.starter.yearly",
  },
  pro: {
    monthly:
      import.meta.env.VITE_APPLE_IAP_PRO_MONTHLY_PRODUCT_ID ||
      "com.repairsyncios.sms.pro.monthly",
    yearly:
      import.meta.env.VITE_APPLE_IAP_PRO_YEARLY_PRODUCT_ID ||
      "com.repairsyncios.sms.pro.yearly",
  },
};

const PLAN_COPY: Record<
  SubscriptionPlan,
  {
    name: string;
    monthly: string;
    yearly: string;
    features: string[];
    recommended?: boolean;
  }
> = {
  starter: {
    name: "Starter",
    monthly: "$49",
    yearly: "$39",
    features: [
      "1 workshop",
      "Core CRM + tickets",
      "SMS workflows",
      "Customer portal",
    ],
  },
  pro: {
    name: "Professional",
    monthly: "$99",
    yearly: "$79",
    recommended: true,
    features: [
      "Everything in Starter",
      "Technician workflows",
      "Advanced reporting",
      "Priority support",
    ],
  },
  enterprise: {
    name: "Enterprise",
    monthly: "Custom",
    yearly: "Custom",
    features: [
      "Multi-site rollout",
      "Custom integrations",
      "Advanced controls",
      "Dedicated onboarding",
    ],
  },
};

export function PaymentsPage() {
  const { user, profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [interval, setInterval] = useState<SubscriptionInterval>(
    searchParams.get("interval") === "monthly" ? "monthly" : "yearly",
  );
  const [loadingPlan, setLoadingPlan] = useState<SubscriptionPlan | null>(null);
  const [canUseAppleIAP, setCanUseAppleIAP] = useState(false);

  const selectedPlan = useMemo<SubscriptionPlan>(() => {
    const requested = searchParams.get("plan");
    if (requested === "starter" || requested === "enterprise") return requested;
    return "pro";
  }, [searchParams]);

  useEffect(() => {
    const detectAppleIAP = () => {
      setCanUseAppleIAP(Boolean(window.RepairSyncIAP?.isAvailable));
    };

    detectAppleIAP();
    const timer = window.setInterval(detectAppleIAP, 500);
    window.setTimeout(detectAppleIAP, 1500);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!canUseAppleIAP || !user || user.isAnonymous) return;

    const handleRestoredPurchase = (event: CustomEvent<NativeIAPPurchaseResult>) => {
      if (!event.detail.restored) return;
      void completeApplePurchase(event.detail, user.uid, user.email || null, true).catch(
        (error: any) => {
          toast.error(
            error?.response?.data?.error ||
              error?.message ||
              "Unable to restore Apple subscription.",
          );
        },
      );
    };

    window.addEventListener(
      "RepairSyncIAPPurchaseCompleted",
      handleRestoredPurchase as EventListener,
    );
    return () => {
      window.removeEventListener(
        "RepairSyncIAPPurchaseCompleted",
        handleRestoredPurchase as EventListener,
      );
    };
  }, [canUseAppleIAP, user]);

  const completeApplePurchase = async (
    purchase: NativeIAPPurchaseResult,
    uid: string,
    email: string | null,
    restored = false,
  ) => {
    const response = await axios.post(apiUrl("/api/billing/apple/complete"), {
      uid,
      email,
      productId: purchase.productId,
      transactionId: purchase.transactionId,
      originalTransactionId: purchase.originalTransactionId || null,
      receiptData: purchase.receiptData,
      restored,
    });

    if (!response.data?.subscriptionActive) {
      throw new Error("Apple purchase was not activated.");
    }

    toast.success(restored ? "Apple subscription restored." : "Apple subscription activated.");
    window.setTimeout(() => window.location.reload(), 800);
  };

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    await signInForCheckout(provider);
  };

  const handleAppleLogin = async () => {
    const provider = new OAuthProvider("apple.com");
    provider.addScope("email");
    provider.addScope("name");
    await signInForCheckout(provider);
  };

  const signInForCheckout = async (provider: GoogleAuthProvider | OAuthProvider) => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    try {
      if (isMobile) {
        await signInWithRedirect(auth, provider);
      } else {
        await signInWithPopup(auth, provider);
      }
    } catch (error: any) {
      toast.error(error?.message || "Unable to sign in.");
    }
  };

  const startCheckout = async (plan: SubscriptionPlan) => {
    let currentUser = user;
    if (!currentUser || currentUser.isAnonymous) {
      toast.error("Sign in before starting your subscription.");
      return;
    }

    if (plan === "enterprise") {
      toast.info(
        "Enterprise billing is currently configured as a manual sales flow.",
      );
      setLoadingPlan(null);
      return;
    }

    setLoadingPlan(plan);
    try {
      if (canUseAppleIAP) {
        const productId = APPLE_IAP_PRODUCT_IDS[plan][interval];
        const purchase = await purchaseWithApple(productId);
        await completeApplePurchase(
          purchase,
          currentUser.uid,
          currentUser.email || null,
          purchase.restored || false,
        );
        return;
      }

      const response = await axios.post(
        apiUrl("/api/billing/checkout-session"),
        {
          plan,
          interval,
          uid: currentUser.uid,
          email: currentUser.email || null,
          returnToApp: true,
        },
      );

      const checkoutUrl = response.data?.url;
      if (!checkoutUrl) {
        throw new Error("Stripe checkout URL was not returned.");
      }

      openExternalUrl(checkoutUrl);
    } catch (error: any) {
      toast.error(
        error?.response?.data?.error ||
          error?.message ||
          "Unable to start checkout.",
      );
    } finally {
      setLoadingPlan(null);
    }
  };

  const purchaseWithApple = (productId: string) =>
    new Promise<NativeIAPPurchaseResult>((resolve, reject) => {
      const iap = window.RepairSyncIAP;
      if (!iap?.purchase) {
        reject(new Error("Apple in-app purchases are not available in this app build."));
        return;
      }

      let completed = false;
      const cleanup = () => {
        window.removeEventListener("RepairSyncIAPPurchaseCompleted", handleCompleted as EventListener);
        window.removeEventListener("RepairSyncIAPPurchaseFailed", handleFailed as EventListener);
        window.clearTimeout(timeout);
      };

      const handleCompleted = (event: CustomEvent<NativeIAPPurchaseResult>) => {
        if (event.detail.productId !== productId || completed) return;
        completed = true;
        cleanup();
        resolve(event.detail);
      };

      const handleFailed = (event: CustomEvent<{ productId?: string; message?: string }>) => {
        if (event.detail.productId && event.detail.productId !== productId) return;
        if (completed) return;
        completed = true;
        cleanup();
        reject(new Error(event.detail.message || "Apple purchase failed."));
      };

      const timeout = window.setTimeout(() => {
        if (completed) return;
        completed = true;
        cleanup();
        reject(new Error("Apple purchase timed out."));
      }, 180000);

      window.addEventListener("RepairSyncIAPPurchaseCompleted", handleCompleted as EventListener);
      window.addEventListener("RepairSyncIAPPurchaseFailed", handleFailed as EventListener);

      const started = iap.purchase(productId);
      if (!started) {
        completed = true;
        cleanup();
        reject(new Error("Apple purchase could not be started."));
      }
    });

  const restoreApplePurchase = () => {
    const iap = window.RepairSyncIAP;
    if (!iap?.restore) {
      toast.error("Apple restore is not available in this app build.");
      return;
    }
    if (!user || user.isAnonymous) {
      toast.error("Sign in before restoring an Apple purchase.");
      return;
    }
    const started = iap.restore();
    if (started) {
      toast.info("Checking for Apple purchases to restore.");
    } else {
      toast.error("Unable to start Apple purchase restore.");
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 px-6 pt-[calc(2.5rem+env(safe-area-inset-top))] pb-[calc(2.5rem+env(safe-area-inset-bottom))] md:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-10">
          <div>
            <p className="text-[11px] font-black tracking-[0.2em] uppercase text-emerald-400 mb-2">
              RepairSync Payments
            </p>
            <h1 className="text-3xl md:text-5xl font-black tracking-tight">
              Activate your workspace subscription
            </h1>
            <p className="text-sm text-zinc-400 mt-3 max-w-2xl">
              On iPhone, subscriptions use Apple in-app purchase. Other
              platforms use Stripe checkout and return you to RepairSync after
              activation.
            </p>
          </div>
          {canUseAppleIAP ? (
            <button
              type="button"
              onClick={restoreApplePurchase}
              className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-bold text-zinc-200 hover:bg-zinc-900"
            >
              Restore Apple Purchase
            </button>
          ) : null}
        </div>

        <div className="mb-8 flex items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-950 p-2 w-fit">
          <button
            onClick={() => {
              setInterval("monthly");
              setSearchParams({ plan: selectedPlan, interval: "monthly" });
            }}
            className={`px-4 py-2 rounded-xl text-sm font-bold ${interval === "monthly" ? "bg-zinc-100 text-zinc-900" : "text-zinc-400"}`}
          >
            Monthly
          </button>
          <button
            onClick={() => {
              setInterval("yearly");
              setSearchParams({ plan: selectedPlan, interval: "yearly" });
            }}
            className={`px-4 py-2 rounded-xl text-sm font-bold ${interval === "yearly" ? "bg-zinc-100 text-zinc-900" : "text-zinc-400"}`}
          >
            Yearly
          </button>
        </div>

        {!user || user.isAnonymous ? (
          <div className="mb-8 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-6">
            <h2 className="text-lg font-bold text-white mb-0">
              Sign in required before checkout
            </h2>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleGoogleLogin}
                className="rounded-xl bg-zinc-100 px-4 py-2 text-sm font-bold text-zinc-950 hover:bg-white"
              >
                Continue with Google
              </button>
              <button
                type="button"
                onClick={handleAppleLogin}
                className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-zinc-950 hover:bg-zinc-100"
              >
                Continue with Apple
              </button>
            </div>
          </div>
        ) : null}

        {profile?.subscriptionActive ? (
          <div className="mb-8 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-6 flex items-start gap-4">
            <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <h2 className="text-lg font-bold text-white">
                Subscription already active
              </h2>
              <p className="text-sm text-zinc-300 mt-1">
                This account already has active access. You can return to the
                app now.
              </p>
            </div>
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-3">
          {(["starter", "pro", "enterprise"] as SubscriptionPlan[]).map(
            (plan) => {
              const copy = PLAN_COPY[plan];
              const isSelected = selectedPlan === plan;
              return (
                <div
                  key={plan}
                  className={`rounded-2xl border p-6 bg-zinc-950 ${copy.recommended ? "border-emerald-500/40 shadow-[0_0_0_1px_rgba(16,185,129,0.1)]" : "border-zinc-800"} ${isSelected ? "ring-1 ring-zinc-500/50" : ""}`}
                >
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h2 className="text-xl font-black text-white">
                        {copy.name}
                      </h2>
                      <p className="text-sm text-zinc-400 mt-1">
                        {interval === "yearly" ? copy.yearly : copy.monthly}
                        {plan !== "enterprise" ? (
                          <span className="text-zinc-500"> / month</span>
                        ) : null}
                      </p>
                    </div>
                    {copy.recommended ? (
                      <span className="text-xs uppercase font-semibold tracking-[0.2em] text-emerald-300">
                        Recommended
                      </span>
                    ) : null}
                  </div>

                  <div className="space-y-3 mb-6">
                    {copy.features.map((feature) => (
                      <div
                        key={feature}
                        className="flex items-center gap-3 text-sm text-zinc-300"
                      >
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => {
                      setSearchParams({ plan, interval });
                      void startCheckout(plan);
                    }}
                    disabled={
                      loadingPlan === plan || !!profile?.subscriptionActive
                    }
                    className={`w-full rounded-2xl px-4 py-3 text-sm font-black transition-colors flex items-center justify-center gap-2 ${
                      copy.recommended
                        ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                        : "bg-zinc-100 hover:bg-white text-zinc-900"
                    } disabled:opacity-60`}
                  >
                    {loadingPlan === plan ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : plan === "enterprise" ? (
                      <ExternalLink className="w-4 h-4" />
                    ) : (
                      <CreditCard className="w-4 h-4" />
                    )}
                    {plan === "enterprise"
                      ? "Contact Sales"
                      : canUseAppleIAP
                        ? "Subscribe with Apple"
                        : "Get Subscription Now"}
                  </button>
                </div>
              );
            },
          )}
        </div>
      </div>
    </div>
  );
}
