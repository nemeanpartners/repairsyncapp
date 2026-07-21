import * as fs from 'fs';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
  const snap = await getDocs(collection(db, 'crm_customers'));
  let count = 0;
  for (const d of snap.docs) {
    const data = d.data();
    const firstname = (data.firstname || data.first_name || '').trim();
    const lastname = (data.lastname || data.last_name || '').trim();
    const fullname = (data.fullname || '').trim();
    
    if (!firstname && !lastname && !fullname) {
      await deleteDoc(doc(db, 'crm_customers', d.id));
      count++;
    }
  }
  console.log(`Deleted ${count} truly nameless customers.`);
  process.exit(0);
}
run();
