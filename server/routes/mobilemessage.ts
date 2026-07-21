import { Router } from 'express';
import axios from 'axios';
import { getDb } from '../utils/firebase.js';
import { normalizePhone } from '../utils/phone.js';
import {
  sendMobileMessage,
  getMobileMessageBalance,
  syncMobileMessages,
  processInboundWebhook
} from '../services/messaging.js';
import { doc, getDocs, collection, query, where, limit, updateDoc } from 'firebase/firestore';

export const mobileMessageRouter = Router();

export { normalizePhone };

mobileMessageRouter.get('/api/mobilemessage/shorten', async (req, res) => {
  const { url } = req.query;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: "Missing 'url' query parameter" });
  }

  try {
    const response = await axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`, { timeout: 4000 });
    if (response.data && typeof response.data === 'string' && response.data.startsWith('http')) {
      return res.json({ shortUrl: response.data.trim() });
    }
    return res.status(500).json({ error: "Invalid response from shortener service" });
  } catch (err: any) {
    console.error(`[Server Shortener] Failed to shorten URL ${url}:`, err);
    return res.status(500).json({ error: err.message || "Failed to shorten URL" });
  }
});

mobileMessageRouter.post('/api/mobilemessage/send', async (req, res) => {
  const isGuest = req.headers['x-is-guest'] === 'true';
  if (isGuest) {
    return res.status(200).json({ success: true, message: "Blocked in demo mode.", mock: true });
  }

  const { to, message, ticket_id, custom_ref, customer_id } = req.body;
  if (!to || !message) {
    return res.status(400).json({ error: "Missing parameters 'to' or 'message'" });
  }

  try {
    const result = await sendMobileMessage(to, message, ticket_id, custom_ref, customer_id);
    res.json(result);
  } catch (error: any) {
    try {
      const parsed = JSON.parse(error.message);
      res.status(500).json(parsed);
    } catch {
      res.status(500).json({ error: error.message });
    }
  }
});

mobileMessageRouter.get('/api/mobilemessage/balance', async (req, res) => {
  try {
    const balance = await getMobileMessageBalance();
    res.json(balance);
  } catch (error: any) {
    if (error.message?.includes('Rate exceeded') || error.status === 429) {
      return res.status(429).json({ error: 'Rate exceeded. Please wait.' });
    }
    res.status(500).json({ error: error.message });
  }
});

mobileMessageRouter.post('/api/mobilemessage/sync', async (req, res) => {
  try {
    const result = await syncMobileMessages();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

mobileMessageRouter.all('/api/webhooks/mobilemessage', async (req, res) => {
  try {
    const payload = Object.keys(req.body).length > 0 ? req.body : req.query;
    await processInboundWebhook(payload);
    res.status(200).send('OK');
  } catch (error: any) {
    console.error('[Webhooks] Inbound message webhook error:', error);
    res.status(200).send('OK');
  }
});

mobileMessageRouter.all('/api/webhooks/mobilemessage/status', async (req, res) => {
  const db = getDb();
  if (!db) return res.status(200).send('OK');

  try {
    const payload = Object.keys(req.body).length > 0 ? req.body : req.query;
    let statusesToUpdate: { custom_ref: string | null; message_id?: string; status: string }[] = [];

    if (payload.messages && Array.isArray(payload.messages) && payload.messages.length > 0) {
      payload.messages.forEach((msg: any) => {
        if (msg.custom_ref && msg.status) {
          statusesToUpdate.push({ custom_ref: msg.custom_ref, message_id: msg.message_id || msg.id, status: msg.status });
        } else if ((msg.message_id || msg.id) && msg.status) {
          statusesToUpdate.push({ custom_ref: null, message_id: msg.message_id || msg.id, status: msg.status });
        }
      });
    } else {
      const { custom_ref, status, message_id, id } = payload;
      if (custom_ref && status) {
        statusesToUpdate.push({ custom_ref, message_id: message_id || id, status });
      } else if ((message_id || id) && status) {
        statusesToUpdate.push({ custom_ref: null, message_id: message_id || id, status });
      }
    }

    
    for (const update of statusesToUpdate) {
      try {
        if (update.custom_ref) {
          await updateDoc(doc(db, 'messages', update.custom_ref), { status: update.status });
        } else if (update.message_id) {
          const q = query(collection(db, 'messages'), where('external_id', '==', update.message_id), limit(1));
          const snap = await getDocs(q);
          if (!snap.empty) {
            await updateDoc(doc(db, 'messages', snap.docs[0].id), { status: update.status });
          }
        }
      } catch (err) {
        console.error('Failed to update status webhook for ref:', update.custom_ref || update.message_id);
      }
    }

    res.status(200).send('OK');
  } catch (error: any) {
    console.error('[Webhooks] Status webhook error:', error);
    res.status(200).send('OK');
  }
});
