import React from "react";
import { useAuth } from "../../../providers/AuthProvider";
import { differenceInDays, isPast, parseISO } from "date-fns";
import {
  CreditCard,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
} from "lucide-react";

export function SubscriptionSettingsForm() {
  const { profile } = useAuth();

  if (!profile) {
    return null;
  }

  const currentPeriodEnd = profile.subscriptionCurrentPeriodEnd
    ? parseISO(profile.subscriptionCurrentPeriodEnd)
    : null;

  const isOverdue = currentPeriodEnd ? isPast(currentPeriodEnd) : false;

  let daysRemaining = null;
  if (currentPeriodEnd && !isOverdue) {
    daysRemaining = differenceInDays(currentPeriodEnd, new Date());
  }

  const navigateToPayments = () => {
    window.location.href = "/payments";
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-zinc-900">
          My RepairSync Subscription
        </h3>
        <p className="text-sm text-zinc-500">
          Manage your billing, view plan details, and update your subscription.
        </p>
      </div>

      <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="space-y-4 w-full">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">
                  Current Plan
                </p>
                <div className="flex items-center gap-2">
                  <h4 className="text-2xl font-black text-zinc-900 capitalize">
                    {profile.subscriptionPlan || "No active plan"}
                  </h4>
                  {profile.subscriptionActive ? (
                    <span className="flex items-center gap-1 bg-emerald-100 text-emerald-700 text-xs font-bold px-2.5 py-1 rounded-full">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Active
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 bg-amber-100 text-amber-700 text-xs font-bold px-2.5 py-1 rounded-full">
                      <AlertCircle className="w-3.5 h-3.5" /> Inactive
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 py-4 border-y border-zinc-100">
              <div>
                <p className="text-sm text-zinc-500 mb-1">Status</p>
                <p className="font-semibold text-zinc-900 capitalize">
                  {profile.subscriptionStatus || "None"}
                </p>
              </div>
              <div>
                <p className="text-sm text-zinc-500 mb-1">Billing Interval</p>
                <p className="font-semibold text-zinc-900 capitalize">
                  {profile.subscriptionInterval || "N/A"}
                </p>
              </div>
            </div>

            {currentPeriodEnd && (
              <div
                className={`p-4 rounded-xl flex items-start gap-3 ${isOverdue ? "bg-red-50 text-red-800" : "bg-blue-50 text-blue-800"}`}
              >
                <AlertCircle
                  className={`w-5 h-5 shrink-0 ${isOverdue ? "text-red-500" : "text-blue-500"}`}
                />
                <div>
                  <p className="font-bold">
                    {isOverdue ? "Subscription Overdue" : "Next Renewal Date"}
                  </p>
                  <p className="text-sm mt-0.5 opacity-90">
                    {isOverdue
                      ? "Your subscription has expired or payment failed. Please update your payment method to continue using RepairSync."
                      : `Your plan will automatically renew in ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} on ${currentPeriodEnd.toLocaleDateString()}.`}
                  </p>
                </div>
              </div>
            )}

            {!profile.subscriptionActive &&
              !profile.subscriptionGrandfathered && (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3 text-amber-800">
                  <AlertCircle className="w-5 h-5 shrink-0 text-amber-600" />
                  <div>
                    <p className="font-bold">Subscription Required</p>
                    <p className="text-sm mt-0.5 opacity-90">
                      You need an active subscription to use RepairSync
                      features. Please choose a plan to get started.
                    </p>
                  </div>
                </div>
              )}

            {profile.subscriptionGrandfathered && (
              <div className="p-4 rounded-xl bg-purple-50 border border-purple-200 flex items-start gap-3 text-purple-800">
                <AlertCircle className="w-5 h-5 shrink-0 text-purple-600" />
                <div>
                  <p className="font-bold">Early Adopter</p>
                  <p className="text-sm mt-0.5 opacity-90">
                    Your account has been granted legacy access and is currently
                    not billed.
                  </p>
                </div>
              </div>
            )}

            <div className="pt-2">
              <button
                onClick={navigateToPayments}
                className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 bg-zinc-900 hover:bg-zinc-800 active:scale-95 transition-all text-white rounded-xl font-bold text-sm shadow-sm"
              >
                <CreditCard className="w-4 h-4" />
                Manage Billing & Payments
                <ArrowRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
