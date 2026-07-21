import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import fs from "fs";

const config = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));

async function run() {
  const app = initializeApp(config);
  try {
    const db = getFirestore(app, config.firestoreDatabaseId);
    let snap = await getDoc(doc(db, "test/connection"));
    console.log("DB connection successful");
    process.exit(0);
  } catch (e) {
    console.error("DB error:", e.message);
    process.exit(1);
  }
}
run();
