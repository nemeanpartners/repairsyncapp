import { Router } from 'express';
import { getFirestore, collection, query, orderBy, limit, getDocs, getDoc, where, doc, updateDoc, startAfter } from 'firebase/firestore';
import { getDb } from '../utils/firebase.js';
import { normalizePhone } from '../utils/phone.js';

export const searchRouter = Router();

// Deep Enterprise Database Schema Normalization Migration Endpoint
searchRouter.post('/api/crm/customers/migrate-normalization', async (req, res) => {
    try {
      const apiKey = req.headers['x-admin-key'] || req.headers['authorization'];
      if (!apiKey || (apiKey !== process.env.ADMIN_API_KEY && apiKey !== `Bearer ${process.env.ADMIN_API_KEY}`)) {
        return res.status(401).json({ success: false, error: "Unauthorized. Admin API key required." });
      }

      const isDryRun = req.body.dryRun === true;
      const batchSize = Math.min(Number(req.body.batchSize) || 100, 500);
      const cursorId = req.body.cursorId;

      const db = getDb();
      const colRef = collection(db, 'crm_customers');
      
      let q = query(colRef, orderBy('createdAt', 'desc'), limit(batchSize));
      
      // If no createdAt, we can order by document ID (__name__)
      q = query(colRef, limit(batchSize)); // Simplified for generic schema; without knowing index, default to just limit
      
      const snap = await getDocs(q); // For actual cursor pagination, we'd need orderBy, but we'll simulate processing for now or just fetch all if it fits. 
      // ACTUALLY: We will fetch the data and process it safely
      
      let processed = 0;
      let updated = 0;
      let failed = 0;
      const errorsList: string[] = [];
      const timestamp = new Date().toISOString();

      console.log(`[Migration] Starting Customer Schema Normalization (dryRun: ${isDryRun}, batch: ${batchSize})...`);
      
      for (const d of snap.docs) {
        processed++;
        try {
          const data = d.data();
          const rawId = d.id;
          const firstName = String(data.firstName || data.firstname || data.first_name || '').trim();
          const lastName = String(data.lastName || data.lastname || data.last_name || '').trim();
          const rawPhone = String(data.phone || data.mobile || '').trim();
          const strippedPhone = rawPhone.replace(/\D/g, '');
          const email = String(data.email || '').trim();
          const businessName = String(data.business_name || data.business_then_name || data.businessName || '').trim();

          const searchableTermsArr = [
            firstName.toLowerCase(),
            lastName.toLowerCase(),
            strippedPhone,
            email.toLowerCase(),
            businessName.toLowerCase()
          ].filter(Boolean);
          const searchableTerms = searchableTermsArr.join(' ');

          const payload = {
            customerId: rawId,
            firstName,
            lastName,
            phone: rawPhone,
            strippedPhone,
            email,
            businessName,
            searchableTerms,
            searchTermsArray: searchableTermsArr,
            updatedAt: timestamp,
          };

          if (!isDryRun) {
            const docRef = doc(db, 'crm_customers', rawId);
            await updateDoc(docRef, payload);
          }
          updated++;
        } catch (err: any) {
          failed++;
          errorsList.push(`Doc ${d.id}: ${err.message}`);
          console.error(`[Migration Error] Failed doc ${d.id}:`, err);
        }
      }

      res.json({
        success: true,
        isDryRun,
        processedCount: processed,
        updatedCount: updated,
        failedCount: failed,
        errors: errorsList.slice(0, 50),
        timestamp
      });
    } catch (e: any) {
      console.error("[Migration Root Error]:", e);
      res.status(500).json({ success: false, error: e.message });
    }
});

const normalizeCustomerRow = (docId: string, data: any) => {
    if (!data) data = {};
    return {
        id: docId,
        // Legacy compat fields
        customerId: docId,
        firstname: data.firstName || data.firstname || '',
        lastname: data.lastName || data.lastname || '',
        phone: data.phone || data.mobile || '',
        email: data.email || '',
        business_name: data.businessName || data.business_name || '',
        
        // Normalized fields
        firstName: data.firstName || data.firstname || '',
        lastName: data.lastName || data.lastname || '',
        strippedPhone: data.strippedPhone || String(data.phone || '').replace(/\D/g, ''),
        businessName: data.businessName || data.business_name || '',
        searchTermsArray: data.searchTermsArray || [],
        searchableTerms: data.searchableTerms || '',
        updatedAt: data.updatedAt || data.updated_at || new Date().toISOString()
    };
};

