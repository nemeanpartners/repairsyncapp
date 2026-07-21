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

  const q = query(collection(db, 'messages'), orderBy('timestamp', 'desc'), limit(15));
  const snap = await getDocs(q);
  snap.forEach(doc => {
    const d = doc.data();
    if (d.text?.includes("It only requires the palmrest")) {
       console.log("Doc data:", JSON.stringify(d, null, 2));
    }
  });
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
