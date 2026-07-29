import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";

const REVIEW_EMAIL = "tryonapptestuser@gmail.com";
const REVIEW_PASSWORD = "Repairsync.1!";
const SUPPORT_EMAIL = "nemeanpartnersptyltd@gmail.com";

const configPath = path.join(process.cwd(), "firebase-applet-config.json");
if (!fs.existsSync(configPath)) {
  throw new Error("firebase-applet-config.json not found");
}

const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
const nowIso = new Date().toISOString();

async function firebaseAuthRequest(endpoint, body) {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:${endpoint}?key=${firebaseConfig.apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  const data = await response.json();
  if (!response.ok) {
    const message = data?.error?.message || `Firebase Auth ${endpoint} failed`;
    const error = new Error(message);
    error.code = message;
    throw error;
  }
  return data;
}

async function ensureReviewAuthUser() {
  try {
    const created = await firebaseAuthRequest("signUp", {
      email: REVIEW_EMAIL,
      password: REVIEW_PASSWORD,
      returnSecureToken: true,
    });
    console.log(`Created Firebase Auth review user ${REVIEW_EMAIL}`);
    return created.localId;
  } catch (error) {
    if (error.code !== "EMAIL_EXISTS") throw error;
    const signedIn = await firebaseAuthRequest("signInWithPassword", {
      email: REVIEW_EMAIL,
      password: REVIEW_PASSWORD,
      returnSecureToken: true,
    });
    console.log(`Firebase Auth review user already exists: ${REVIEW_EMAIL}`);
    return signedIn.localId;
  }
}

function firestoreValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return { timestampValue: value };
    return { stringValue: value };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(firestoreValue) } };
  }
  if (typeof value === "object") {
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(value).map(([key, child]) => [key, firestoreValue(child)]),
        ),
      },
    };
  }
  return { stringValue: String(value) };
}

function firestoreDocument(data) {
  return {
    fields: Object.fromEntries(
      Object.entries(data).map(([key, value]) => [key, firestoreValue(value)]),
    ),
  };
}

function accessToken() {
  return execFileSync("gcloud", ["auth", "print-access-token"], {
    encoding: "utf8",
  }).trim();
}

