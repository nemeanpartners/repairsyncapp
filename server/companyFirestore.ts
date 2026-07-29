import { collection, doc } from "firebase/firestore";

export const DEFAULT_COMPANY_ID =
  process.env.REPAIRSYNC_DEFAULT_COMPANY_ID || "lI9x10u1bwWLFRCWDLG1tAsk8lQ2";

export function companyCollection(db: any, collectionName: string, ...pathSegments: string[]) {
  return collection(db, "companies", DEFAULT_COMPANY_ID, collectionName, ...pathSegments);
}

export function companyDoc(db: any, collectionName: string, ...pathSegments: string[]) {
  return doc(db, "companies", DEFAULT_COMPANY_ID, collectionName, ...pathSegments);
}
