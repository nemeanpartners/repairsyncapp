import {
  collection,
  doc,
  type CollectionReference,
  type DocumentReference,
  type Firestore,
} from "firebase/firestore";
import { db } from "../firebase";

const COMPANY_ID_STORAGE_KEY = "repairsync.activeCompanyId";
const DEFAULT_COMPANY_ID = "default";

let activeCompanyId = DEFAULT_COMPANY_ID;

function sanitizeCompanyId(companyId: string | null | undefined) {
  const cleaned = String(companyId || "").trim().replace(/[^a-zA-Z0-9_-]/g, "_");
  return cleaned || DEFAULT_COMPANY_ID;
}

export function setActiveCompanyId(companyId: string | null | undefined) {
  activeCompanyId = sanitizeCompanyId(companyId);
  try {
    window.localStorage.setItem(COMPANY_ID_STORAGE_KEY, activeCompanyId);
  } catch {
    // localStorage can be unavailable in private or embedded browser contexts.
  }
}

export function getActiveCompanyId() {
  if (activeCompanyId !== DEFAULT_COMPANY_ID) return activeCompanyId;

  try {
    const stored = window.localStorage.getItem(COMPANY_ID_STORAGE_KEY);
    if (stored) {
      activeCompanyId = sanitizeCompanyId(stored);
    }
  } catch {
    // Keep the in-memory default.
  }

  return activeCompanyId;
}

export function companyDoc(collectionName: string, ...pathSegments: string[]): DocumentReference {
  return doc(db, "companies", getActiveCompanyId(), collectionName, ...pathSegments);
}

export function companyCollection(collectionName: string, ...pathSegments: string[]): CollectionReference {
  return collection(db, "companies", getActiveCompanyId(), collectionName, ...pathSegments);
}

export function companyRootDoc(companyId = getActiveCompanyId()): DocumentReference {
  return doc(db, "companies", sanitizeCompanyId(companyId));
}

export function companyCollectionForDb(
  targetDb: Firestore,
  companyId: string,
  collectionName: string,
  ...pathSegments: string[]
): CollectionReference {
  return collection(targetDb, "companies", sanitizeCompanyId(companyId), collectionName, ...pathSegments);
}
