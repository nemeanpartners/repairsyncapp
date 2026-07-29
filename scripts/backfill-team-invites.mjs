import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";

const configPath = path.join(process.cwd(), "firebase-applet-config.json");
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));

function accessToken() {
  return execFileSync("gcloud", ["auth", "print-access-token"], { encoding: "utf8" }).trim();
}

function documentsBaseUrl() {
  return `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents`;
}

async function firestoreRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken()}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${options.method || "GET"} ${url} failed: ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

function fieldString(fields, key) {
  return fields?.[key]?.stringValue || "";
}

async function runUsersCollectionGroupQuery() {
  const url =
    `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}` +
    `/databases/${firebaseConfig.firestoreDatabaseId}/documents:runQuery`;
  const result = await firestoreRequest(url, {
    method: "POST",
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: "users", allDescendants: true }],
        where: {
          fieldFilter: {
            field: { fieldPath: "email" },
            op: "GREATER_THAN",
            value: { stringValue: "" },
          },
        },
      },
    }),
  });
  return result.map((row) => row.document).filter(Boolean);
}

async function runTopLevelUsersByEmailQuery(email) {
  const url =
    `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}` +
    `/databases/${firebaseConfig.firestoreDatabaseId}/documents:runQuery`;
  const result = await firestoreRequest(url, {
    method: "POST",
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: "users" }],
        where: {
          fieldFilter: {
            field: { fieldPath: "email" },
            op: "EQUAL",
            value: { stringValue: email },
          },
        },
      },
    }),
  });
  return result.map((row) => row.document).filter(Boolean);
}

function inviteFromCompanyUserDocument(document) {
  const name = document.name;
  if (!name.includes("/documents/companies/") || !name.includes("/users/")) return null;
  const pathAfterDocuments = name.split("/documents/")[1];
  const [, companyId, , userDocId] = pathAfterDocuments.split("/");
  const fields = document.fields || {};
  const email = fieldString(fields, "email").trim().toLowerCase();
  if (!email || !email.includes("@")) return null;
  if (companyId === userDocId) return null;
  if (companyId === fieldString(fields, "uid")) return null;

  return {
    email,
    companyId,
    fields: {
      ...fields,
      email: { stringValue: email },
      companyId: { stringValue: companyId },
      role: fields.role || { stringValue: "tech" },
      hasAccess: fields.hasAccess || { booleanValue: true },
      billingRequired: { booleanValue: false },
      subscriptionActive: { booleanValue: true },
      subscriptionStatus: { stringValue: "active" },
      subscriptionSource: { stringValue: "company_invite" },
      updatedAt: { timestampValue: new Date().toISOString() },
    },
  };
}

async function patchInvite(invite) {
  const url = `${documentsBaseUrl()}/team_invites/${encodeURIComponent(invite.email)}`;
  await firestoreRequest(url, {
    method: "PATCH",
    body: JSON.stringify({ fields: invite.fields }),
  });
}

async function patchDocumentByPath(pathname, fields) {
  await firestoreRequest(`${documentsBaseUrl()}/${pathname}`, {
    method: "PATCH",
    body: JSON.stringify({ fields }),
  });
}

function docId(document) {
  return document.name.split("/").pop();
}

async function applyInviteToExistingUsers(invite) {
  const users = await runTopLevelUsersByEmailQuery(invite.email);
  for (const user of users) {
    const uid = docId(user);
    const fields = {
      ...(user.fields || {}),
      ...invite.fields,
      uid: { stringValue: uid },
      email: { stringValue: invite.email },
      companyId: { stringValue: invite.companyId },
      billingRequired: { booleanValue: false },
      subscriptionActive: { booleanValue: true },
      subscriptionStatus: { stringValue: "active" },
      subscriptionSource: { stringValue: "company_invite" },
      subscriptionGrandfathered: { booleanValue: false },
      updatedAt: { timestampValue: new Date().toISOString() },
    };
    await patchDocumentByPath(`users/${encodeURIComponent(uid)}`, fields);
    await patchDocumentByPath(
      `companies/${encodeURIComponent(invite.companyId)}/users/${encodeURIComponent(uid)}`,
      fields,
    );
    await patchDocumentByPath(
      `companies/${encodeURIComponent(invite.companyId)}/users/${encodeURIComponent(invite.email)}`,
      fields,
    );
    console.log(`Activated company subscription for ${invite.email} user ${uid}`);
  }
}

const documents = await runUsersCollectionGroupQuery();
const invitesByEmail = new Map();
for (const document of documents) {
  const invite = inviteFromCompanyUserDocument(document);
  if (!invite) continue;
  const existing = invitesByEmail.get(invite.email);
  if (!existing || fieldString(invite.fields, "invitedBy")) {
    invitesByEmail.set(invite.email, invite);
  }
}

for (const invite of invitesByEmail.values()) {
  await patchInvite(invite);
  await applyInviteToExistingUsers(invite);
  console.log(`Backfilled ${invite.email} -> ${invite.companyId}`);
}

console.log(`Backfilled ${invitesByEmail.size} team invite indexes.`);
