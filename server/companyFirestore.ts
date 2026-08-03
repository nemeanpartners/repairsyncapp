import { collection, doc } from "firebase/firestore";

export const DEFAULT_COMPANY_ID =
  process.env.REPAIRSYNC_DEFAULT_COMPANY_ID || "lI9x10u1bwWLFRCWDLG1tAsk8lQ2";

export function sanitizeCompanyId(companyId: string | null | undefined) {
  const cleaned = String(companyId || "").trim().replace(/[^a-zA-Z0-9_-]/g, "_");
  return cleaned || DEFAULT_COMPANY_ID;
}

export function companyCollection(db: any, collectionName: string, ...pathSegments: string[]) {
  return collection(db, "companies", DEFAULT_COMPANY_ID, collectionName, ...pathSegments);
}

export function companyDoc(db: any, collectionName: string, ...pathSegments: string[]) {
  return doc(db, "companies", DEFAULT_COMPANY_ID, collectionName, ...pathSegments);
}

export function companyCollectionForCompany(db: any, companyId: string | null | undefined, collectionName: string, ...pathSegments: string[]) {
  return collection(db, "companies", sanitizeCompanyId(companyId), collectionName, ...pathSegments);
}

export function companyDocForCompany(db: any, companyId: string | null | undefined, collectionName: string, ...pathSegments: string[]) {
  return doc(db, "companies", sanitizeCompanyId(companyId), collectionName, ...pathSegments);
}
