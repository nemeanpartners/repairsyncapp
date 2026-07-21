import { initializeApp } from "firebase/app";
import { initializeFirestore, collection, getDocs } from "firebase/firestore";
import fs from "fs";
const cfg = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(cfg);
const db = initializeFirestore(app, {}, cfg.firestoreDatabaseId);
async function run() {
  const t = await getDocs(collection(db, "tickets"));
  const out = [];
  t.forEach(d => {
    const data = d.data();
    out.push(`Ticket ${d.id}: ${data.customer_name} | ${data.number} | ${data.device_model} | ${data.phone} | ${data.subject}`);
  });
  const text = out.join('\n');
  fs.writeFileSync('all_tickets.txt', text);
  console.log(`Found ${out.length} tickets`);
  
  const matches = out.filter(l => l.toLowerCase().includes('ana') || l.toLowerCase().includes('russ') || l.includes('413548580'));
  if (matches.length) {
      console.log('Matches:');
      matches.forEach(m => console.log(m));
  } else {
      console.log('No matches for "ana", "russ", or "413548580"');
  }

  process.exit(0);
}
run();
