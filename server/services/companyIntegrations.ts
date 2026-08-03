import { doc, getDoc } from "firebase/firestore";
import { sanitizeCompanyId } from "../companyFirestore.js";

export type CompanyIntegrationConfig = {
  companyId: string;
  mobileMessageEnabled: boolean;
  mobileMessageUsername: string;
  mobileMessagePassword: string;
  mobileMessageSenderId: string;
  smsRelayEnabled: boolean;
  repairShoprSubdomain: string;
  repairShoprApiKey: string;
  maxotelEnabled: boolean;
  maxotelApiKey: string;
  maxotelPhoneNumber: string;
};

export class ProfessionalSubscriptionRequiredError extends Error {
  status = 402;

  constructor() {
    super("Professional subscription required to connect SMS and phone integrations. Switch subscriptions in Settings to enable this feature.");
  }
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isProfessionalPlan(data: Record<string, unknown> | undefined) {
  return Boolean(data?.subscriptionActive) && (data?.subscriptionPlan === "pro" || data?.subscriptionPlan === "enterprise");
}

export async function companyHasProfessionalAccess(db: any, companyId: string, userId?: string | null) {
  const safeCompanyId = sanitizeCompanyId(companyId);
  const companySnap = await getDoc(doc(db, "companies", safeCompanyId)).catch(() => null);
  if (companySnap?.exists() && isProfessionalPlan(companySnap.data())) return true;

  if (userId) {
    const userSnap = await getDoc(doc(db, "users", String(userId))).catch(() => null);
    if (userSnap?.exists() && isProfessionalPlan(userSnap.data())) return true;
  }

  return false;
}

export async function getCompanyIntegrationConfig(db: any, companyId: string | null | undefined, userId?: string | null): Promise<CompanyIntegrationConfig> {
  const safeCompanyId = sanitizeCompanyId(companyId);
  const settingsSnap = await getDoc(doc(db, "companies", safeCompanyId, "settings", "integrations")).catch(() => null);
  const settings = settingsSnap?.exists() ? settingsSnap.data() : {};
  const hasCompanyCredentials = Boolean(
    asString(settings.mobileMessageUsername) ||
      asString(settings.mobileMessagePassword) ||
      asString(settings.repairShoprApiKey) ||
      asString(settings.maxotelApiKey),
  );

  if (hasCompanyCredentials && !(await companyHasProfessionalAccess(db, safeCompanyId, userId))) {
    throw new ProfessionalSubscriptionRequiredError();
  }

  return {
    companyId: safeCompanyId,
    mobileMessageEnabled: Boolean(settings.mobileMessageEnabled),
    mobileMessageUsername: asString(settings.mobileMessageUsername),
    mobileMessagePassword: asString(settings.mobileMessagePassword),
    mobileMessageSenderId: asString(settings.mobileMessageSenderId),
    smsRelayEnabled: Boolean(settings.smsRelayEnabled),
    repairShoprSubdomain: asString(settings.repairShoprSubdomain),
    repairShoprApiKey: asString(settings.repairShoprApiKey),
    maxotelEnabled: Boolean(settings.maxotelEnabled),
    maxotelApiKey: asString(settings.maxotelApiKey),
    maxotelPhoneNumber: asString(settings.maxotelPhoneNumber),
  };
}
