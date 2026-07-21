import axios from 'axios';
import { collection, query, where, getDocs, doc, addDoc, serverTimestamp, runTransaction, updateDoc, limit, orderBy } from 'firebase/firestore';
import { getDb } from '../../utils/firebase.js';
import { normalizePhone } from '../../utils/phone.js';
import { updateConversationMetadata } from './metadata.js';

export async function syncMobileMessages() {
  const db = getDb();
  if (!db) throw new Error('Firestore not configured');

  const username = process.env.MOBILE_MESSAGE_USERNAME;
  const password = process.env.MOBILE_MESSAGE_PASSWORD;
  if (!username || !password) throw new Error('Config missing');

  const authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  let offset = 0;
  const limitCount = 100;
  let hasMore = true;
  let syncedCount = 0;
  let processedIds = new Set();

  const crmMap = new Map();
  const crmCustSnap = await getDocs(collection(db, 'crm_customers'));
  crmCustSnap.forEach(d => {
    const c = d.data();
    const fullname = c.fullname || c.business_then_name || `${c.firstname || ''} ${c.lastname || ''}`.trim();
    const pPhone = normalizePhone(c.phone || '');
    const pMobile = normalizePhone(c.mobile || '');
    const pCell = normalizePhone(c.cell || '');
    if (pPhone) crmMap.set(pPhone, { id: d.id, name: fullname });
    if (pMobile) crmMap.set(pMobile, { id: d.id, name: fullname });
    if (pCell) crmMap.set(pCell, { id: d.id, name: fullname });
  });

  // 1. Sync Inbound
  while (hasMore) {
    const response = await axios.get('https://api.mobilemessage.com.au/v1/inbound', {
      headers: { 'Authorization': authHeader },
      params: { offset, limit: limitCount }
    });

    const messages = response.data.results || [];
    if (messages.length === 0) {
      hasMore = false;
      break;
    }

    let shouldStop = false;

    await Promise.all(messages.map(async (msg: any) => {
      if (processedIds.has(msg.message_id)) return;
      processedIds.add(msg.message_id);

      const from = msg.from;
      const text = msg.message || '';
      const attachmentUrl = msg.media_url || msg.image_url || msg.media || (msg.attachments && msg.attachments[0]?.url) || null;
      const timestampStr = msg.received_at;

      if (!from || (!text && !attachmentUrl) || !timestampStr) return;

      const timestamp = new Date(timestampStr.replace(' ', 'T') + 'Z');
      if (timestamp < thirtyDaysAgo) {
        shouldStop = true;
        return;
      }

      const normalizedFrom = normalizePhone(from);
      const localFormatFrom = from.startsWith('61') ? '0' + from.substring(2) : from;

      let customerId = null;
      let customerName = null;

      const matchedCrm = crmMap.get(normalizedFrom);
      if (matchedCrm) {
        customerId = matchedCrm.id;
        customerName = matchedCrm.name;
      }

      const possibleFroms = Array.from(new Set([localFormatFrom, normalizedFrom, '+' + normalizedFrom].filter(Boolean)));
      let isDuplicate = false;
      if (possibleFroms.length > 0) {
        const existingQ = query(collection(db, 'messages'), where('from', 'in', possibleFroms), where('type', '==', 'inbound'));
        const existingDocs = await getDocs(existingQ);

        existingDocs.forEach(doc => {
          const data = doc.data();
          const dbText = (data.text || '').replace(/\s+/g, '').toLowerCase();
          const msgText = (text || '').replace(/\s+/g, '').toLowerCase();
          if (dbText === msgText || (msgText.length > 5 && dbText.includes(msgText.substring(0, 20)))) {
            const dbTime = data.timestamp?.toDate ? data.timestamp.toDate() : new Date((data.timestamp?.seconds || 0) * 1000);
            if (Math.abs(dbTime.getTime() - timestamp.getTime()) < 24 * 60 * 60 * 1000) {
              isDuplicate = true;
            }
          }
        });
      }

      if (!isDuplicate) {
        const docRef = await addDoc(collection(db, 'messages'), {
          from: localFormatFrom,
          to: 'system',
          text,
          attachmentUrl: attachmentUrl || null,
          attachmentType: attachmentUrl ? 'image/jpeg' : null,
          timestamp,
          status: 'received',
          type: 'inbound',
          customerId,
          customerName,
          uid: 'api-sync',
          isUnread: true,
        });
        const msgEventId = docRef.id;
        let previewText = text;
        if (!previewText && attachmentUrl) previewText = "📎 Attachment";
        await updateConversationMetadata(customerId, localFormatFrom, customerName, null, 'inbound', previewText, msgEventId);
        syncedCount++;
      }
    }));

    if (shouldStop) break;
    offset += limitCount;
    if (offset > 2000) break;
  }

  return { success: true, syncedCount, lookedAt: offset };
}

