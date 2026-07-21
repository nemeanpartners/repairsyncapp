import { initializeApp } from "firebase/app";
import { initializeFirestore, collection, getDocs, query, limit, where } from "firebase/firestore";
import fs from "fs";
const cfg = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(cfg);
const db = initializeFirestore(app, {}, cfg.firestoreDatabaseId);
async function run() {
  const c = await getDocs(query(collection(db, "crm_tickets"), limit(3000)));
  const out = [];
  c.forEach(d => {
    const data = d.data();
    const str = [data.customer_name, data.customer_firstname, data.customer_lastname, data.number, data.phone].join(" ").toLowerCase();
    if (str.includes("ana") || str.includes("russ") || str.includes("41354858")) {
      out.push(d.data());
    }
  });
  out.forEach(data => {
    console.log(`Ticket ${data.id}: ${data.customer_name} | #${data.number} | ${data.device_model} | ${data.phone}`);
  });
  console.log(`Matched ${out.length}`);
  process.exit(0);
}
run();
