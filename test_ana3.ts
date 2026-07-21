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
    const str = JSON.stringify(data).toLowerCase();
    if (str.includes("413548580") || str.includes("ana") || str.includes("russ") || str.includes("61413548580") || str.includes("macadamia")) {
      console.log("Ticket match:", d.id, data.customer_name, data.device_model, data.number, data.phone);
    }
  });
  console.log("Done");
  process.exit(0);
}
run();
