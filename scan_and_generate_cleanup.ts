import { getDb } from './server/utils/firebase.js';

async function main() {
  const db = getDb();
  console.log("Fetching recent messages using Admin SDK...");
  const msgSnap = await db.collection('messages').orderBy('timestamp', 'desc').limit(200).get();
  const messages = msgSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log(`Analyzing ${messages.length} messages for duplicates...`);

  const duplicates = [];
  const processed = new Set();
  const duplicateIds = new Set();

  for (const m1 of messages) {
     if (processed.has(m1.id)) continue;
     const sim = messages.filter(m2 => {
         if (m1.id === m2.id) return false;
         if (m1.from !== m2.from) return false;
         if (m1.text !== m2.text) return false;
         
         const t1 = m1.timestamp?.toDate ? m1.timestamp.toDate() : (m1.timestamp?._seconds ? new Date(m1.timestamp._seconds * 1000) : null);
         const t2 = m2.timestamp?.toDate ? m2.timestamp.toDate() : (m2.timestamp?._seconds ? new Date(m2.timestamp._seconds * 1000) : null);
         
         if (t1 && t2) {
             const diff = Math.abs(t1.getTime() - t2.getTime());
             if (diff < 1000 * 60 * 60 * 2) return true; // within 2 hours
         }
         return false;
     });

     if (sim.length > 0) {
        processed.add(m1.id);
        const allSim = [m1, ...sim].sort((a,b) => {
            const tA = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : a.timestamp?._seconds * 1000 || 0;
            const tB = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : b.timestamp?._seconds * 1000 || 0;
            return tA - tB;
        });

        duplicates.push(allSim);
        for(let i=1; i<allSim.length; i++) {
            processed.add(allSim[i].id);
            duplicateIds.add(allSim[i].id);
        }
     }
  }

  console.log(`Found ${duplicates.length} sets of duplicated messages.`);
  console.log(`Total duplicate documents to delete: ${duplicateIds.size}`);
  
  if (duplicates.length > 0) {
      console.log('Sample duplicate set:');
      console.log(duplicates[0].map(d => ({ id: d.id, text: d.text, from: d.from })));
  }
  
  // Cleanup script logic
  let cleanupScript = `
import { getDb } from './server/utils/firebase.js';
import fs from "fs";

async function runCleanup() {
  const db = getDb();
  const duplicateIds = ${JSON.stringify(Array.from(duplicateIds), null, 2)};
  
  if (duplicateIds.length === 0) {
      console.log("No duplicates to clean up.");
      return;
  }

  let count = 0;
  for (const id of duplicateIds) {
      console.log('Deleting duplicate message:', id);
      await db.collection('messages').doc(id).delete();
      count++;
  }
  
  console.log('Cleanup complete! Deleted ' + count + ' duplicates.');
}

runCleanup().catch(console.error);
`;
  
  const fs = require('fs');
  fs.writeFileSync('cleanup_duplicates.ts', cleanupScript);
  console.log('Generated cleanup script: cleanup_duplicates.ts');
  process.exit(0);
}
main().catch(console.error);
