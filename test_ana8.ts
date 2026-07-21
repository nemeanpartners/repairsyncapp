import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where, orderBy } from "firebase/firestore";
import fs from "fs";
const cfg = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(cfg);
const db = getFirestore(app, cfg.firestoreDatabaseId || undefined);
async function run() {
  const m = await getDocs(query(collection(db, "messages"), where("customerId", "==", "35865946")));
  m.forEach(d => {
    console.log(d.data().direction, d.data().body);
  });
  
  const m2 = await getDocs(query(collection(db, "messages"), where("conversationId", "==", "61413548580")));
  m2.forEach(d => {
    console.log(d.data().direction, d.data().body);
  });

  const m3 = await getDocs(query(collection(db, "messages"), where("phone", "==", "+61413548580")));
  m3.forEach(d => {
    console.log(d.data().direction, d.data().body);
  });

  process.exit(0);
}
run();
