import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, where, getDocs } from "firebase/firestore";
import fs from "fs";

const config = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));
const app = initializeApp(config);
const db = getFirestore(app);

async function run() {
  const q = query(collection(db, "crm_tickets"), where("number", "==", 30905));
  const snap = await getDocs(q);
  snap.forEach(doc => console.log(JSON.stringify(doc.data(), null, 2)));
}
run();
