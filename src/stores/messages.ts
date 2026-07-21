import { create } from "zustand";
import { collection, query, orderBy, limit, where } from "firebase/firestore";
import { db } from "../firebase";
import { RealtimeManager } from "../services/RealtimeManager";
import { CostAnalyticsEngine } from "../services/CostAnalyticsEngine";

export interface ChatMessage {
  id: string;
  from: string;
  to: string;
  text: string;
  timestamp: any;
  status: "sending" | "sent" | "delivered" | "read" | "failed";
  type: "inbound" | "outbound";
  isRCS?: boolean;
  isInternal?: boolean;
  customerId?: string | null;
  customerName?: string | null;
  ticketNumber?: string | null;
  error?: string;
  isWebhook?: boolean;
  isUnread?: boolean;
}

function normalizePhone(p?: string | null): string {
  if (!p) return "";
  let clean = p.replace(/[^\d]/g, "");
  if (clean.startsWith("6104") && clean.length >= 11) {
    clean = "61" + clean.substring(2);
  } else if (clean.startsWith("04") && clean.length === 10) {
    clean = "61" + clean.substring(1);
  } else if (clean.startsWith("4") && clean.length === 9) {
    clean = "61" + clean;
  }
  return clean;
}

interface MessagesState {
  messages: ChatMessage[];
  isLoading: boolean;
  activeConversationId: string | null;
  activePhone: string | null;
  error: string | null;
  
  // Actions
  setActiveThread: (conversationId: string | null, phone: string | null) => void;
  addOptimisticMessage: (msg: ChatMessage) => void;
  updateMessageStatus: (id: string, status: ChatMessage["status"], error?: string) => void;
  subscribeToThread: (customerId: string | null, phone: string) => () => void;
}

export const useMessagesStore = create<MessagesState>((set, get) => {
  let unsubscribe: (() => void) | null = null;

  return {
    messages: [],
    isLoading: false,
    activeConversationId: null,
    activePhone: null,
    error: null,

    setActiveThread: (conversationId, phone) => {
      set({ activeConversationId: conversationId, activePhone: phone });
    },

    addOptimisticMessage: (msg) => {
      set((state) => ({
        messages: [...state.messages, msg],
      }));
    },

    updateMessageStatus: (id, status, error) => {
      set((state) => ({
        messages: state.messages.map((m) =>
          m.id === id ? { ...m, status, error: error || undefined } : m
        ),
      }));
    },

    subscribeToThread: (customerId, phone) => {
      // Clean previous listener
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }

      set({ isLoading: true, error: null });

      const normPhone = normalizePhone(phone);

      // We fetch the message collection. Scoped securely:
      let q;
      if (customerId) {
        q = query(
          collection(db, "messages"),
          where("customerId", "==", String(customerId)),
          orderBy("timestamp", "desc"),
          limit(100)
        );
      } else {
        q = query(
          collection(db, "messages"),
          orderBy("timestamp", "desc"),
          limit(100)
        );
      }

      const activeUnsub = RealtimeManager.subscribe(
        `messages_${customerId || "global"}_${normPhone}`,
        q,
        (rawMsgs: any[]) => {
          // Filter messages relative to this thread (if query is customerId, they're already mostly filtered,
          // but we apply deduplication and fallback filters safely).
          const filtered = rawMsgs.filter((m: any) => {
            if (customerId && m.customerId === String(customerId)) return true;
            
            const toPhone = normalizePhone(m.to);
            const fromPhone = normalizePhone(m.from);
            if (m.type === "outbound" && toPhone === normPhone) return true;
            if (m.type === "inbound" && fromPhone === normPhone) return true;
            return false;
          });

          // Deduplicate based on text and timestamp
          const unique: ChatMessage[] = [];
          const seen = new Set();
          for (const msg of filtered) {
            const key = `${msg.text}_${msg.timestamp?.seconds || ""}`;
            if (!seen.has(key)) {
              seen.add(key);
              unique.push({
                id: msg.id,
                from: msg.from || "",
                to: msg.to || "",
                text: msg.text || "",
                timestamp: msg.timestamp || null,
                status: msg.status || "delivered",
                type: msg.type || "outbound",
                isRCS: msg.isRCS,
                isInternal: msg.isInternal,
                customerId: msg.customerId,
                customerName: msg.customerName,
                isWebhook: msg.isWebhook,
                isUnread: msg.isUnread,
              });
            }
          }

          // Chronological order (oldest to newest)
          const sorted = unique.reverse();

          // Merge currently "sending" / "failed" optimistic messages that aren't in the DB snapshot yet
          const dbIds = new Set(sorted.map((m) => m.id));
          const currentSendingAndFailed = get().messages.filter(
            (m) => (m.status === "sending" || m.status === "sent" || m.status === "failed") && !dbIds.has(m.id)
          );

          set({
            messages: [...sorted, ...currentSendingAndFailed],
            isLoading: false,
          });
        },
        (err) => {
          console.error("Messages query subscription error: ", err);
          set({ error: err.message, isLoading: false });
        }
      );

      unsubscribe = () => {
        activeUnsub();
      };
      return unsubscribe;
    },
  };
});
