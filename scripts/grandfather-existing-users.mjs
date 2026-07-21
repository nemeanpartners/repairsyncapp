import fs from "fs";
import path from "path";
import { initializeApp } from "firebase/app";
import {
  collection,
  doc,
  getDocs,
  initializeFirestore,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

const cutoff = process.env.SUBSCRIPTION_GRANDFATHER_CUTOFF || "2026-06-12T00:00:00.000Z";
const configPath = path.join(process.cwd(), "firebase-applet-config.json");

if (!fs.existsSync(configPath)) {
  throw new Error("firebase-applet-config.json not found");
}

const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
const app = initializeApp(firebaseConfig);
const db = initializeFirestore(
  app,
  {
    experimentalAutoDetectLongPolling: true,
  },
  firebaseConfig.firestoreDatabaseId,
);

const snapshot = await getDocs(collection(db, "users"));
let updated = 0;

for (const userDoc of snapshot.docs) {
  await setDoc(
    doc(db, "users", userDoc.id),
    {
      updatedAt: serverTimestamp(),
      billingRequired: false,
      subscriptionActive: true,
      subscriptionStatus: "grandfathered",
      subscriptionSource: "grandfathered",
      subscriptionGrandfathered: true,
      subscriptionCheckoutCompletedAt: null,
      subscriptionCurrentPeriodEnd: null,
      subscriptionPlan: userDoc.data().subscriptionPlan || null,
      subscriptionInterval: userDoc.data().subscriptionInterval || null,
      subscriptionGrandfatheredCutoff: cutoff,
    },
    { merge: true },
  );
  updated += 1;
}

console.log(`Grandfathered ${updated} existing user documents using cutoff ${cutoff}`);
