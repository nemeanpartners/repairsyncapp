import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, limit, getDocs } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

const firebaseConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || undefined);

async function testTickets() {
  try {
    const q1 = query(collection(db, 'tickets'), limit(1));
    const snap1 = await getDocs(q1);
    console.log("tickets:", snap1.docs.map(d => Object.assign({id: d.id}, d.data())));

    const q2 = query(collection(db, 'crm_tickets'), limit(1));
    const snap2 = await getDocs(q2);
    console.log("crm_tickets:", snap2.docs.map(d => Object.assign({id: d.id}, d.data())));
  } catch (err: any) {
    console.error("Query Failed!", err);
  }
}
testTickets();
