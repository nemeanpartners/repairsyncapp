import { Router } from 'express';
import { getFirestore, collection, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getDb } from '../utils/firebase.js';
import { normalizePhone } from '../utils/phone.js';
import { updateConversationMetadata } from '../services/messaging.js';

export const messagingRouter = Router();

// --- Messaging Transport Abstraction API ---
messagingRouter.post('/api/messaging/send', async (req, res) => {
    try {
      const isGuest = req.headers['x-is-guest'] === 'true';
      if (isGuest) {
        return res.status(200).json({ success: true, message: "Blocked in demo mode.", mock: true });
      }
      
      const db = getDb();
      const { to, from, text, customerId, customerName, isInternal, skipDbWrite } = req.body;
      if (!to || !text) return res.status(400).json({ error: "Missing 'to' or 'text' parameters" });

      const transport = process.env.RCS_PROVIDER_API_KEY ? 'rcs' : 'sms';
      const actualFrom = process.env.RCS_PROVIDER_API_KEY ? "PhoneMedic Business" : (from || "system");
      
      const normalizedTo = normalizePhone(to);
      let messageDocRefId = req.body.messageId || 'external-auth';

      if (!skipDbWrite) {
        // Save to Firestore optimistically
        const messageDocRef = await addDoc(collection(db, 'messages'), {
          from: actualFrom,
          to: normalizedTo,
          text,
          timestamp: serverTimestamp(),
          status: 'sent',
          type: 'outbound',
          isRCS: transport === 'rcs',
          isInternal: !!isInternal,
          customerId: customerId || null,
          customerName: customerName || null,
          uid: 'api-messaging'
        });
        messageDocRefId = messageDocRef.id;

        // Update Conversation Tracking
        await updateConversationMetadata(customerId, normalizedTo, customerName, null, 'outbound', text);
      }

      // (Simulate / Route to actual provider here based on `transport` flag)
      if (transport === 'rcs') {
        // e.g. await sendGoogleRBM(normalizedTo, text);
        console.log(`[Messaging] Sent RCS to ${normalizedTo}`);
      } else {
        // Fallback to internal/Twilio SMS integration
        // e.g. await sendTwilioSms(normalizedTo, text);
        console.log(`[Messaging] Sent SMS to ${normalizedTo}`);
      }

      res.status(200).json({ 
        success: true, 
        messageId: messageDocRefId,
        transport 
      });
    } catch (error: any) {
      console.error("[Messaging Send Error]", error);
      res.status(500).json({ error: error.message });
    }
});

messagingRouter.post('/api/messaging/typing', async (req, res) => {
    // This allows the frontend to emit a typing event which a real WebSocket / Backend
    // would then proxy down to Twilio / RBM.
    const { to, isTyping } = req.body;
    console.log(`[Messaging Presence] User typing status for ${to} set to ${isTyping}`);
    res.status(200).json({ success: true });
});

// --- RCS Webhooks ---
messagingRouter.post('/api/webhooks/rcs/delivery', async (req, res) => {
    try {
      const db = getDb();
      // e.g., Twilio / RBM calls back this webhook
      const { messageId, status, error } = req.body;
      
      if (!messageId || !status) return res.status(400).send("Invalid Payload");

      // Verify Webhook Signature here (e.g. process.env.RCS_PROVIDER_WEBHOOK_SECRET)

      const docRef = doc(db, 'messages', messageId);
      await updateDoc(docRef, { status, error: error || null });

      res.status(200).send("OK");
    } catch (e: any) {
      console.error("[RCS Webhook Error]", e);
      res.status(500).send("Server Error");
    }
});
