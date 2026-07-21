import { Router } from "express";
import { collection, getDocs, doc, deleteDoc, query, orderBy, limit } from "firebase/firestore";
import { getDb } from "../utils/firebase.js";

const router = Router();

router.get("/api/scan-duplicates", async (req, res) => {
  try {
    const db = getDb();
    console.log("Fetching recent messages...");
    const msgSnap = await getDocs(query(collection(db, 'messages'), orderBy('timestamp', 'desc'), limit(1500)));
    const messages = msgSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
    console.log(`Analyzing ${messages.length} messages for duplicates...`);

    const duplicates = [];
    const processed = new Set();
    const duplicateIds = new Set();

    for (const m1 of messages) {
       if (processed.has(m1.id)) continue;
       if (!m1.from || !m1.text) continue;
       const sim = messages.filter(m2 => {
           if (m1.id === m2.id) return false;
           if (m1.from !== m2.from) return false;
           if (m1.text !== m2.text) return false;
           
           const t1 = m1.timestamp?.toDate ? m1.timestamp.toDate() : (m1.timestamp?.seconds ? new Date(m1.timestamp.seconds * 1000) : (m1.timestamp ? new Date(m1.timestamp) : null));
           const t2 = m2.timestamp?.toDate ? m2.timestamp.toDate() : (m2.timestamp?.seconds ? new Date(m2.timestamp.seconds * 1000) : (m2.timestamp ? new Date(m2.timestamp) : null));
           
           if (t1 && t2) {
               const diff = Math.abs(t1.getTime() - t2.getTime());
               if (diff < 1000 * 60 * 60 * 24) return true; // within 24 hours
           }
           return false;
       });

       if (sim.length >= 1) { // We found one or more duplicate! Wait, the log said THREE-TIME duplication
          processed.add(m1.id);
          const allSim = [m1, ...sim].sort((a,b) => {
              const tA = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : a.timestamp?.seconds * 1000 || (a.timestamp ? new Date(a.timestamp).getTime() : 0);
              const tB = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : b.timestamp?.seconds * 1000 || (b.timestamp ? new Date(b.timestamp).getTime() : 0);
              return tA - tB;
          });

          duplicates.push(allSim.map(m => ({ id: m.id, from: m.from, text: m.text })));
          for(let i=1; i<allSim.length; i++) {
              processed.add(allSim[i].id);
              duplicateIds.add(allSim[i].id);
          }
       }
    }

    res.json({
        totalAnalyzed: messages.length,
        setsOfDuplicatesFound: duplicates.length,
        duplicateIdsToDelete: Array.from(duplicateIds),
        sampleDuplicates: duplicates,
    });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/api/cleanup-duplicates", async (req, res) => {
    try {
        const { duplicateIds } = req.body;
        if (!duplicateIds || !Array.isArray(duplicateIds)) {
            return res.status(400).json({ error: "Missing duplicateIds array in request body" });
        }
        
        console.log(`Deleting ${duplicateIds.length} duplicate messages...`);
        const db = getDb();
        let deletedCount = 0;
        
        for (const id of duplicateIds) {
            console.log(`Deleting duplicate: ${id}`);
            await deleteDoc(doc(db, 'messages', id));
            deletedCount++;
        }
        
        res.json({ message: "Cleanup complete", deletedCount });
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

export { router as scanRouter };
