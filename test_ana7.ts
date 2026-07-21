import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where } from "firebase/firestore";
import fs from "fs";
const cfg = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(cfg);
const db = getFirestore(app, cfg.firestoreDatabaseId || undefined);
async function run() {
  const m = await getDocs(query(collection(db, "messages"), where("conversationId", "==", "61413548580")));
  m.forEach(d => {
    console.log(d.data().direction, d.data().body);
  });
  process.exit(0);
}
run();