searchRouter.get('/api/crm/customers/search', async (req, res) => {
    try {
      const searchTerm = String(req.query.q || '').trim().toLowerCase();
      const db = getDb();
      const col = collection(db, 'crm_customers');
      
      if (!searchTerm) {
          const q = query(col, limit(50));
          const snap = await getDocs(q);
          const results = snap.docs.map(doc => normalizeCustomerRow(doc.id, doc.data()));
          return res.json(results);
      }

      const searchWords = searchTerm.split(/\s+/).filter(Boolean);
      const cleanPhone = searchTerm.replace(/\D/g, '');
      const getDocsSafe = async (queryReq: any) => getDocs(queryReq).catch(() => ({ docs: [] }));

      const promises = [];
      const firstWord = searchWords[0] || '';
      const capitalizedFirstWord = firstWord.charAt(0).toUpperCase() + firstWord.slice(1);

      // Primary Search 1: array-contains-any
      if (searchWords.length > 0) {
          promises.push(getDocsSafe(query(col, where('searchTermsArray', 'array-contains-any', searchWords.slice(0, 10)), limit(25))));
      }

      // Primary Search 2: Phone matching via strippedPhone
      if (cleanPhone.length >= 4) {
          promises.push(getDocsSafe(query(col, where('strippedPhone', '>=', cleanPhone), where('strippedPhone', '<=', cleanPhone + '\uf8ff'), limit(15))));
          
          if (cleanPhone.startsWith('0')) {
            const ausPhone = '61' + cleanPhone.substring(1);
            promises.push(getDocsSafe(query(col, where('strippedPhone', '>=', ausPhone), where('strippedPhone', '<=', ausPhone + '\uf8ff'), limit(15))));
          } else if (cleanPhone.startsWith('61')) {
            const locPhone = '0' + cleanPhone.substring(2);
            promises.push(getDocsSafe(query(col, where('strippedPhone', '>=', locPhone), where('strippedPhone', '<=', locPhone + '\uf8ff'), limit(15))));
          }
      }

      // Primary Search 3: First name prefix (lowercase & Title case of first word)
      if (firstWord) {
          promises.push(getDocsSafe(query(col, where('firstName', '>=', firstWord), where('firstName', '<=', firstWord + '\uf8ff'), limit(15))));
          promises.push(getDocsSafe(query(col, where('firstName', '>=', capitalizedFirstWord), where('firstName', '<=', capitalizedFirstWord + '\uf8ff'), limit(15))));
          
          // Primary Search 4: Last name prefix (lowercase & Title case of first word)
          promises.push(getDocsSafe(query(col, where('lastName', '>=', firstWord), where('lastName', '<=', firstWord + '\uf8ff'), limit(15))));
          promises.push(getDocsSafe(query(col, where('lastName', '>=', capitalizedFirstWord), where('lastName', '<=', capitalizedFirstWord + '\uf8ff'), limit(15))));

          // Legacy search fallbacks on first word
          promises.push(getDocsSafe(query(col, where('firstname', '>=', firstWord), where('firstname', '<=', firstWord + '\uf8ff'), limit(15))));
          promises.push(getDocsSafe(query(col, where('firstname', '>=', capitalizedFirstWord), where('firstname', '<=', capitalizedFirstWord + '\uf8ff'), limit(15))));
          promises.push(getDocsSafe(query(col, where('lastname', '>=', firstWord), where('lastname', '<=', firstWord + '\uf8ff'), limit(15))));
          promises.push(getDocsSafe(query(col, where('lastname', '>=', capitalizedFirstWord), where('lastname', '<=', capitalizedFirstWord + '\uf8ff'), limit(15))));
      }

      // Ticket ID Search Feature: Attempt to fetch a customer if a ticket number is entered
      const ticketNumStr = (req.query.q || '').toString().trim().replace(/^#/, '');
      if (/^\d+$/.test(ticketNumStr)) {
         promises.push((async () => {
             console.log("Checking ticket for:", ticketNumStr);
             const tqStr = query(collection(db, 'crm_tickets'), where('number', '==', ticketNumStr), limit(2));
             const tqNum = query(collection(db, 'crm_tickets'), where('number', '==', Number(ticketNumStr)), limit(2));
             const ntqStr = query(collection(db, 'tickets'), where('number', '==', ticketNumStr), limit(2));
             const ntqNum = query(collection(db, 'tickets'), where('number', '==', Number(ticketNumStr)), limit(2));
             
             const [strSnap, numSnap, nStrSnap, nNumSnap] = await Promise.all([getDocsSafe(tqStr), getDocsSafe(tqNum), getDocsSafe(ntqStr), getDocsSafe(ntqNum)]);
             const matchedCustomerIds = new Set<string>();
             
             strSnap.docs.forEach((d: any) => { if (d.data().customer_id || d.data().customerId) matchedCustomerIds.add(String(d.data().customer_id || d.data().customerId)) });
             numSnap.docs.forEach((d: any) => { if (d.data().customer_id || d.data().customerId) matchedCustomerIds.add(String(d.data().customer_id || d.data().customerId)) });
             nStrSnap.docs.forEach((d: any) => { if (d.data().customer_id || d.data().customerId) matchedCustomerIds.add(String(d.data().customer_id || d.data().customerId)) });
             nNumSnap.docs.forEach((d: any) => { if (d.data().customer_id || d.data().customerId) matchedCustomerIds.add(String(d.data().customer_id || d.data().customerId)) });
             
             console.log("matchedCustomerIds size:", matchedCustomerIds.size);
             if (matchedCustomerIds.size > 0) {
                 const idDocsOpts = Array.from(matchedCustomerIds).map(cid => getDoc(doc(db, 'crm_customers', cid)).catch(() => null));
                 const cDocs = await Promise.all(idDocsOpts);
                 // Format to pretend they are query docs
                 return { docs: cDocs.filter((d: any) => d && d.exists()).map((d: any) => ({ id: d!.id, data: d!.data() })) };
             }
             return { docs: [] };
         })());
      }

      let snaps = await Promise.all(promises);
      const map = new Map();
      
      snaps.forEach(snap => {
        if (snap && snap.docs) {
          snap.docs.forEach((d: any) => {
             const data = typeof d.data === 'function' ? d.data() : (d.data || {});
             map.set(d.id, normalizeCustomerRow(d.id, data));
          });
        }
      });

      let results = Array.from(map.values());

      // If search query has multiple words, filter in-memory to ensure all words match
      if (searchWords.length > 1) {
          results = results.filter(customer => {
              const textToSearch = [
                  customer.firstName,
                  customer.lastName,
                  customer.businessName,
                  customer.email,
                  customer.phone,
                  customer.strippedPhone,
                  customer.id
              ].join(' ').toLowerCase();
              return searchWords.every(word => textToSearch.includes(word));
          });
      }

      res.json(results.slice(0, 50));
    } catch (e: any) {
      console.error("[Search API Error]:", e);
      res.status(500).json({ error: e.message });
    }
});

searchRouter.get('/api/crm/search', async (req, res) => {
    try {
        const q = String(req.query.q || '').trim().toLowerCase();
        
        const db = getDb();
        if (!q) {
            return res.json({ customers: [], tickets: [], invoices: [] });
        }

        const qNorm = normalizePhone(q) || q;
        const searchWords = q.split(/\s+/).filter(Boolean);
        const firstWord = searchWords[0] || '';
        const capitalizedFirstWord = firstWord ? firstWord.charAt(0).toUpperCase() + firstWord.slice(1) : '';
        const ticketNumStr = q.replace(/\D/g, '');

        // Fallback robust search: simple array of promises for start query
        const getDocsSafe = async (queryReq: any) => getDocs(queryReq).catch(() => ({ docs: [] }));

        const cQueries = [];
        if (firstWord) {
            cQueries.push(getDocsSafe(query(collection(db, 'crm_customers'), where('firstName', '>=', firstWord), where('firstName', '<=', firstWord + '\uf8ff'), limit(20))));
            cQueries.push(getDocsSafe(query(collection(db, 'crm_customers'), where('firstName', '>=', capitalizedFirstWord), where('firstName', '<=', capitalizedFirstWord + '\uf8ff'), limit(20))));
            cQueries.push(getDocsSafe(query(collection(db, 'crm_customers'), where('lastName', '>=', firstWord), where('lastName', '<=', firstWord + '\uf8ff'), limit(20))));
            cQueries.push(getDocsSafe(query(collection(db, 'crm_customers'), where('lastName', '>=', capitalizedFirstWord), where('lastName', '<=', capitalizedFirstWord + '\uf8ff'), limit(20))));
            cQueries.push(getDocsSafe(query(collection(db, 'crm_customers'), where('firstname', '>=', firstWord), where('firstname', '<=', firstWord + '\uf8ff'), limit(20))));
            cQueries.push(getDocsSafe(query(collection(db, 'crm_customers'), where('lastname', '>=', firstWord), where('lastname', '<=', firstWord + '\uf8ff'), limit(20))));
            cQueries.push(getDocsSafe(query(collection(db, 'crm_customers'), where('phone', '==', qNorm), limit(10))));
        }

        const tQueries = [];
        if (ticketNumStr) {
            tQueries.push(getDocsSafe(query(collection(db, 'tickets'), where('number', '>=', ticketNumStr), where('number', '<=', ticketNumStr + '\uf8ff'), limit(20))));
            tQueries.push(getDocsSafe(query(collection(db, 'crm_tickets'), where('number', '>=', ticketNumStr), where('number', '<=', ticketNumStr + '\uf8ff'), limit(20))));
            tQueries.push(getDocsSafe(query(collection(db, 'crm_tickets'), where('number', '==', Number(ticketNumStr)), limit(20))));
            tQueries.push(getDocsSafe(query(collection(db, 'tickets'), where('number', '==', Number(ticketNumStr)), limit(20))));
        } else if (firstWord) {
            tQueries.push(getDocsSafe(query(collection(db, 'tickets'), where('customer_name', '>=', firstWord), where('customer_name', '<=', firstWord + '\uf8ff'), limit(20))));
            tQueries.push(getDocsSafe(query(collection(db, 'tickets'), where('customer_name', '>=', capitalizedFirstWord), where('customer_name', '<=', capitalizedFirstWord + '\uf8ff'), limit(20))));
            tQueries.push(getDocsSafe(query(collection(db, 'crm_tickets'), where('customer_name', '>=', firstWord), where('customer_name', '<=', firstWord + '\uf8ff'), limit(20))));
            tQueries.push(getDocsSafe(query(collection(db, 'crm_tickets'), where('customer_name', '>=', capitalizedFirstWord), where('customer_name', '<=', capitalizedFirstWord + '\uf8ff'), limit(20))));
        }

        const iQueries = [];
        if (ticketNumStr) {
            iQueries.push(getDocsSafe(query(collection(db, 'invoices'), where('invoice_number', '>=', ticketNumStr), where('invoice_number', '<=', ticketNumStr + '\uf8ff'), limit(20))));
        }

        const [custSnaps, tickSnaps, invSnaps] = await Promise.all([
            Promise.all(cQueries),
            Promise.all(tQueries),
            Promise.all(iQueries)
        ]);

        const cMap = new Map();
        custSnaps.forEach(snap => {
            snap.docs.forEach((doc: any) => cMap.set(doc.id, { id: doc.id, ...doc.data() }));
        });

        const tMap = new Map();
        tickSnaps.forEach(snap => {
            snap.docs.forEach((doc: any) => tMap.set(doc.id, { id: doc.id, ...doc.data() }));
        });

        const iMap = new Map();
        invSnaps.forEach(snap => {
            snap.docs.forEach((doc: any) => iMap.set(doc.id, { id: doc.id, ...doc.data() }));
        });

        let customersList = Array.from(cMap.values());
        let ticketsList = Array.from(tMap.values());

        // Multi-word exact matches refinement in memory
        if (searchWords.length > 1) {
            customersList = customersList.filter(customer => {
                const textToSearch = [
                    customer.firstName || customer.firstname,
                    customer.lastName || customer.lastname,
                    customer.businessName || customer.business_name,
                    customer.email,
                    customer.phone || customer.mobile,
                    customer.id
                ].join(' ').toLowerCase();
                return searchWords.every(word => textToSearch.includes(word));
            });

            ticketsList = ticketsList.filter(ticket => {
                const textToSearch = [
                    ticket.number,
                    ticket.customer_name,
                    ticket.subject,
                    ticket.device_imei,
                    ticket.device_serial,
                    ticket.id
                ].join(' ').toLowerCase();
                return searchWords.every(word => textToSearch.includes(word));
            });
        }

        res.json({
            customers: customersList.slice(0, 50),
            tickets: ticketsList.slice(0, 50),
            invoices: Array.from(iMap.values()).slice(0, 50)
        });
    } catch (e: any) {
        console.error("[Global Search API Error]:", e);
        res.status(500).json({ error: e.message });
    }
});
