import fs from 'fs';
import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, orderBy, limit, getDocs } from "firebase/firestore";

const config = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));
const app = initializeApp(config);
const db = getFirestore(app);

async function run() {
  const q = query(collection(db, "conversations"), orderBy("updatedAt", "desc"), limit(5));
  const snap = await getDocs(q);
  snap.forEach(doc => console.log("Conv:", doc.id, JSON.stringify(doc.data(), null, 2)));

  const q2 = query(collection(db, "messages"), orderBy("timestamp", "desc"), limit(5));
  const snap2 = await getDocs(q2);
  snap2.forEach(doc => console.log("Msg:", doc.id, JSON.stringify(doc.data(), null, 2)));
}
run();
