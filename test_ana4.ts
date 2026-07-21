import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import fs from "fs";
const cfg = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(cfg);
const db = getFirestore(app, cfg.firestoreDatabaseId || undefined);
async function run() {
  console.log('searching customers...');
  const customersColl = await getDocs(collection(db, "customers"));
  customersColl.forEach(d => {
    const data = d.data();
    const str = JSON.stringify(data).toLowerCase();
    if (str.includes("ana") || str.includes("russ") || str.includes("0413548580")) {
      console.log("Customer match:", d.id, data.firstname, data.lastname, data.mobile);
    }
  });

  process.exit(0);
}
run();
