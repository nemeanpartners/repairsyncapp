import fs from 'fs';
import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, orderBy, limit, getDocs } from "firebase/firestore";

const config = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));
const app = initializeApp(config);
const db = getFirestore(app);

async function run() {
  const q = query(collection(db, "conversations"), orderBy("updatedAt", "desc"), limit(10));
  const snap = await getDocs(q);
  snap.forEach(doc => console.log("Conv:", doc.id, "Phone:", doc.data().phone, "Preview:", doc.data().lastMessagePreview));
}
run();
