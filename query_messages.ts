import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, query, getDocs, where } from 'firebase/firestore';
import fs from 'fs';

const p = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = getApps().length === 0 ? initializeApp(p) : getApp();
const db = getFirestore(app, p.firestoreDatabaseId || undefined);

async function run() {
  const q = query(collection(db, 'messages'));
  const snap = await getDocs(q);
  const msgs = snap.docs.map(d => ({id: d.id, ...d.data()})).filter(m => JSON.stringify(m).includes('Naomi'));
  console.log(JSON.stringify(msgs, null, 2));
}

run().catch(console.error);
