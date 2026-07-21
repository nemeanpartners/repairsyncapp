import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

const firebaseConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || undefined);

async function testQuery() {
  try {
    const q = query(
      collection(db, 'messages'),
      where('uid', 'in', ['whatever_user_uid', 'webhook']),
      orderBy('timestamp', 'asc')
    );
    const snap = await getDocs(q);
    console.log("Query Successful! Docs:", snap.docs.length);
  } catch (err: any) {
    console.error("Query Failed!", err.message);
  }
}
testQuery();
