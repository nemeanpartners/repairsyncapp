import { Router } from 'express';
import express from 'express';
import { getFirestore, collection, query, where, getDocs, updateDoc as firestoreUpdateDoc, setDoc as firestoreSetDoc, doc, serverTimestamp, addDoc as firestoreAddDoc, getDoc } from 'firebase/firestore';
import { getDb } from '../utils/firebase.js';
import { xero, getXeroEngine } from '../services/xero.js';

async function updateDoc(ref: any, data: any) { return firestoreUpdateDoc(ref, { uid: 'api-server', ...data }); }
async function setDoc(ref: any, data: any, options?: any) { return firestoreSetDoc(ref, { uid: 'api-server', ...data }, options || {}); }
async function addDoc(col: any, data: any) { return firestoreAddDoc(col, { uid: 'api-server', ...data }); }

export const xeroRouter = Router();

// Endpoint to manually run the Sync Queue processing on demand
xeroRouter.post('/api/xero/sync/process', async (req, res) => {
  try {
    const engine = getXeroEngine();
    if (!engine) {
      return res.status(500).json({ error: "Xero Engine not initialized on server" });
    }
    // Process both the recurring contracts and the Xero queues for instant updates
    await engine.processHireContracts();
    await engine.processQueue();
    res.json({ success: true, message: "Contracts and queue processed successfully" });
  } catch (e: any) {
    console.error("[XeroRoute] Manual queue trigger failed:", e);
    res.status(500).json({ error: e.message });
  }
});

xeroRouter.get('/api/xero/status', async (req, res) => {
  try {
    const db = getDb();
    const snap = await getDoc(doc(db, 'crm_integrations', 'xero'));
    if (snap.exists()) {
      res.json({ status: 'active' });
    } else {
      res.json({ status: 'inactive' });
    }
  } catch (e) {
    res.json({ status: 'inactive' });
  }
});

// --- Xero ---
xeroRouter.get('/api/auth/xero/url', async (req, res) => {
   try {
     // Update config just in case env vars changed
     xero.config.clientId = (process.env.XERO_CLIENT_ID || '').trim();
     xero.config.clientSecret = (process.env.XERO_CLIENT_SECRET || '').trim();
     xero.config.redirectUris = [process.env.XERO_REDIRECT_URI || `https://${req.headers.host}/api/auth/xero/callback`];
     xero.config.scopes = (process.env.XERO_SCOPES || 'openid profile email accounting.invoices accounting.contacts offline_access').split(' ');
     
     await xero.initialize(); // Ensure Xero client is fully built
     res.json({ url: await xero.buildConsentUrl() }); 
   } catch (e: any) { res.status(500).json({ error: e.message }); }
});

xeroRouter.get('/api/auth/xero/callback', async (req, res) => {
  try {
    const db = getDb();
    const fullUrl = `https://${req.headers.host}${req.url}`;
    console.log('Xero Callback URL:', fullUrl);
    console.log('Xero Client Config ID:', process.env.XERO_CLIENT_ID ? `${process.env.XERO_CLIENT_ID.substring(0, 5)}...` : 'MISSING');
    console.log('Xero Config Secret length:', process.env.XERO_CLIENT_SECRET?.length || 0);
    
    // Update config just in case env vars changed
    xero.config.clientId = (process.env.XERO_CLIENT_ID || '').trim();
    xero.config.clientSecret = (process.env.XERO_CLIENT_SECRET || '').trim();
    xero.config.redirectUris = [process.env.XERO_REDIRECT_URI || `https://${req.headers.host}/api/auth/xero/callback`];
    xero.config.scopes = (process.env.XERO_SCOPES || 'openid profile email accounting.invoices accounting.contacts offline_access').split(' ');
    
    await xero.initialize(); // Ensure Xero client is fully built
    
    const tokenSet = await xero.apiCallback(fullUrl);
    await xero.updateTenants(false);
    
    if (!xero.tenants || xero.tenants.length === 0) {
        console.error("Xero: No tenants found after auth!");
        return res.status(500).send('No Xero tenants found. Please connect an organization.');
    }
    
    await setDoc(doc(db, 'crm_integrations', 'xero'), { 
      tokenSet: JSON.parse(JSON.stringify(tokenSet)), 
      tenantId: xero.tenants[0].tenantId, 
      updated_at: serverTimestamp() 
    });
    res.send(`<html><body><script>window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', integration: 'xero' }, '*'); window.close();</script></body></html>`);
  } catch (e: any) {
    console.error('Xero auth failed:', e);
    res.status(500).send(`Auth Failed: ${e.message} - Please try again, or check server logs.`);
  }
});

xeroRouter.post('/api/xero/sync/customer', async (req, res) => {
  try {
    const db = getDb();
    const { customerId } = req.body;
    if (!customerId) return res.status(400).send("customerId is required");
    
    const jobRef = await addDoc(collection(db, 'xero_sync_queue'), {
      entity_type: 'CUSTOMER',
      entity_id: customerId,
      operation: 'CREATE',
      status: 'PENDING',
      attempts: 0,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp()
    });
    res.json({ success: true, jobId: jobRef.id });
  } catch (e: any) { res.status(500).send(e.message); }
});

xeroRouter.post('/api/xero/sync/invoice', async (req, res) => {
  try {
    // Disabled as per user request: only End Of Day totals are synced to Xero now
    res.json({ success: true, message: "Individual invoice sync is disabled." });
  } catch (e: any) { res.status(500).send(e.message); }
});

xeroRouter.post('/api/xero/sync/payment', async (req, res) => {
  try {
    // Disabled as per user request: only End Of Day totals are synced to Xero now
    res.json({ success: true, message: "Individual payment sync is disabled." });
  } catch (e: any) { res.status(500).send(e.message); }
});

xeroRouter.post('/api/xero/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    console.log('Xero Webhook received!');
    res.status(200).send();
    
    // const signature = req.headers['x-xero-signature'];
    const rawBody = req.body.toString('utf8');
    const payload = JSON.parse(rawBody);
    const db = getDb();
    
    if (!payload.events) return;
    
    for (const event of payload.events) {
      if (event.eventCategory === 'INVOICE' && event.eventType === 'UPDATE') {
        const invQ = query(collection(db, 'invoices'), where('xero_invoice_id', '==', event.resourceId));
        const invSnap = await getDocs(invQ);
        if (!invSnap.empty) {
          const localInv = invSnap.docs[0];
          await updateDoc(localInv.ref, {
             updated_from_webhook_at: serverTimestamp()
          });
          console.log(`[Webhook] Updated local invoice mapped to Xero ${event.resourceId}`);
        }
      }
    }
  } catch (e) {
    console.error("Xero Webhook Processing Error", e);
  }
});