async function setDoc(collectionName, docId, data, token) {
  const encodedDocId = encodeURIComponent(docId);
  const url =
    `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}` +
    `/databases/${firebaseConfig.firestoreDatabaseId}/documents/${collectionName}/${encodedDocId}`;
  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(firestoreDocument(data)),
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Firestore write failed for ${collectionName}/${docId}: ${body}`);
  }
}

async function setCompanyDoc(companyId, collectionName, docId, data, token) {
  return setDoc(`companies/${companyId}/${collectionName}`, docId, data, token);
}

const reviewUid = await ensureReviewAuthUser();
const token = accessToken();

const common = {
  tenantId: "apple-review",
  demoAccount: true,
  reviewAccountEmail: REVIEW_EMAIL,
  updated_at: nowIso,
};

await setDoc(
  "users",
  reviewUid,
  {
    uid: reviewUid,
    email: REVIEW_EMAIL,
    displayName: "Apple Review User",
    role: "admin",
    companyId: reviewUid,
    companyName: "RepairSync Apple Review Workshop",
    hasAccess: true,
    billingRequired: false,
    subscriptionActive: true,
    subscriptionStatus: "active",
    subscriptionPlan: "pro",
    subscriptionInterval: "yearly",
    subscriptionSource: "apple_review_seed",
    subscriptionGrandfathered: false,
    subscriptionCheckoutCompletedAt: nowIso,
    subscriptionCurrentPeriodEnd: null,
    supportEmail: SUPPORT_EMAIL,
    createdAt: nowIso,
    updatedAt: nowIso,
  },
  token,
);

await setDoc(
  "companies",
  reviewUid,
  {
    companyName: "RepairSync Apple Review Workshop",
    ownerUid: reviewUid,
    ownerEmail: REVIEW_EMAIL,
    updatedAt: nowIso,
  },
  token,
);

await setCompanyDoc(
  reviewUid,
  "users",
  reviewUid,
  {
    uid: reviewUid,
    email: REVIEW_EMAIL,
    displayName: "Apple Review User",
    role: "admin",
    companyId: reviewUid,
    companyName: "RepairSync Apple Review Workshop",
    supportEmail: SUPPORT_EMAIL,
    updatedAt: nowIso,
  },
  token,
);

await setCompanyDoc(
  reviewUid,
  "settings",
  "business",
  {
    businessName: "RepairSync Apple Review Workshop",
    supportEmail: SUPPORT_EMAIL,
    phone: "+61 7 5555 0199",
    address: "123 Queen Street, Brisbane QLD 4000",
    timezone: "Australia/Brisbane",
    currency: "AUD",
    ...common,
  },
  token,
);

const customers = [
  {
    id: "apple_review_customer_amelia",
    firstname: "Amelia",
    lastname: "Hart",
    firstName: "Amelia",
    lastName: "Hart",
    email: "amelia.hart@example.com",
    phone: "+61400111222",
    mobile: "+61400111222",
    businessName: "Hart Creative Studio",
    normalizedName: "amelia hart",
    searchableTerms: "amelia hart hart creative studio iphone 15 pro screen",
  },
  {
    id: "apple_review_customer_noah",
    firstname: "Noah",
    lastname: "Singh",
    firstName: "Noah",
    lastName: "Singh",
    email: "noah.singh@example.com",
    phone: "+61400333444",
    mobile: "+61400333444",
    businessName: "Northside Dental",
    normalizedName: "noah singh",
    searchableTerms: "noah singh northside dental macbook liquid damage",
  },
  {
    id: "apple_review_customer_mia",
    firstname: "Mia",
    lastname: "Nguyen",
    firstName: "Mia",
    lastName: "Nguyen",
    email: "mia.nguyen@example.com",
    phone: "+61400555666",
    mobile: "+61400555666",
    businessName: "Mia Nguyen",
    normalizedName: "mia nguyen",
    searchableTerms: "mia nguyen ipad charging port repair",
  },
];

for (const customer of customers) {
  await setCompanyDoc(reviewUid, "crm_customers", customer.id, { ...customer, created_at: nowIso, ...common }, token);
}

const tickets = [
  {
    id: "apple_review_ticket_1001",
    number: 1001,
    customer_id: "apple_review_customer_amelia",
    customer_name: "Amelia Hart",
    tech_id: reviewUid,
    technicianName: "Apple Review User",
    subject: "iPhone 15 Pro display replacement",
    repair_category: "Phone Repair",
    brand: "Apple",
    device_model: "iPhone 15 Pro",
    problem_type: "Cracked display",
    status: "Diagnosing",
    priority: "High",
    tags: ["apple-review", "screen"],
    estimate_total: 329,
  },
  {
    id: "apple_review_ticket_1002",
    number: 1002,
    customer_id: "apple_review_customer_noah",
    customer_name: "Noah Singh",
    tech_id: reviewUid,
    technicianName: "Apple Review User",
    subject: "MacBook Air M2 liquid damage assessment",
    repair_category: "Laptop Repair",
    brand: "Apple",
    device_model: "MacBook Air M2",
    problem_type: "Liquid damage",
    status: "Awaiting Parts",
    priority: "Urgent",
    tags: ["apple-review", "board-repair"],
    estimate_total: 649,
  },
  {
    id: "apple_review_ticket_1003",
    number: 1003,
    customer_id: "apple_review_customer_mia",
    customer_name: "Mia Nguyen",
    tech_id: reviewUid,
    technicianName: "Apple Review User",
    subject: "iPad charging port service",
    repair_category: "Tablet Repair",
    brand: "Apple",
    device_model: "iPad Air",
    problem_type: "Charging intermittently",
    status: "Ready for Pickup",
    priority: "Normal",
    tags: ["apple-review", "charging"],
    estimate_total: 189,
  },
];

for (const ticket of tickets) {
  const data = {
    ...ticket,
    created_at: nowIso,
    updated_at: nowIso,
    ...common,
  };
  await setCompanyDoc(reviewUid, "crm_tickets", ticket.id, data, token);
  await setCompanyDoc(reviewUid, "tickets", ticket.id, data, token);
}

await setCompanyDoc(
  reviewUid,
  "conversations",
  "apple_review_conversation_amelia",
  {
    customerId: "apple_review_customer_amelia",
    customerName: "Amelia Hart",
    phone: "+61400111222",
    preview: "Thanks, please go ahead with the display replacement.",
    lastMessage: "Thanks, please go ahead with the display replacement.",
    isUnread: true,
    isYourTurn: true,
    isUrgent: false,
    isArchived: false,
    updatedAt: nowIso,
    ...common,
  },
  token,
);

await setCompanyDoc(
  reviewUid,
  "messages",
  "apple_review_message_amelia_1",
  {
    conversationId: "apple_review_conversation_amelia",
    customerId: "apple_review_customer_amelia",
    from: "+61400111222",
    to: "RepairSync",
    text: "Thanks, please go ahead with the display replacement.",
    type: "inbound",
    direction: "inbound",
    timestamp: nowIso,
    ...common,
  },
  token,
);

await setCompanyDoc(
  reviewUid,
  "tasks",
  "apple_review_task_parts",
  {
    title: "Confirm iPhone 15 Pro display stock",
    status: "open",
    priority: "High",
    dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    assignedTo: "Apple Review User",
    ticketId: "apple_review_ticket_1001",
    createdAt: nowIso,
    ...common,
  },
  token,
);

await setCompanyDoc(
  reviewUid,
  "parts_orders",
  "apple_review_parts_iphone_display",
  {
    ticketId: "apple_review_ticket_1001",
    supplier: "Demo Parts Supplier",
    partName: "iPhone 15 Pro OLED display assembly",
    status: "ordered",
    cost: 218,
    createdAt: nowIso,
    ...common,
  },
  token,
);

await setCompanyDoc(
  reviewUid,
  "inventory_products",
  "apple_review_inventory_display",
  {
    name: "iPhone 15 Pro OLED display assembly",
    sku: "APL15P-OLED-DEMO",
    quantity: 4,
    reorderLevel: 2,
    cost: 218,
    price: 329,
    updatedAt: nowIso,
    ...common,
  },
  token,
);

await setCompanyDoc(
  reviewUid,
  "invoices",
  "apple_review_invoice_1001",
  {
    invoice_number: "INV-APPLE-1001",
    customer_id: "apple_review_customer_amelia",
    customer_name: "Amelia Hart",
    ticket_id: "apple_review_ticket_1001",
    status: "Draft",
    total: 329,
    balance_due: 329,
    created_at: nowIso,
    ...common,
  },
  token,
);

console.log(`Seeded Apple review account and mock data for ${REVIEW_EMAIL}`);
console.log(`Review account UID: ${reviewUid}`);
