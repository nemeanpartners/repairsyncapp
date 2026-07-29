import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";

const configPath = path.join(process.cwd(), "firebase-applet-config.json");
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));

const MAIN_COMPANY_ID = "lI9x10u1bwWLFRCWDLG1tAsk8lQ2";
const APPLE_REVIEW_COMPANY_ID = "NObUTPU3pJX8ZyA6vpEK3gLWIK52";
const APPLE_REVIEW_EMAIL = "tryonapptestuser@gmail.com";

const OPERATIONAL_COLLECTIONS = [
  "conversations",
  "crm_customers",
  "crm_tickets",
  "inventory_products",
  "invoices",
  "messages",
  "parts_orders",
  "settings",
  "tasks",
  "tickets",
  "crm_notes",
  "crm_line_items",
  "estimates",
  "payments",
  "product_catalog",
  "suppliers",
  "chat_templates",
  "sms_templates",
  "task_categories",
  "call_logs",
  "daily_checklists",
  "quote_inquiries",
  "system_logs",
  "notifications",
  "crm_estimates",
  "crm_invoices",
  "xero_sync_queue",
  "crm_integrations",
  "end_of_day_records",
  "hire_contracts",
  "audit_logs",
  "crm_attachments",
  "team_messages",
  "shifts",
  "leave_requests",
  "receipts",
];

function accessToken() {
  return execFileSync("gcloud", ["auth", "print-access-token"], { encoding: "utf8" }).trim();
}

function baseUrl() {
  return `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents`;
}

async function firestoreRequest(pathname, options = {}) {
  const token = accessToken();
  const response = await fetch(`${baseUrl()}/${pathname}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(`${options.method || "GET"} ${pathname} failed: ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

async function listDocuments(collectionPath) {
  const docs = [];
  let pageToken = "";
  do {
    const suffix = pageToken ? `?pageSize=300&pageToken=${encodeURIComponent(pageToken)}` : "?pageSize=300";
    const result = await firestoreRequest(`${collectionPath}${suffix}`);
    docs.push(...(result?.documents || []));
    pageToken = result?.nextPageToken || "";
  } while (pageToken);
  return docs;
}

function docId(document) {
  return document.name.split("/").pop();
}

function fieldString(fields, key) {
  return fields?.[key]?.stringValue || "";
}

function targetCompanyId(fields = {}) {
  if (
    fieldString(fields, "tenantId") === "apple-review" ||
    fieldString(fields, "reviewAccountEmail").toLowerCase() === APPLE_REVIEW_EMAIL
  ) {
    return APPLE_REVIEW_COMPANY_ID;
  }
  return MAIN_COMPANY_ID;
}

async function patchDocument(pathname, fields) {
  await firestoreRequest(pathname, {
    method: "PATCH",
    body: JSON.stringify({ fields }),
  });
}

async function deleteDocument(pathname) {
  await firestoreRequest(pathname, { method: "DELETE" });
}

async function ensureCompaniesAndUsers() {
  const now = new Date().toISOString();
  await patchDocument(`companies/${MAIN_COMPANY_ID}`, {
    companyName: { stringValue: "RepairSync" },
    ownerUid: { stringValue: MAIN_COMPANY_ID },
    updatedAt: { timestampValue: now },
  });
  await patchDocument(`companies/${APPLE_REVIEW_COMPANY_ID}`, {
    companyName: { stringValue: "RepairSync Apple Review Workshop" },
    ownerUid: { stringValue: APPLE_REVIEW_COMPANY_ID },
    updatedAt: { timestampValue: now },
  });

  const users = await listDocuments("users");
  for (const user of users) {
    const id = docId(user);
    const fields = {
      ...(user.fields || {}),
      uid: { stringValue: id },
      companyId: {
        stringValue: fieldString(user.fields, "email").toLowerCase() === APPLE_REVIEW_EMAIL
          ? APPLE_REVIEW_COMPANY_ID
          : MAIN_COMPANY_ID,
      },
      companyName: {
        stringValue: fieldString(user.fields, "email").toLowerCase() === APPLE_REVIEW_EMAIL
          ? "RepairSync Apple Review Workshop"
          : "RepairSync",
      },
      updatedAt: { timestampValue: now },
    };
    await patchDocument(`users/${id}`, fields);
    await patchDocument(`companies/${fields.companyId.stringValue}/users/${id}`, fields);
  }
}

async function migrateCollection(collectionName) {
  const docs = await listDocuments(collectionName);
  let copied = 0;
  let deleted = 0;

  for (const document of docs) {
    const id = docId(document);
    const fields = document.fields || {};
    const companyId = targetCompanyId(fields);
    await patchDocument(`companies/${companyId}/${collectionName}/${id}`, fields);
    copied += 1;
    await deleteDocument(`${collectionName}/${id}`);
    deleted += 1;
  }

  return { collectionName, copied, deleted };
}

await ensureCompaniesAndUsers();

const results = [];
for (const collectionName of OPERATIONAL_COLLECTIONS) {
  results.push(await migrateCollection(collectionName));
}

console.table(results.filter((result) => result.copied || result.deleted));
