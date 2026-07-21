import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import * as fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
  const q = collection(db, 'crm_customers');
  const snap = await getDocs(q);
  let count = 0;
  for (const d of snap.docs) {
    const data = d.data();
    const firstname = (data.firstname || data.first_name || '').trim();
    const lastname = (data.lastname || data.last_name || '').trim();
    if (!firstname && !lastname) {
      console.log(`Deleting customer ${d.id}:`, data);
      await deleteDoc(doc(db, 'crm_customers', d.id));
      count++;
    }
  }
  console.log(`Deleted ${count} nameless customers.`);
  process.exit(0);
}

run();
