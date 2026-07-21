import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where } from "firebase/firestore";
import fs from "fs";
const cfg = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(cfg);
const db = getFirestore(app, cfg.firestoreDatabaseId || undefined);
async function run() {
  const m = await getDocs(query(collection(db, "messages"), where("customerId", "==", "35865946")));
  m.forEach(d => {
    console.log(JSON.stringify(d.data()));
  });

  process.exit(0);
}
run();
