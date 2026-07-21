import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where } from "firebase/firestore";
import fs from "fs";
const cfg = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(cfg);
const db = getFirestore(app, cfg.firestoreDatabaseId || undefined);
async function run() {
  const t = await getDocs(query(collection(db, "tickets"), where("customer_id", "==", 35865946)));
  t.forEach(d => console.log("Ticket numeric:", d.data()));
  
  const t2 = await getDocs(query(collection(db, "tickets"), where("customer_id", "==", "35865946")));
  t2.forEach(d => console.log("Ticket string:", d.data()));
  process.exit(0);
}
run();
