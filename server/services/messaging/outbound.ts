import axios from 'axios';
import { collection, query, where, getDocs, getDoc, doc, addDoc, serverTimestamp } from 'firebase/firestore';
import { getDb } from '../../utils/firebase.js';
import { normalizePhone } from '../../utils/phone.js';
import { updateConversationMetadata } from './metadata.js';

async function shortenUrl(url: string): Promise<string> {
  try {
    const res = await axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`, { timeout: 4000 });
    if (res.data && typeof res.data === 'string' && res.data.startsWith('http')) {
      return res.data.trim();
    }
  } catch (err) {
    console.error(`[SMS Shortener] Failed to shorten URL ${url}:`, err);
  }
  return url;
}

export async function shortenUrlsInMessage(message: string): Promise<string> {
  const urlRegex = /https?:\/\/[^\s]+/g;
  const urls = message.match(urlRegex);
  if (!urls) return message;

  let shortenedMessage = message;
  for (const url of urls) {
    if (
      url.includes('/s/') ||
      url.includes('/estimate/') ||
      url.includes('/invoice/') ||
      url.includes('/status/') ||
      url.includes('/payments/')
    ) {
      const short = await shortenUrl(url);
      shortenedMessage = shortenedMessage.replace(url, short);
    }
  }
  return shortenedMessage;
}

export async function sendMobileMessage(to: string, message: string, ticket_id: any, custom_ref: any, customer_id?: any) {
  try {
    message = await shortenUrlsInMessage(message);
  } catch (err) {
    console.error('[SMS Shortener] Error in message URL shortening:', err);
  }

  const db = getDb();
  let customerId = customer_id || null;
  let customerName = null;
  let ticketNumber = null;

  if (db && customerId) {
     try {
       const cDoc = await getDoc(doc(db, 'crm_customers', String(customerId)));
       if (cDoc.exists()) {
          const c = cDoc.data();
          customerName = c.fullname || `${c.firstname || ''} ${c.lastname || ''}`.trim();
       }
     } catch (e) {}
  }


  if (db && ticket_id) {
    try {
      const ticketSnap = await getDocs(query(collection(db, 'crm_tickets'), where('id', '==', String(ticket_id))));
      if (!ticketSnap.empty) {
        const tData = ticketSnap.docs[0].data();
        customerId = tData.customer_id;
        customerName = tData.customer_name;
        ticketNumber = tData.number;
      } else {
        const tDoc = await getDoc(doc(db, 'crm_tickets', String(ticket_id)));
        if (tDoc.exists()) {
          const tData = tDoc.data();
          customerId = tData.customer_id;
          customerName = tData.customer_name;
          ticketNumber = tData.number;
        }
      }
    } catch (e) {
      console.error('[SMS Service] Failed to resolve ticket/customer info', e);
    }
  }

  if (db && !customerId) {
    try {
      const normalizedTo = normalizePhone(to);
      const custSnap = await getDocs(collection(db, 'crm_customers'));
      custSnap.forEach(d => {
        const c = d.data();
        const cPhone = normalizePhone(c.phone || '');
        const cMobile = normalizePhone(c.mobile || '');
        const cCell = normalizePhone(c.cell || '');
        if (cPhone === normalizedTo || cMobile === normalizedTo || cCell === normalizedTo) {
          customerId = d.id;
          customerName = c.fullname || c.business_then_name || `${c.firstname || ''} ${c.lastname || ''}`.trim();
        }
      });
    } catch (e) {
      console.error('[SMS Service] Failed to resolve customer by phone', e);
    }
  }

  const username = (process.env.MOBILE_MESSAGE_USERNAME || '').trim();
  const password = (process.env.MOBILE_MESSAGE_PASSWORD || '').trim();
  const senderId = (process.env.MOBILE_MESSAGE_SENDER_ID || '').trim();
  const subdomain = (process.env.REPAIRSHOPR_SUBDOMAIN || '').trim();
  const apiKey = (process.env.REPAIRSHOPR_API_KEY || '').trim();

  let mobileMessageError = null;
  let repairShoprError = null;

  // 1. Mobile Message direct API
  if (username && password) {
    const normalizedTo = normalizePhone(to);
    const authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');

    const methods = [
      async (num: string) => {
        const payload: any = { to: num, message: message };
        if (senderId) payload.sender = senderId;
        if (custom_ref) payload.custom_ref = custom_ref;
        return axios.post('https://api.mobilemessage.com.au/v1/messages', { messages: [payload] }, {
          headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' }
        });
      },
      async (num: string) => {
        const params = new URLSearchParams({ api_username: username, api_password: password, to: num, message: message });
        if (senderId) params.append('sender', senderId);
        if (custom_ref) params.append('custom_ref', custom_ref);
        return axios.get(`https://api.mobilemessage.com.au/simple/send-sms.php?${params.toString()}`);
      }
    ];

    const formatsToTry = Array.from(new Set([
      normalizedTo,
      normalizedTo.startsWith('+61') ? '0' + normalizedTo.substring(3) : normalizedTo,
      normalizedTo.startsWith('0') ? '+61' + normalizedTo.substring(1) : normalizedTo,
      normalizedTo.replace('+', '')
    ])).filter(f => f.length >= 8);

    let mobileMessageSuccess = false;

    for (let i = 0; i < methods.length; i++) {
      for (const fmt of formatsToTry) {
        if (mobileMessageSuccess) break;
        try {
          console.log(`[SMS Service] Trying Mobile Message Strategy ${i + 1} for ${fmt}...`);
          const response = await methods[i](fmt);

          if (response.data && response.data.results && response.data.results[0]?.status === 'error') {
            throw new Error(response.data.results[0].error);
          }
          if (response.data && response.data.status === 'error') {
            throw new Error(response.data.error || 'Unknown error');
          }
          if (typeof response.data === 'string' && response.data.toLowerCase().includes('error')) {
            throw new Error(response.data);
          }

          console.log(`[SMS Service] Mobile Message Success (Strategy ${i + 1} format ${fmt})`);
          mobileMessageSuccess = true;

          if (db) {
            try {
              let msgEventId = undefined;
              if (!custom_ref) {
                const newDocRef = await addDoc(collection(db, 'messages'), {
                  from: 'system',
                  to: fmt,
                  text: message,
                  timestamp: serverTimestamp(),
                  status: 'sent',
                  type: 'outbound',
                  customerId,
                  customerName,
                  ticketId: ticket_id || null,
                  external_id: response.data.message_id || response.data.id || (response.data.results && response.data.results[0]?.message_id) || null,
                  ticketNumber: ticketNumber || null,
                  uid: 'api-server',
                });
                msgEventId = newDocRef.id;
              }
              await updateConversationMetadata(customerId, fmt, customerName, ticketNumber, 'outbound', message, msgEventId);
            } catch (fsErr) {
              console.error('[SMS Service] Firestore persistence error:', fsErr);
            }
          }

          return response.data;
        } catch (err: any) {
          const errMsg = err.response?.data?.error?.description || err.response?.data?.error || err.response?.data?.message || err.message;
          mobileMessageError = errMsg;
          console.error(`[SMS Service] Strategy ${i + 1} on ${fmt} failed:`, String(errMsg).substring(0, 150));
        }
      }
    }
  }

  // 2. Fallback to RepairShopr
  if (subdomain && apiKey) {
    try {
      let cleanSubdomain = subdomain.replace(/^https?:\/\//, '').split('/')[0].split('.')[0];
      console.log(`[SMS Service] Trying RepairShopr Fallback for ${to} (${cleanSubdomain})`);

      const formats = [to];
      const digits = to.replace(/\D/g, '');
      if (digits.startsWith('614') && digits.length === 11) {
        formats.push('0' + digits.substring(2));
      }

      const endpoints = [
        `/api/v1/sms/send`,
        `/api/v1/sms/send_message`,
        ticket_id ? `/api/v1/tickets/${ticket_id}/send_sms` : null
      ].filter(Boolean) as string[];

      let lastErr = null;
      for (const phone of formats) {
        for (const endpoint of endpoints) {
          try {
            console.log(`[SMS Service] Trying RS Endpoint ${endpoint} with ${phone}`);
            const rsRes = await axios.post(`https://${cleanSubdomain}.repairshopr.com${endpoint}`, {
              to: phone,
              message: message,
              body: message,
              ticket_id: ticket_id
            }, {
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Api-Key': apiKey
              }
            });

            if (rsRes.data.success === false) {
              throw new Error(rsRes.data.message || 'RS Logical failure');
            }

            console.log(`[SMS Service] RepairShopr Success with ${endpoint}`);

            if (db) {
              try {
                let msgEventId = undefined;
                if (!custom_ref) {
                  const newDocRef = await addDoc(collection(db, 'messages'), {
                    from: 'system',
                    to: normalizePhone(to),
                    text: message,
                    timestamp: serverTimestamp(),
                    status: 'delivered',
                    type: 'outbound',
                    customerId,
                    customerName,
                    ticketId: ticket_id || null,
                    ticketNumber: ticketNumber || null,
                    uid: 'api-server',
                  });
                  msgEventId = newDocRef.id;
                }
                await updateConversationMetadata(customerId, to, customerName, ticketNumber, 'outbound', message, msgEventId);
              } catch (fsErr) {
                console.error('[SMS Service] Firestore persistence error:', fsErr);
              }
            }

            return rsRes.data;
          } catch (inner: any) {
            lastErr = inner.response?.data || inner.message;
            if (inner.response?.status === 404) continue;
            break;
          }
        }
      }
      repairShoprError = lastErr;
    } catch (err: any) {
      repairShoprError = err.message;
    }
  }

  let finalMessage = 'SMS Delivery Failed';
  if (mobileMessageError && String(mobileMessageError).includes('401')) {
    finalMessage = 'Mobile Message: Invalid Username or Password (401 Unauthorized). Please check credentials in AI Studio Secrets.';
  }

  throw new Error(JSON.stringify({
    error: finalMessage,
    mobileMessageError,
    repairShoprError: typeof repairShoprError === 'string' && repairShoprError.includes('<!DOCTYPE html>') ? 'RepairShopr 404/Restricted' : repairShoprError
  }));
}
