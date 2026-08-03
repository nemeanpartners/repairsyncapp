import { doc, getDoc } from "firebase/firestore";
import fs from "fs";
import path from "path";
import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
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
  managedMessagingEnabled: boolean;
  managedMessagingAccountId: string;
  managedMessagingProvider: string;
  managedMaxotelEnabled: boolean;
};

export function getManagedIntegrationCapabilities() {
  return {
    managedMobileMessage: Boolean(process.env.REPAIRSYNC_APP_MOBILE_MESSAGE_USERNAME && process.env.REPAIRSYNC_APP_MOBILE_MESSAGE_PASSWORD),
    managedRepairShopr: Boolean(process.env.REPAIRSYNC_APP_REPAIRSHOPR_SUBDOMAIN && process.env.REPAIRSYNC_APP_REPAIRSHOPR_API_KEY),
    managedMaxotel: Boolean(process.env.REPAIRSYNC_APP_MAXOTEL_API_KEY),
  };
}

export function hasUsableMobileMessage(config: Partial<CompanyIntegrationConfig>) {
  const managed = getManagedIntegrationCapabilities();
  return Boolean(
    (asString(config.mobileMessageUsername) && asString(config.mobileMessagePassword)) ||
      (Boolean(config.managedMessagingEnabled) && asString(config.managedMessagingAccountId)) ||
      managed.managedMobileMessage,
  );
}

export function hasUsableSmsRelay(config: Partial<CompanyIntegrationConfig>) {
  const managed = getManagedIntegrationCapabilities();
  return Boolean(
    hasUsableMobileMessage(config) ||
      (asString(config.repairShoprSubdomain) && asString(config.repairShoprApiKey)) ||
      managed.managedRepairShopr,
  );
}

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

function getFirebaseConfig() {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  return JSON.parse(fs.readFileSync(configPath, "utf8"));
}

function getAdminDb() {
  const config = getFirebaseConfig();
  const app = getApps().length
    ? getApps()[0]
    : initializeApp({
        projectId: config.projectId,
        credential: applicationDefault(),
      });
  return getFirestore(app, config.firestoreDatabaseId || undefined);
}

async function readDocData(db: any, pathSegments: string[]) {
  if (typeof db?.collection === "function") {
    const [first, id, ...rest] = pathSegments;
    let ref: any = db.collection(first).doc(id);
    for (let i = 0; i < rest.length; i += 2) {
      ref = ref.collection(rest[i]).doc(rest[i + 1]);
    }
    const snap = await ref.get().catch(() => null);
    return snap?.exists ? snap.data() : undefined;
  }

  const snap = await getDoc(doc(db, ...pathSegments)).catch(() => null);
  return snap?.exists() ? snap.data() : undefined;
}

export async function companyHasProfessionalAccess(db: any, companyId: string, userId?: string | null) {
  const safeCompanyId = sanitizeCompanyId(companyId);
  const readDb = typeof db?.collection === "function" ? db : getAdminDb();
  const companyData = await readDocData(readDb, ["companies", safeCompanyId]);
  if (isProfessionalPlan(companyData)) return true;

  if (userId) {
    const userData = await readDocData(readDb, ["users", String(userId)]);
    if (isProfessionalPlan(userData)) return true;
  }

  return false;
}

export async function getCompanyIntegrationConfig(db: any, companyId: string | null | undefined, userId?: string | null): Promise<CompanyIntegrationConfig> {
  const safeCompanyId = sanitizeCompanyId(companyId);
  const readDb = typeof db?.collection === "function" ? db : getAdminDb();
  const settings = await readDocData(readDb, ["companies", safeCompanyId, "settings", "integrations"]) || {};
  const hasCompanyCredentials = Boolean(
    asString(settings.mobileMessageUsername) ||
      asString(settings.mobileMessagePassword) ||
      asString(settings.repairShoprApiKey) ||
      asString(settings.maxotelApiKey) ||
      (Boolean(settings.managedMessagingEnabled) && asString(settings.managedMessagingAccountId)) ||
      Boolean(settings.managedMaxotelEnabled),
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
    managedMessagingEnabled: Boolean(settings.managedMessagingEnabled),
    managedMessagingAccountId: asString(settings.managedMessagingAccountId),
    managedMessagingProvider: asString(settings.managedMessagingProvider),
    managedMaxotelEnabled: Boolean(settings.managedMaxotelEnabled),
  };
}
