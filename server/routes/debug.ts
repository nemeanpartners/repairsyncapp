import { Router } from 'express';
import { getDb } from '../utils/firebase.js';
import { collection, getDocs, getDoc, doc, limit, query } from 'firebase/firestore';
import fs from 'fs';

export const debugRouter = Router();

// --- Debug ---
  debugRouter.get('/api/debug/crm-customers', async (req, res) => {
    try {
      const q = req.query.id;
      if (q) {
          const docSnap = await getDoc(doc(getDb(), 'crm_customers', String(q)));
          return res.json([{ id: docSnap.id, ...docSnap.data() }]);
      }
      const snap = await getDocs(query(collection(getDb(), 'crm_customers'), limit(2)));
      const results: any[] = [];
      snap.forEach(d => results.push({ id: d.id, ...d.data() }));
      res.json(results);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  debugRouter.get('/api/debug/crm-tickets', async (req, res) => {
    try {
      const db = getDb();
      const [snap1, snap2] = await Promise.all([
         getDocs(query(collection(db, 'tickets'), limit(10))),
         getDocs(query(collection(db, 'crm_tickets'), limit(10)))
      ]);
      const results: any = { tickets: [], crm_tickets: [] };
      snap1.forEach(d => results.tickets.push({ id: d.id, ...d.data() }));
      snap2.forEach(d => results.crm_tickets.push({ id: d.id, ...d.data() }));

      res.json(results);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  debugRouter.get('/api/debug/logs', (req, res) => {
    try { res.send(`<pre>${fs.readFileSync('maxotel.log', 'utf8')}</pre>`); } catch (e) { res.send('No logs'); }
  });