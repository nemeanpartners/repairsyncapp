import { initializeApp } from "firebase/app";
import { getFirestore, collection, getCountFromServer } from "firebase/firestore";
import fs from "fs";
const cfg = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(cfg);
const db = getFirestore(app, cfg.firestoreDatabaseId || undefined);
async function run() {
  const coll = collection(db, "tickets");
  const snapshot = await getCountFromServer(coll);
  console.log("Total tickets:", snapshot.data().count);
  process.exit(0);
}
run();
