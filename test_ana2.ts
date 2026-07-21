import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import fs from "fs";
const cfg = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(cfg);
const db = getFirestore(app, cfg.firestoreDatabaseId || undefined);
async function run() {
  const c = await getDoc(doc(db, "conversations", "61413548580"));
  console.log("Data:", JSON.stringify(c.data(), null, 2));
  process.exit(0);
}
run();
