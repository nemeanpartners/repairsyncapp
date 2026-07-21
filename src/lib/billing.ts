export const SUBSCRIPTION_GRANDFATHER_CUTOFF_ISO =
  import.meta.env.VITE_SUBSCRIPTION_GRANDFATHER_CUTOFF ||
  "2026-06-12T00:00:00.000Z";

export type SubscriptionInterval = "monthly" | "yearly";
export type SubscriptionPlan = "starter" | "pro" | "enterprise";

export type AppSubscriptionStatus =
  | "active"
  | "inactive"
  | "trialing"
  | "past_due"
  | "canceled"
  | "grandfathered";

export interface UserBillingProfile {
  hasAccess: boolean;
  billingRequired: boolean;
  subscriptionActive: boolean;
  subscriptionStatus: AppSubscriptionStatus;
  subscriptionPlan: SubscriptionPlan | null;
  subscriptionInterval: SubscriptionInterval | null;
  subscriptionSource: "stripe" | "grandfathered" | "manual" | null;
  subscriptionGrandfathered: boolean;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  subscriptionCurrentPeriodEnd: string | null;
  subscriptionCheckoutCompletedAt: string | null;
}

export function isGrandfatheredCreationTime(creationTime?: string | null) {
  if (!creationTime) return false;
  const created = Date.parse(creationTime);
  const cutoff = Date.parse(SUBSCRIPTION_GRANDFATHER_CUTOFF_ISO);
  if (Number.isNaN(created) || Number.isNaN(cutoff)) return false;
  return created < cutoff;
}

export function buildDefaultBillingProfile(creationTime?: string | null): UserBillingProfile {
  const grandfathered = isGrandfatheredCreationTime(creationTime);
  return {
    hasAccess: true,
    billingRequired: !grandfathered,
    subscriptionActive: grandfathered,
    subscriptionStatus: grandfathered ? "grandfathered" : "inactive",
    subscriptionPlan: null,
    subscriptionInterval: null,
    subscriptionSource: grandfathered ? "grandfathered" : null,
    subscriptionGrandfathered: grandfathered,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    subscriptionCurrentPeriodEnd: null,
    subscriptionCheckoutCompletedAt: null,
  };
}

export function deepLinkToApp(path: string) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `repairsync://${normalized.replace(/^\//, "")}`;
}
