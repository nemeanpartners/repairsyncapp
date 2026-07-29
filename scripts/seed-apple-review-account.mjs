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

async function listCompanyCollection(companyId, collectionName, token) {
  const url =
    `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}` +
    `/databases/${firebaseConfig.firestoreDatabaseId}/documents/companies/${companyId}/${collectionName}?pageSize=300`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(`Firestore list failed for companies/${companyId}/${collectionName}: ${JSON.stringify(body)}`);
  }
  return body.documents || [];
}

async function deleteDocByName(name, token) {
  const response = await fetch(`https://firestore.googleapis.com/v1/${name}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Firestore delete failed for ${name}: ${body}`);
  }
}

async function clearCompanyCollection(companyId, collectionName, token) {
  const documents = await listCompanyCollection(companyId, collectionName, token);
  for (const document of documents) {
    await deleteDocByName(document.name, token);
  }
  console.log(`Cleared ${documents.length} docs from companies/${companyId}/${collectionName}`);
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

for (const collectionName of ["crm_customers", "crm_tickets", "tickets", "conversations", "messages"]) {
  await clearCompanyCollection(reviewUid, collectionName, token);
}

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

const extraCustomers = [
  ["Liam", "O'Connor", "Brisbane Builders", "Samsung Galaxy S24 Ultra"],
  ["Ava", "Wilson", "Wilson Legal", "iPhone 14 battery"],
  ["Oliver", "Brown", "Brown Cafe", "iPad Pro screen"],
  ["Isla", "Taylor", "Taylor Realty", "Google Pixel 8"],
  ["Jack", "Martin", "Martin Electrical", "MacBook Pro keyboard"],
  ["Charlotte", "Anderson", "Anderson Accounting", "Surface Pro charging"],
  ["Henry", "Thomas", "Thomas Plumbing", "Samsung Tab display"],
  ["Grace", "White", "White Design Co", "iPhone 13 camera"],
  ["Leo", "Harris", "Harris Fitness", "Apple Watch battery"],
  ["Ruby", "Clark", "Clark Hair Studio", "iPhone 15 back glass"],
  ["Mason", "Lewis", "Lewis Carpentry", "Dell XPS fan"],
  ["Chloe", "Walker", "Walker Consulting", "iPad Mini charging"],
  ["Ethan", "Hall", "Hall Automotive", "Samsung A54 screen"],
  ["Sophie", "Allen", "Allen Medical", "iPhone SE battery"],
  ["Hudson", "Young", "Young Logistics", "Lenovo ThinkPad screen"],
  ["Zoe", "King", "King Dental", "MacBook Air battery"],
  ["Lucas", "Wright", "Wright Plumbing", "Pixel 7 display"],
  ["Ella", "Scott", "Scott Florist", "iPhone XR charging port"],
  ["Archie", "Green", "Green Landscapes", "iPad Air display"],
  ["Matilda", "Baker", "Baker Finance", "Samsung S23 Ultra"],
  ["Harvey", "Adams", "Adams Retail", "iPhone 12 speaker"],
  ["Lily", "Nelson", "Nelson Creative", "MacBook Pro liquid damage"],
  ["Cooper", "Carter", "Carter Health", "iPhone 11 battery"],
  ["Poppy", "Mitchell", "Mitchell Events", "Surface Laptop display"],
  ["Finn", "Perez", "Perez Barber", "Samsung Z Flip hinge"],
  ["Evie", "Roberts", "Roberts Property", "iPhone 14 Pro Max"],
  ["Oscar", "Turner", "Turner Workshop", "iPad 10th Gen glass"],
];

extraCustomers.forEach(([firstName, lastName, businessName, device], index) => {
  const phoneSuffix = String(7000 + index).padStart(4, "0");
  const id = `apple_review_customer_${String(index + 4).padStart(2, "0")}`;
  customers.push({
    id,
    firstname: firstName,
    lastname: lastName,
    firstName,
    lastName,
    email: `${firstName.toLowerCase().replace(/[^a-z]/g, "")}.${lastName.toLowerCase().replace(/[^a-z]/g, "")}@example.com`,
    phone: `+61400${phoneSuffix}`,
    mobile: `+61400${phoneSuffix}`,
    businessName,
    normalizedName: `${firstName} ${lastName}`.toLowerCase(),
    searchableTerms: `${firstName} ${lastName} ${businessName} ${device}`.toLowerCase(),
  });
});

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

const ticketStatuses = ["Booked In", "Diagnosing", "Awaiting Parts", "In Repair", "Ready for Pickup"];
const priorities = ["Normal", "High", "Urgent"];
for (let index = tickets.length; index < 35; index += 1) {
  const customer = customers[index % customers.length];
  const ticketNumber = 1001 + index;
  tickets.push({
    id: `apple_review_ticket_${ticketNumber}`,
    number: ticketNumber,
    customer_id: customer.id,
    customer_name: `${customer.firstName} ${customer.lastName}`,
    tech_id: reviewUid,
    technicianName: "Apple Review User",
    subject: `${customer.businessName} repair workflow ${ticketNumber}`,
    repair_category: index % 3 === 0 ? "Phone Repair" : index % 3 === 1 ? "Tablet Repair" : "Laptop Repair",
    brand: index % 2 === 0 ? "Apple" : "Samsung",
    device_model: index % 2 === 0 ? "iPhone 14 Pro" : "Galaxy S23",
    problem_type: index % 2 === 0 ? "Screen and battery service" : "Charging and diagnostics",
    status: ticketStatuses[index % ticketStatuses.length],
    priority: priorities[index % priorities.length],
    tags: ["apple-review", "demo"],
    estimate_total: 119 + index * 8,
  });
}

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

for (let index = 0; index < 10; index += 1) {
  const customer = customers[index];
  const conversationId = `apple_review_conversation_${String(index + 1).padStart(2, "0")}`;
  const messageText = [
    "Can you confirm the repair estimate before starting?",
    "I dropped the phone off this morning and need an update.",
    "Please go ahead with the parts order.",
    "Is the device ready for pickup today?",
    "Can you send the invoice through?",
    "The screen is flickering again after the repair.",
    "I need to add a case and screen protector.",
    "Please call me before replacing the battery.",
    "Can you transfer the data as part of the repair?",
    "I approved the quote in the customer portal.",
  ][index];
  await setCompanyDoc(
    reviewUid,
    "conversations",
    conversationId,
    {
      customerId: customer.id,
      customerName: `${customer.firstName} ${customer.lastName}`,
      phone: customer.phone,
      preview: messageText,
      lastMessage: messageText,
      isUnread: true,
      isYourTurn: index % 2 === 0,
      isUrgent: index === 0 || index === 5,
      isArchived: false,
      updatedAt: nowIso,
      ...common,
    },
    token,
  );

  await setCompanyDoc(
    reviewUid,
    "messages",
    `apple_review_message_${String(index + 1).padStart(2, "0")}`,
    {
      conversationId,
      customerId: customer.id,
      from: customer.phone,
      to: "RepairSync",
      text: messageText,
      type: "inbound",
      direction: "inbound",
      timestamp: nowIso,
      ...common,
    },
    token,
  );
}

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
console.log(`Seed counts: ${customers.length} customers, ${tickets.length} crm_tickets, 10 unread conversations`);
