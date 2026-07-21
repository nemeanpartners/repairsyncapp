import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import fs from "fs";
const cfg = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(cfg);
const db = getFirestore(app, cfg.firestoreDatabaseId || undefined);
async function run() {
  const t = await getDocs(collection(db, "tickets"));
  const out = [];
  t.forEach(d => {
    const data = d.data();
    out.push(`Ticket ${d.id}: ${data.customer_name} | ${data.number} | ${data.device_model} | ${data.repair_category} | ${data.phone}`);
  });
  fs.writeFileSync('all_tickets.txt', out.join('\n'));
  process.exit(0);
}
run();
