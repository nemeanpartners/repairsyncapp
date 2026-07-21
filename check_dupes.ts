import { initializeApp } from "firebase/app";
import { getFirestore, query, collection, getDocs, limit, orderBy } from "firebase/firestore";
import fs from "fs";

async function main() {
  const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf-8'));
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  const q = query(
    collection(db, "messages"),
    orderBy("timestamp", "desc"),
    limit(40)
  );
  const snap = await getDocs(q);
  snap.forEach(doc => {
    const d = doc.data();
    console.log(doc.id, d.text, !!d.timestamp, d.timestamp?.seconds, d.from, d.to);
  });
}
main().catch(console.error);
