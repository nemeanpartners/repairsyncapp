import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, serverTimestamp, query, limit, orderBy } from "firebase/firestore";
import fs from "fs";

async function main() {
  const cfg = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
  const app = initializeApp(cfg);
  const db = getFirestore(app);

  const q = query(collection(db, 'messages'), orderBy('timestamp', 'desc'), limit(1));
  const snap = await getDocs(q);
  snap.forEach(d => {
    const data = d.data();
    console.log('Timestamp object:', data.timestamp);
    console.log('Has toDate function?:', typeof data.timestamp?.toDate);
    if (data.timestamp?.toDate) {
      console.log('toDate():', data.timestamp.toDate());
    } else {
      console.log('seconds:', data.timestamp?.seconds);
      console.log('Date:', new Date((data.timestamp?.seconds || 0) * 1000));
    }
  });

  const dbText = "it only requires the palmrest c cover as far as i can tell";
  const msgText = "It only requires the palmrest C cover as far as I can tell".replace(/\s+/g, '').toLowerCase();
  console.log("msgText processed:", msgText);
  console.log("dbText processed:", dbText.replace(/\s+/g, '').toLowerCase());
}
main().catch(console.error);
