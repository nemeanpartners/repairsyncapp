import { auth, db } from "../firebase";
import { collection, addDoc, serverTimestamp, doc, updateDoc } from "firebase/firestore";
import axios from "axios";
import { getActiveCompanyId } from "../lib/companyFirestore";

export interface SendMessageOptions {
  to: string;
  from?: string;
  text: string;
  customerId?: string | null;
  customerName?: string | null;
  isInternal?: boolean;
}

export interface WebhookEvent {
  messageId: string;
  status: "sent" | "delivered" | "read" | "failed";
  error?: string;
}

export class MessagingService {
  /**
   * Sends a message, automatically selecting RCS if capable, falling back to SMS.
   */
  static async sendMessage(options: SendMessageOptions) {
    try {
      // 1. Call backend to determine capability and send.
      // We do this via an API route which will talk to Twilio/Google RBM.
      // Alternatively, we save to Firestore to optimistically render, then the backend picks it up.
      
      const payload = {
        to: options.to,
        from: options.from || "system",
        message: options.text, // map 'text' prop to 'message' for the new mobilemessage route
        customerId: options.customerId,
        customerName: options.customerName,
        isInternal: options.isInternal || false,
      };

      const currentUser = auth.currentUser;
      const response = await axios.post("/api/mobilemessage/send", payload, {
        headers: {
          "x-company-id": getActiveCompanyId(),
          ...(currentUser?.uid ? { "x-user-id": currentUser.uid } : {}),
          ...(currentUser?.email ? { "x-user-email": currentUser.email } : {}),
        },
      });

      // The backend returns the newly created message ID and transport used
      return {
        success: true,
        messageId: response.data.messageId,
        transport: response.data.transport, // "rcs" or "sms"
      };
    } catch (error: any) {
      console.error("MessagingService Error:", error);
      const message =
        error.response?.data?.error ||
        error.response?.data?.mobileMessageError ||
        error.response?.data?.repairShoprError ||
        error.message ||
        "Failed to send message via MessagingService";
      throw new Error(message);
    }
  }

  /**
   * Updates a typing indicator status (sent via WebSockets / Backend to carrier)
   */
  static async sendTypingIndicator(to: string, isTyping: boolean) {
    try {
      await axios.post("/api/messaging/typing", {
        to,
        isTyping,
      });
    } catch (error) {
      console.warn("Failed to send typing indicator:", error);
    }
  }
}
