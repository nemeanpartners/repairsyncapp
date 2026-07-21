import { Router } from 'express';
import express from 'express';
import { getFirestore, collection, query, limit, getDocs, doc, getDoc, updateDoc, addDoc, where, runTransaction, arrayUnion } from 'firebase/firestore';
import { getDb } from '../utils/firebase.js';
import { normalizePhone } from '../utils/phone.js';
import { botAuth } from '../middleware/botAuth.js';
import { updateConversationMetadata } from '../services/messaging.js';

export const botRouter = Router();

botRouter.get('/api/bot/health', (req, res) => res.json({ status: 'ok', message: 'RepairSync Bot API is active' }));

botRouter.get('/api/bot/customers/search', botAuth, async (req, res) => {
    try {
      const db = getDb();
      const q = String(req.query.q || '').trim().toLowerCase();
      if (!q) return res.status(400).json({ error: "query parameter 'q' is required" });

      const snap = await getDocs(query(collection(db, 'crm_customers'), limit(1000)));
      const qNorm = normalizePhone(q) || q;
      
      const results = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter((c: any) => {
        const fullName = `${c.firstname || ''} ${c.lastname || ''}`.toLowerCase();
        const phoneStr = c.phone ? String(c.phone) : '';
        const mobileStr = c.mobile ? String(c.mobile) : '';
        const emailStr = c.email ? String(c.email).toLowerCase() : '';
        return fullName.includes(q) || emailStr.includes(q) || 
               (phoneStr && normalizePhone(phoneStr).includes(qNorm)) ||
               (mobileStr && normalizePhone(mobileStr).includes(qNorm));
      });

      res.json({ success: true, customers: results.slice(0, 10) });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
});

botRouter.post('/api/bot/tickets', botAuth, express.json(), async (req, res) => {
    try {
      const db = getDb();
      const { phone, customerName, device_model, issue, status, isDraft, email } = req.body;
      if (!phone && !email) return res.status(400).json({ error: "phone or email is required" });
      
      const sanitizedPhone = phone ? normalizePhone(String(phone)) : null;
      
      let customerId = '';
      let customerData: any = null;

      if (sanitizedPhone) {
        const custResp = await getDocs(query(collection(db, 'crm_customers'), where('phone', '==', sanitizedPhone), limit(1)));
        if (!custResp.empty) {
          customerId = custResp.docs[0].id;
          customerData = custResp.docs[0].data();
        }
      }

      if (!customerId && email) {
        const custResp = await getDocs(query(collection(db, 'crm_customers'), where('email', '==', String(email).toLowerCase()), limit(1)));
        if (!custResp.empty) {
          customerId = custResp.docs[0].id;
          customerData = custResp.docs[0].data();
        }
      }

      if (!customerId) {
        const newCustRef = await addDoc(collection(db, 'crm_customers'), {
          phone: sanitizedPhone || '',
          email: email || '',
          firstname: customerName || 'New Customer',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          source: 'Bot API'
        });
        customerId = newCustRef.id;
        customerData = { firstname: customerName || 'New Customer', phone: sanitizedPhone, email };
      }

      const ticketNumber = await runTransaction(db, async (transaction) => {
        const settingsRef = doc(db, 'settings', 'ticket_manager');
        const settingsDoc = await transaction.get(settingsRef);
        let currentNumber = 40000;
        if (settingsDoc.exists() && settingsDoc.data().startNumber) {
           currentNumber = parseInt(settingsDoc.data().startNumber, 10);
           if (isNaN(currentNumber)) currentNumber = 40000;
        }
        transaction.set(settingsRef, {
           startNumber: (currentNumber + 1).toString()
        }, { merge: true });
        return currentNumber;
      });

      const ticketData = {
        customer_id: customerId,
        customer_name: `${customerData.firstname || ''} ${customerData.lastname || ''}`.trim() || customerName || 'Customer',
        number: ticketNumber,
        subject: issue || (device_model ? `Repair: ${device_model}` : 'New Ticket from AI Bot'),
        device_model: device_model || '',
        status: status || (isDraft ? 'Draft' : 'New'),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        source: 'Bot API',
        notes: [{
          text: `Ticket created via AI Bot. Initial issue: ${issue || 'No details provided.'}`,
          created_at: new Date().toISOString(),
          source: 'System'
        }]
      };

      const ticketRef = await addDoc(collection(db, 'crm_tickets'), ticketData);

      await updateDoc(doc(db, 'crm_customers', customerId), {
        tickets: arrayUnion({ id: ticketRef.id, number: ticketNumber, subject: ticketData.subject, status: ticketData.status })
      });

      if (sanitizedPhone) {
        await updateConversationMetadata(customerId, sanitizedPhone, ticketData.customer_name, String(ticketNumber), 'outbound', `Repair booking confirmed: Job #${ticketNumber}`);
      }

      res.status(201).json({ 
        success: true, 
        ticketId: ticketRef.id, 
        ticketNumber: ticketNumber, 
        customerId,
        message: isDraft ? "Draft job created" : "Ticket created successfully"
      });
    } catch (e: any) {
      console.error('[Bot API] Ticket Creation Error:', e);
      res.status(500).json({ error: e.message });
    }
});

botRouter.get('/api/bot/tickets/status', botAuth, async (req, res) => {
    try {
      const db = getDb();
      const { phone, ticketNumber, email } = req.query;
      
      if (ticketNumber) {
         const tResp = await getDocs(query(collection(db, 'crm_tickets'), where('number', '==', Number(ticketNumber))));
         if (tResp.empty) return res.status(404).json({ error: "Ticket not found" });
         const tkts = tResp.docs.map(d => ({ id: d.id, ...d.data() }));
         return res.json({ success: true, tickets: tkts });
      }

      let customerIds: string[] = [];
      if (phone) {
        const sanitizedPhone = normalizePhone(String(phone));
        const custResp = await getDocs(query(collection(db, 'crm_customers'), where('phone', '==', sanitizedPhone)));
        customerIds.push(...custResp.docs.map(d => d.id));
      }
      if (email && customerIds.length === 0) {
        const custResp = await getDocs(query(collection(db, 'crm_customers'), where('email', '==', String(email).toLowerCase())));
        customerIds.push(...custResp.docs.map(d => d.id));
      }

      if (customerIds.length === 0) return res.json({ success: true, tickets: [] });

      let tickets: any[] = [];
      for (const cid of Array.from(new Set(customerIds))) {
        const tickResp = await getDocs(query(collection(db, 'crm_tickets'), where('customer_id', '==', cid)));
        tickResp.docs.forEach(d => tickets.push({ id: d.id, ...d.data() }));
      }
      
      tickets.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      res.json({ success: true, tickets: tickets.slice(0, 5) });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
});

botRouter.post('/api/bot/tickets/:id/notes', botAuth, express.json(), async (req, res) => {
    try {
      const db = getDb();
      const ticketId = req.params.id;
      const { note } = req.body;
      if (!note) return res.status(400).json({ error: "note is required" });
      
      const ticketRef = doc(db, 'crm_tickets', ticketId);
      const ticketDoc = await getDoc(ticketRef);
      if (!ticketDoc.exists()) return res.status(404).json({ error: "ticket not found" });

      await updateDoc(ticketRef, {
        notes: arrayUnion({
          text: note,
          created_at: new Date().toISOString(),
          source: 'Bot API'
        }),
        updated_at: new Date().toISOString()
      });

      res.json({ success: true, message: "Note added" });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
});
