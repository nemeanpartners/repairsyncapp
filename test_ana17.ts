import { initializeApp } from "firebase/app";
import { initializeFirestore, collection, getDocs, query, limit, where } from "firebase/firestore";
import fs from "fs";
const cfg = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(cfg);
const db = initializeFirestore(app, {}, cfg.firestoreDatabaseId);
async function run() {
  const c = await getDocs(query(collection(db, "crm_tickets"), where("customer_id", "==", 35865946)));
  c.forEach(d => {
    console.log(d.data());
  });
  process.exit(0);
}
run();
