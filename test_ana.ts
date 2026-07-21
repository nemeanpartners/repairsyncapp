import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query } from "firebase/firestore";
import fs from "fs";
const cfg = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(cfg);
const db = getFirestore(app, cfg.firestoreDatabaseId || undefined);
async function run() {
  const t = await getDocs(collection(db, "tickets"));
  const c = await getDocs(collection(db, "conversations"));
  console.log("Tickets:");
  t.forEach(d => {
    const data = d.data();
    const str = JSON.stringify(data).toLowerCase();
    if (str.includes("ana russ") || str.includes("russ")) console.log("Ticket match:", d.id, data.customer_name, data.device_model);
  });
  console.log("Conversations:");
  c.forEach(d => {
    const data = d.data();
    const str = JSON.stringify(data).toLowerCase();
    if (str.includes("ana russ") || str.includes("russ")) console.log("Conv match:", d.id, data.customerName, data.ticketNumber);
  });
  process.exit(0);
}
run();
