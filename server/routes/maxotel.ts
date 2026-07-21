import { Router } from 'express';
import axios from 'axios';
import fs from 'fs';
import { collection, query, where, getDocs, doc, addDoc, serverTimestamp, runTransaction, limit, orderBy } from 'firebase/firestore';
import { getDb } from '../utils/firebase.js';
import { normalizePhone } from './mobilemessage.js'; // Assuming we export it

export const maxotelRouter = Router();

maxotelRouter.all('/api/webhooks/maxotel', async (req, res) => {
    const db = getDb();
    try {
      const payload = Object.keys(req.body).length > 0 ? req.body : req.query;

      await (async () => {
        try {
          const from = payload.CallerID || payload.caller_id || payload.from || payload.Source;
          const to = payload.CalledNumber || payload.called_number || payload.to || payload.DialledNumber || payload.Destination;
          const duration = payload.Duration || payload.duration || '0';
          const status = payload.CallStatus || payload.status || 'Completed';
          
          if (!from || !to) return;

          const normalizedFrom = normalizePhone(from);
          const normalizedTo = normalizePhone(to);
          const localFormatFrom = from.startsWith('61') ? '0' + from.substring(2) : (from.startsWith('0') ? from : from);
          const localFormatTo = to.startsWith('61') ? '0' + to.substring(2) : (to.startsWith('0') ? to : to);
          
          const direction = (normalizedTo.includes('33681772') || normalizedTo.includes('0733681772')) ? 'inbound' : 'outbound';
          const subdomain = process.env.REPAIRSHOPR_SUBDOMAIN;
          const apiKey = process.env.REPAIRSHOPR_API_KEY;

          let customerId = null;
          let customerName = null;
          let ticketIdLog = null;
          let ticketNumberLog = null;

          // Search CRM
          try {
            const queries = [
              getDocs(query(collection(db, 'crm_customers'), where('phone', '==', localFormatFrom), limit(1))),
              getDocs(query(collection(db, 'crm_customers'), where('mobile', '==', localFormatFrom), limit(1))),
              getDocs(query(collection(db, 'crm_customers'), where('cell', '==', localFormatFrom), limit(1))),
              getDocs(query(collection(db, 'crm_customers'), where('phone', '==', normalizedFrom), limit(1))),
              getDocs(query(collection(db, 'crm_customers'), where('mobile', '==', normalizedFrom), limit(1))),
              getDocs(query(collection(db, 'crm_customers'), where('cell', '==', normalizedFrom), limit(1)))
            ];
            const results = await Promise.all(queries);
            for (const snap of results) {
              if (!snap.empty) {
                const d = snap.docs[0];
                const c = d.data();
                customerId = d.id;
                customerName = c.fullname || `${c.firstname || ''} ${c.lastname || ''}`.trim();
                break;
              }
            }

            if (customerId) {
              const q = query(collection(db, 'crm_tickets'), where('customer_id', '==', customerId));
              const crmTickSnap = await getDocs(q);
              const crmTickets = crmTickSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => {
                const aT = a.created_at?.seconds || 0;
                const bT = b.created_at?.seconds || 0;
                return bT - aT;
              });
              if (crmTickets.length > 0) {
                const active: any = crmTickets.find((t: any) => t.status !== 'Resolved' && t.status !== 'Completed') || crmTickets[0];
                ticketIdLog = active.id;
                ticketNumberLog = active.number;
              }
            }
          } catch (e) {
            console.error('[Webhooks] CRM search error:', e);
          }

          // Fallback RepairShopr
          if (!customerId && subdomain && apiKey) {
            try {
               // Add simple deduplication to avoid creating double call logs if webhook fires multiple times
               const maxotelCallId = payload.CallID || payload.call_id || payload.CallId || null;
               if (maxotelCallId) {
                 const idempotencyRef = doc(db, 'webhook_idempotency', `maxotel_call_${maxotelCallId}`);
                 try {
                   await runTransaction(db, async (txn) => {
                     const snap = await txn.get(idempotencyRef);
                     if (snap.exists()) {
                       throw new Error('ALREADY_PROCESSED');
                     }
                     txn.set(idempotencyRef, { processedAt: serverTimestamp(), type: 'maxotel_call' });
                   });
                 } catch (err: any) {
                   if (err.message === 'ALREADY_PROCESSED') {
                     console.log(`[Webhooks] Ignored duplicate Maxotel call webhook for CallID: ${maxotelCallId}`);
                     return;
                   }
                   throw err;
                 }
               } else {
                 const recentLogSnap = await getDocs(query(collection(db, 'call_logs'), where('phone', '==', direction === 'inbound' ? localFormatFrom : localFormatTo), orderBy('timestamp', 'desc'), limit(10)));
                 let isDuplicate = false;
                 recentLogSnap.forEach(d => {
                    const data = d.data();
                    const dbTime = data.timestamp?.toDate ? data.timestamp.toDate() : new Date((data.timestamp?.seconds || 0) * 1000);
                    if (Date.now() - dbTime.getTime() < 60000) isDuplicate = true;
                 });
                 if (isDuplicate) return;
               }

              const rsCustRes = await axios.get(`https://${subdomain}.repairshopr.com/api/v1/customers`, {
                params: { query: direction === 'inbound' ? localFormatFrom : localFormatTo },
                headers: { 'Authorization': `Bearer ${apiKey}` }
              });
              const customers = rsCustRes.data.customers || [];
              if (customers.length > 0) {
                const customer = customers[0];
                customerId = String(customer.id);
                customerName = customer.fullname || `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
                const rsTicksRes = await axios.get(`https://${subdomain}.repairshopr.com/api/v1/tickets`, {
                  params: { customer_id: customerId },
                  headers: { 'Authorization': `Bearer ${apiKey}` }
                });
                const tickets = rsTicksRes.data.tickets || [];
                if (tickets.length > 0) {
                  const active = tickets.find((t: any) => t.status !== 'Resolved') || tickets[0];
                  ticketIdLog = String(active.id);
                  ticketNumberLog = active.number;
                }
              }
            } catch (e) {}
          }

          if (customerId) {
            await addDoc(collection(db, 'messages'), {
              from: localFormatFrom,
              to: localFormatTo,
              text: `📞 **${direction === 'inbound' ? 'Inbound' : 'Outbound'} Call**\nStatus: ${status}\nDuration: ${duration}s`,
              timestamp: serverTimestamp(),
              status: 'delivered', 
              type: direction,
              isCall: true,
              isWebhook: true,
              uid: 'webhook',
              customerId,
              customerName,
              ticketId: ticketIdLog,
              ticketNumber: ticketNumberLog
            });
            fs.appendFileSync('maxotel.log', `Saved Call for ${customerName} - Ticket: ${ticketNumberLog}\n`);
          }

          await addDoc(collection(db, 'call_logs'), {
            customerName: customerName || 'Unknown Caller',
            phoneNumber: direction === 'inbound' ? localFormatFrom : localFormatTo,
            direction: direction === 'inbound' ? 'Incoming' : 'Outgoing',
            status: status || 'Answered',
            notes: `Maxotel Call Duration: ${duration}s`,
            timestamp: serverTimestamp(),
            createdAt: serverTimestamp(),
            userId: 'system'
          });
        } catch (innerErr) {
          console.error('[Webhooks] MaxoTel Async Error:', innerErr);
        }
      })();

      if (!res.headersSent) res.status(200).send('OK');
    } catch (error: any) {
      if (!res.headersSent) res.status(200).send('OK');
    }
  });

  

maxotelRouter.get('/api/maxotel/calls', async (req, res) => {
    const db = getDb();
    try {
      const { startTime, endTime } = req.query;
      const apiKey = process.env.MAXOTEL_API_KEY;
      if (!apiKey) {
        return res.status(400).json({ error: 'MAXOTEL_API_KEY is not configured' });
      }
      
      const maxotelUrl = `https://myapi.maxo.com.au/calls/list/?key=${apiKey}&startTime=${encodeURIComponent(startTime as string)}&endTime=${encodeURIComponent(endTime as string)}&outputFormat=json`;
      const response = await axios.get(maxotelUrl);
      res.json(response.data);
    } catch (err: any) {
      console.error('Error fetching maxotel calls:', err.response?.data || err.message);
      res.status(500).json({ error: 'Failed to fetch maxotel calls' });
    }
  });

  
