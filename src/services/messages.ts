import axios from "axios";
import { collection, doc, writeBatch, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { ChatMessage } from "../stores/messages";
import { ConversationEngine } from "./conversations";
import { useConversationsStore } from "../stores/conversations";

export interface SendMessageParams {
  to: string;
  text: string;
  customerId?: string | null;
  customerName?: string | null;
  ticketNumber?: string | null;
  isInternal?: boolean;
}

export class MessagesService {
  /**
   * Orchestrates the outbound message flow:
   * 1. Optimistic insert is handled in the Store level before call.
   * 2. This service is responsible for making the API call, updating metadata atomically,
   *    and reporting delivery/error status triggers.
   */
  static async sendSmsMessage(
    params: SendMessageParams,
    optimisticMessageId: string,
    onSuccess: (remoteMsgId: string, transport: string) => void,
    onFailure: (errMessage: string) => void
  ) {
    const { to, text, customerId, customerName, ticketNumber, isInternal } = params;

    try {
      // 1. Fire transport send
      const payload = {
        to,
        message: text,
        customerId: customerId || null,
        customerName: customerName || null,
        ticket_id: ticketNumber || null,
        isInternal: !!isInternal,
        custom_ref: optimisticMessageId
      };

      const response = await axios.post("/api/mobilemessage/send", payload);
      
      const remoteMsgId = response.data.messageId || optimisticMessageId;
      const transport = response.data.transport || "sms";

      // 2. Perform Atomic Firestore write for the Conversation and Message Status.
      // Doing this with a batch ensures high availability and enterprise scale.
      const batch = writeBatch(db);

      // Create/Update conversation metadata document atomically in `/conversations` collection
      let clean = to.replace(/[^\d]/g, "");
      if (clean.startsWith("6104") && clean.length >= 11) {
        clean = "61" + clean.substring(2);
      } else if (clean.startsWith("04") && clean.length === 10) {
        clean = "61" + clean.substring(1);
      } else if (clean.startsWith("4") && clean.length === 9) {
        clean = "61" + clean;
      }
      const threadId = clean;
      const convRef = doc(db, "conversations", threadId);
      
      // We calculate new conversation details optimistically
      const timestamp = new Date();
      const currentConv = useConversationsStore.getState().conversations.find(c => c.conversationId === threadId) || {};
      
      const updatedConv = ConversationEngine.processNewMessage(
        {
          ...currentConv,
          customerId,
          customerName,
          phone: to,
          ticketNumber,
        },
        {
          text,
          direction: "outbound",
          phone: to,
          customerId,
          customerName,
          ticketNumber,
          timestamp,
        }
      );

      // Write metadata to `/conversations`
      batch.set(convRef, {
        customerId: updatedConv.customerId,
        customerName: updatedConv.customerName,
        phone: updatedConv.phone,
        lastMessageAt: serverTimestamp(),
        lastMessagePreview: updatedConv.lastMessagePreview,
        lastMessageDirection: updatedConv.lastMessageDirection,
        lastMessageStatus: "sent",
        unreadCount: updatedConv.unreadCount,
        labels: updatedConv.labels,
        updatedAt: serverTimestamp(),
        isUnread: updatedConv.isUnread,
        isYourTurn: updatedConv.isYourTurn,
        isUrgent: updatedConv.isUrgent,
        isArchived: updatedConv.isArchived,
        ticketNumber: updatedConv.ticketNumber || null,
      }, { merge: true });

      // Write the optimistic message confirmation
      const msgRef = doc(db, "messages", optimisticMessageId);
      batch.set(msgRef, {
        from: "system-agent",
        to,
        text,
        timestamp: serverTimestamp(),
        status: "sent",
        type: "outbound",
        customerId: customerId || null,
        customerName: customerName || null,
        isRCS: transport === "rcs",
        isInternal: !!isInternal,
        uid: "api-client",
      }, { merge: true });

      // Commit transaction
      await batch.commit();

      // Trigger success event
      onSuccess(remoteMsgId, transport);
    } catch (err: any) {
      console.error("[MessagesService Send Failed]", err);
      const errMsg = err.response?.data?.error || err.message || "Unknown delivery failure";
      onFailure(errMsg);
    }
  }
}
