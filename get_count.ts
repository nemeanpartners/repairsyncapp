
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getCountFromServer } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function checkCount() {
  const coll = collection(db, 'crm_customers');
  const snapshot = await getCountFromServer(coll);
  console.log('Total count in crm_customers:', snapshot.data().count);
  
  const ticketColl = collection(db, 'crm_tickets');
  const ticketSnapshot = await getCountFromServer(ticketColl);
  console.log('Total count in crm_tickets:', ticketSnapshot.data().count);
}

checkCount().catch(console.error);
