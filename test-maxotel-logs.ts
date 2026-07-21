import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfigPath = 'firebase-applet-config.json';
const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function check() {
  const q = query(collection(db, 'messages'), orderBy('timestamp', 'desc'), limit(5));
  const snap = await getDocs(q);
  snap.forEach(d => console.log(d.id, d.data()));
  process.exit(0);
}
check();
