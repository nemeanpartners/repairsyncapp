import { initializeApp } from 'firebase/app';
import { initializeFirestore, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

async function run() {
  const firebaseConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
  const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
  const app = initializeApp(firebaseConfig);
  const db = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
  }, firebaseConfig.firestoreDatabaseId || undefined);

  console.log("Fetching recent messages...");
  const q = query(collection(db, 'messages'), orderBy('timestamp', 'desc'), limit(15));
  const snap = await getDocs(q);
  snap.forEach(doc => {
    const d = doc.data();
    console.log(`[${d.type}] From ${d.from} to ${d.to}: ${d.text?.substring(0, 30)} (time: ${d.timestamp?.seconds || d.timestamp}, isWebhook: ${d.isWebhook}, uid: ${d.uid})`);
  });
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
