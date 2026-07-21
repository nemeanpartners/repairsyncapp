import { initializeApp } from 'firebase/app';
import { initializeFirestore, collection, query, getDocs, deleteDoc, doc, orderBy } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

async function run() {
  const firebaseConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
  const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
  const app = initializeApp(firebaseConfig);
  const db = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
  }, firebaseConfig.firestoreDatabaseId || undefined);

  console.log("Cleaning up duplicate messages in DB...");
  const q = query(collection(db, 'messages'), orderBy('timestamp', 'desc'));
  const snap = await getDocs(q);
  
  const seen = new Set();
  let deleted = 0;
  
  for (const docSnap of snap.docs) {
    const d = docSnap.data();
    if (d.type === 'inbound' && d.uid === 'webhook') {
      const textToMatch = d.text?.trim().toLowerCase();
      const phoneToMatch = d.from;
      // Key contains exact text and phone. If we already saw this text from this phone,
      // it's a newer message? Wait, I ordered by timestamp desc.
      // So I will keep the newest one and delete the older duplicates.
      // I should also include a time window just in case, but usually they don't send exact message twice unless it's a retry or long enough apart.
      // Let's use date string (YYYY-MM-DD):
      const dateStr = d.timestamp?.toDate ? d.timestamp.toDate().toISOString().split('T')[0] : 
                      new Date((d.timestamp?.seconds || 0) * 1000).toISOString().split('T')[0];
                      
      const key = `${phoneToMatch}_${textToMatch}_${dateStr}`;
      
      if (seen.has(key)) {
        console.log(`Deleting duplicate message ${docSnap.id}: ${textToMatch?.substring(0, 30)}`);
        await deleteDoc(doc(db, 'messages', docSnap.id));
        deleted++;
      } else {
        seen.add(key);
      }
    }
  }
  
  console.log(`Finished cleaning up. Deleted: ${deleted}`);
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
