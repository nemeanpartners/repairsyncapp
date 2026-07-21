import { initializeApp } from "firebase/app";
import { initializeFirestore, collection, getDocs } from "firebase/firestore";
import fs from "fs";
const cfg = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(cfg);
const db = initializeFirestore(app, {}, cfg.firestoreDatabaseId);
async function run() {
  const c = await getDocs(collection(db, "crm_tickets"));
  console.log(`Found ${c.docs.length} tickets in crm_tickets`);
  process.exit(0);
}
run();
