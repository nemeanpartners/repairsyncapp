import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import fs from "fs";
const cfg = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(cfg);
const db = getFirestore(app, cfg.firestoreDatabaseId || undefined);
async function run() {
  const t = await getDocs(collection(db, "tickets"));
  t.forEach(d => {
    const data = d.data();
    if (data.repair_category && data.repair_category.toLowerCase().includes('robo')) {
       console.log("Robovac:", d.id, data.customer_name, data.device_model, data.number, data.phone);
    }
    if ((data.customer_name || '').toLowerCase().startsWith('ana')) {
       console.log("Ana?:", d.id, data.customer_name, data.number);
    }
  });

  process.exit(0);
}
run();