export async function processInboundWebhook(payload: any) {
  const db = getDb();
  if (!db) return;

  let sender, text, toField, attachmentUrl;
  if (payload.messages && Array.isArray(payload.messages) && payload.messages.length > 0) {
    const msg = payload.messages[0];
    sender = msg.from || msg.sender || msg.source;
    text = msg.message || msg.text || msg.content || '';
    toField = msg.to || msg.destination || '';
    attachmentUrl = msg.media_url || msg.image_url || msg.media || (msg.attachments && msg.attachments[0]?.url) || null;
  } else {
    sender = payload.sender || payload.from || payload.From || payload.source || payload.Source;
    text = payload.message || payload.text || payload.Message || payload.content || payload.Content || '';
    toField = payload.to || payload.destination || '';
    attachmentUrl = payload.media_url || payload.image_url || payload.media || (payload.attachments && payload.attachments[0]?.url) || null;
  }

  if (!sender || (!text && !attachmentUrl)) {
    console.warn('[Webhooks] Incomplete inbound schema:', JSON.stringify(payload));
    return;
  }

  console.log(`[Webhooks] Processing inbound payload:`, JSON.stringify(payload));
  console.log(`[Webhooks] Extracted SMS -> Sender: ${sender}, Text: "${text}", URL: ${attachmentUrl}`);

  const normalizedFrom = normalizePhone(sender);
  const localFormatFrom = sender.startsWith('61') ? '0' + sender.substring(2) : sender;
  console.log(`[Webhooks] Formatted phone numbers -> normalizedFrom: ${normalizedFrom}, localFormatFrom: ${localFormatFrom}`);
  const subdomain = process.env.REPAIRSHOPR_SUBDOMAIN;
  const apiKey = process.env.REPAIRSHOPR_API_KEY;

  // Additional content-based deduplication to prevent retries inserting duplicate records
  // Webhooks often retry within 2-3 minutes if our server is slow or if they drop the connection.
  try {
    const recentQ = query(
      collection(db, 'messages'),
      orderBy('timestamp', 'desc'),
      limit(50)
    );
    const recentDocs = await getDocs(recentQ);
    let isDupe = false;
    recentDocs.forEach(d => {
      const data = d.data();
      if (data.from === localFormatFrom && data.type === 'inbound') {
        const dbText = (data.text || '').replace(/\s+/g, '').toLowerCase();
        const msgText = (text || '').replace(/\s+/g, '').toLowerCase();
        if (dbText === msgText || (msgText.length > 5 && dbText.includes(msgText.substring(0, 20)))) {
          const dbTime = data.timestamp?.toDate ? data.timestamp.toDate() : new Date((data.timestamp?.seconds || 0) * 1000);
          // If exact message received within the last 30 minutes, consider it a duplicate webhook retry
          if (Date.now() - dbTime.getTime() < 30 * 60 * 1000) {
            isDupe = true;
          }
        }
      }
    });

    if (isDupe) {
      console.log(`[Webhooks] Ignored duplicate SMS webhook via content match for: ${localFormatFrom}`);
      return;
    }
  } catch(e) {
    console.error('Error during content deduplication:', e);
  }

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
        customerName = c.fullname || c.business_then_name || `${c.firstname || ''} ${c.lastname || ''}`.trim();
        break;
      }
    }

    // Robust fallback: fetch and check normalized phone numbers if direct query missed
    if (!customerId) {
      console.log(`[Webhooks] Exact query missed. Trying robust normalized fallback...`);
      const crmCustSnap = await getDocs(collection(db, 'crm_customers'));
      for (const d of crmCustSnap.docs) {
        const c = d.data();
        const pPhone = normalizePhone(c.phone || '');
        const pMobile = normalizePhone(c.mobile || '');
        const pCell = normalizePhone(c.cell || '');
        
        if (
          (pPhone && (pPhone === normalizedFrom || pPhone === localFormatFrom)) ||
          (pMobile && (pMobile === normalizedFrom || pMobile === localFormatFrom)) ||
          (pCell && (pCell === normalizedFrom || pCell === localFormatFrom))
        ) {
          customerId = d.id;
          customerName = c.fullname || c.business_then_name || `${c.firstname || ''} ${c.lastname || ''}`.trim();
          console.log(`[Webhooks] Robust fallback matched: ${customerName} (${customerId})`);
          break;
        }
      }
    }

    if (customerId) {
      const q = query(collection(db, 'crm_tickets'), where('customer_id', '==', customerId));
      const crmTickSnap = await getDocs(q);
      const crmTickets = crmTickSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => {
        const timeA = a.created_at?.seconds ? a.created_at.seconds * 1000 : new Date(a.created_at || 0).getTime();
        const timeB = b.created_at?.seconds ? b.created_at.seconds * 1000 : new Date(b.created_at || 0).getTime();
        return timeB - timeA;
      });
      if (crmTickets.length > 0) {
        const active: any = crmTickets.find((t: any) => t.status !== 'Resolved' && t.status !== 'Completed') || crmTickets[0];
        ticketIdLog = active.id;
        ticketNumberLog = active.number;
        console.log(`[Webhooks] Found ticket -> ID: ${ticketIdLog}, Number: ${ticketNumberLog}, Status: ${active.status}`);
      }
    }
  } catch (e) {
    console.error('[Webhooks] CRM search error:', e);
  }

  console.log(`[Webhooks] CRM match result -> Customer ID: ${customerId}, Customer Name: ${customerName}, Ticket ID: ${ticketIdLog}, Ticket Number: ${ticketNumberLog}`);

  // Fallback RS lookup
  if (!customerId && subdomain && apiKey) {
    try {
      const rsCustRes = await axios.get(`https://${subdomain}.repairshopr.com/api/v1/customers`, {
        params: { query: localFormatFrom },
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      const customers = rsCustRes.data.customers || [];
      if (customers.length > 0) {
        const customer = customers[0];
        customerId = String(customer.id);
        customerName = customer.fullname || `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
      }
    } catch (e) {}
  }

  // Deduplicate using Webhook Idempotency
  let originalMessageId = payload.message_id || payload.id || payload.messageId || payload.MessageId;
  if (payload.messages && payload.messages[0]) {
    originalMessageId = payload.messages[0].message_id || payload.messages[0].id;
  }

  if (originalMessageId) {
    const idempotencyRef = doc(db, 'webhook_idempotency', String(originalMessageId));
    try {
      await runTransaction(db, async (txn) => {
        const snap = await txn.get(idempotencyRef);
        if (snap.exists()) throw new Error('ALREADY_PROCESSED');
        txn.set(idempotencyRef, { processedAt: serverTimestamp(), type: 'sms_inbound' });
      });
    } catch (err: any) {
      if (err.message === 'ALREADY_PROCESSED') {
        console.log(`[Webhooks] Ignored duplicate SMS webhook for messageId: ${originalMessageId}`);
        return;
      }
      throw err;
    }
  }

  const docRef = await addDoc(collection(db, 'messages'), {
    from: localFormatFrom,
    to: toField,
    text,
    attachmentUrl: attachmentUrl || null,
    attachmentType: attachmentUrl ? 'image/jpeg' : null,
    timestamp: serverTimestamp(),
    status: 'delivered',
    type: 'inbound',
    isWebhook: true,
    uid: 'webhook',
    customerId,
    customerName,
    ticketId: ticketIdLog,
    ticketNumber: ticketNumberLog,
  });
  const msgEventId = docRef.id;

  let previewText = text;
  if (!previewText && attachmentUrl) previewText = "📎 Attachment";
  await updateConversationMetadata(customerId, localFormatFrom, customerName, ticketNumberLog, 'inbound', previewText, msgEventId);

  if (ticketIdLog) {
    try {
      let isApproval = false;
      let isRejection = false;
      const lowerText = (text || "").trim().toLowerCase();
      const approvalPhrases = ['yes', 'approve', 'approved', 'go ahead', 'do it', 'proceed'];
      const rejectionPhrases = ['no', 'reject', 'rejected', 'don\'t', 'do not', 'cancel'];

      if (approvalPhrases.includes(lowerText) || lowerText.startsWith('yes ') || lowerText.startsWith('yes,')) {
        isApproval = true;
      } else if (rejectionPhrases.includes(lowerText) || lowerText.startsWith('no ') || lowerText.startsWith('no,')) {
        isRejection = true;
      }

      console.log(`[Webhooks] Ticket automation -> TicketId: ${ticketIdLog}, isApproval: ${isApproval}, isRejection: ${isRejection}, lowerText: "${lowerText}"`);

      if (isApproval) {
        // Find a pending estimate for this ticket
        const estQ = query(collection(db, 'estimates'), where('ticket_id', '==', ticketIdLog));
        const estSnap = await getDocs(estQ);
        
        // Also check crm_estimates as fallback
        const crmEstQ = query(collection(db, 'crm_estimates'), where('ticket_id', '==', ticketIdLog));
        const crmEstSnap = await getDocs(crmEstQ);

        const allEstDocs = [...estSnap.docs, ...crmEstSnap.docs];
        const pendingEstDocs = allEstDocs.filter(d => {
          const s = (d.data().status || '').toLowerCase();
          return s === 'pending' || s === 'draft';
        });

        console.log(`[Webhooks] Checked pending estimates for ${ticketIdLog}, found ${pendingEstDocs.length}`);
        
        if (pendingEstDocs.length > 0) {
          const estDoc = pendingEstDocs[0];
          const colName = estDoc.ref.parent.id; // 'estimates' or 'crm_estimates'
          
          await updateDoc(doc(db, colName, estDoc.id), {
            status: "approved",
            updated_at: new Date().toISOString()
          });

          // Also try to update the other collection just in case
          const otherCol = colName === 'estimates' ? 'crm_estimates' : 'estimates';
          try {
            await updateDoc(doc(db, otherCol, estDoc.id), {
              status: "approved",
              updated_at: new Date().toISOString()
            });
          } catch(e) {}

          const estimateData = estDoc.data();
          
          if (estimateData.line_items && Array.isArray(estimateData.line_items)) {
            for (const item of estimateData.line_items) {
              await addDoc(collection(db, "crm_line_items"), {
                ticket_id: ticketIdLog,
                name: item.name || item.description || "Estimate Charge",
                price: Number(item.unit_price || item.unit_amount || item.price || 0),
                quantity: Number(item.quantity || 1),
                created_at: serverTimestamp(),
                uid: 'system',
              });
            }
          }

          // Create notification for staff
          try {
             await addDoc(collection(db, "notifications"), {
               title: "Estimate Approved",
               message: `Customer approved estimate ${estimateData.estimate_number || estDoc.id} for ticket ${ticketNumberLog || ticketIdLog}.`,
               type: "estimate_approved",
               ticketId: ticketIdLog,
               isRead: false,
               createdAt: serverTimestamp()
             });
          } catch (e) {
             console.error("[Webhooks] Failed to create notification", e);
          }

          await addDoc(collection(db, "crm_notes"), {
            ticket_id: ticketIdLog,
            body: `Customer replied "${text}" via SMS. Automatically approved estimate ${estimateData.estimate_number || estDoc.id} and added line items.`,
            subject: "Estimate Approved via SMS",
            tech: "System Automation",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

          await updateDoc(doc(db, 'crm_tickets', ticketIdLog), {
            status: 'Waiting for Parts',
            updated_at: serverTimestamp(),
          });
        } else {
          // No pending estimate, just update ticket status directly
          await addDoc(collection(db, "crm_notes"), {
            ticket_id: ticketIdLog,
            body: `Customer replied "${text}" via SMS indicating approval.`,
            subject: "Approval Received via SMS",
            tech: "System Automation",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

          // Create notification for staff
          try {
             await addDoc(collection(db, "notifications"), {
               title: "SMS Approval Received",
               message: `Customer replied "yes" for ticket ${ticketNumberLog || ticketIdLog}.`,
               type: "sms_approved",
               ticketId: ticketIdLog,
               isRead: false,
               createdAt: serverTimestamp()
             });
          } catch (e) {
             console.error("[Webhooks] Failed to create notification", e);
          }

          await updateDoc(doc(db, 'crm_tickets', ticketIdLog), {
            status: 'Waiting for Parts',
            updated_at: serverTimestamp(),
          });
        }
      } else if (isRejection) {
        await addDoc(collection(db, "crm_notes"), {
          ticket_id: ticketIdLog,
          body: `Customer replied "${text}" via SMS indicating rejection.`,
          subject: "Rejection Received via SMS",
          tech: "System Automation",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        // Create notification for staff
        try {
           await addDoc(collection(db, "notifications"), {
             title: "SMS Rejection Received",
             message: `Customer replied "no" for ticket ${ticketNumberLog || ticketIdLog}.`,
             type: "sms_rejected",
             ticketId: ticketIdLog,
             isRead: false,
             createdAt: serverTimestamp()
           });
        } catch (e) {
           console.error("[Webhooks] Failed to create notification", e);
        }

        await updateDoc(doc(db, 'crm_tickets', ticketIdLog), {
          status: 'Declined',
          updated_at: serverTimestamp(),
        });
      } else {
        await updateDoc(doc(db, 'crm_tickets', ticketIdLog), {
          status: 'Your Turn',
          updated_at: serverTimestamp(),
        });
      }
    } catch (fsErr) {
      console.error('[Webhooks] Failed to update ticket status on inbound:', fsErr);
    }
  }
}
