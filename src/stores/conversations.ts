import { create } from "zustand";
import { collection, query, orderBy, limit, doc, updateDoc, serverTimestamp, startAfter, getDocs, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { ConversationMetadata, ConversationEngine, normalizePhone } from "../services/conversations";
import { LabelEngine } from "../services/labels";
import { RealtimeManager } from "../services/RealtimeManager";
import { CostAnalyticsEngine } from "../services/CostAnalyticsEngine";

interface ConversationsState {
  conversations: ConversationMetadata[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  activeConversationId: string | null;

  // Actions
  setActiveConversationId: (id: string | null) => void;
  subscribeToConversations: () => () => void;
  loadMoreConversations: () => Promise<void>;
  optimisticMoveToTop: (
    conversationId: string,
    payload: {
      text: string;
      direction: "inbound" | "outbound";
      phone: string;
      customerId?: string | null;
      customerName?: string | null;
      ticketNumber?: string | null;
    }
  ) => void;
  dismissYourTurnLabel: (conversationId: string, fallbackMetadata?: Partial<ConversationMetadata>) => Promise<void>;
  addLabelToConversation: (conversationId: string, labelName: string, fallbackMetadata?: Partial<ConversationMetadata>) => Promise<void>;
  removeLabelFromConversation: (conversationId: string, labelName: string, fallbackMetadata?: Partial<ConversationMetadata>) => Promise<void>;
}

export const useConversationsStore = create<ConversationsState>((set, get) => {
  let unsubscribe: (() => void) | null = null;
  let lastVisibleDoc: any = null;
  let contactMap = new Map<string, { id: string; name: string }>();

  return {
    conversations: [],
    isLoading: true,
    isLoadingMore: false,
    hasMore: true,
    error: null,
    activeConversationId: null,

    setActiveConversationId: (id) => {
      set({ activeConversationId: id });
    },

    subscribeToConversations: () => {
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }

      set({ isLoading: true, error: null });

      // Fetch contacts in the background to resolve Unknown names
      getDocs(collection(db, "crm_customers")).then((snap) => {
        CostAnalyticsEngine.recordReads("conversations_contacts_resolve", snap.size);
        snap.forEach((doc) => {
          const c = doc.data();
          const fullname = c.fullname || c.business_then_name || `${c.firstname || ''} ${c.lastname || ''}`.trim() || "Unnamed Customer";
          const p1 = normalizePhone(c.phone || '');
          const p2 = normalizePhone(c.mobile || '');
          const p3 = normalizePhone(c.cell || '');
          if (p1) contactMap.set(p1, { id: doc.id, name: fullname });
          if (p2) contactMap.set(p2, { id: doc.id, name: fullname });
          if (p3) contactMap.set(p3, { id: doc.id, name: fullname });
        });

        // Trigger an immediate enrichment on already loaded conversations
        const currentList = get().conversations;
        let changed = false;
        const enrichedList = currentList.map(c => {
          if (!c.customerId || !c.customerName || c.customerName === "Unknown" || c.customerName === "Unknown Customer") {
            const cleanPhone = normalizePhone(c.phone || '');
            const match = contactMap.get(cleanPhone);
            if (match) {
              changed = true;
              updateDoc(doc(db, "conversations", c.conversationId), {
                customerId: match.id,
                customerName: match.name
              }).catch(err => console.error("Failed to auto-update conversation customer name:", err));
              
              return {
                ...c,
                customerId: match.id,
                customerName: match.name
              };
            }
          }
          return c;
        });
        if (changed) {
          set({ conversations: enrichedList });
        }
      }).catch(err => console.error("Failed to fetch crm_customers for contact resolve:", err));

      const q = query(collection(db, "conversations"), orderBy("updatedAt", "desc"), limit(50));

      const activeUnsub = RealtimeManager.subscribe(
        "global_conversations_list",
        q,
        (rawDocs: any[]) => {
          if (rawDocs.length > 0) {
            lastVisibleDoc = rawDocs[rawDocs.length - 1]._doc || null; // _doc holds the snapshot if RealtimeManager provides it, otherwise we'll need to fetch manually for cursor
          }
          
          const remoteCol = rawDocs.map((d: any) => ({
            conversationId: d.id,
            ...d,
          })) as ConversationMetadata[];

          const currentList = get().conversations;
          
          const merged = [...remoteCol];
          
          // First, re-insert or replace any optimistic conversations at the top if they haven't fully arrived yet
          for (let i = currentList.length - 1; i >= 0; i--) {
            const old = currentList[i];
            if (old.updatedAt === "optimistic") {
              const remoteIndex = merged.findIndex(m => m.conversationId === old.conversationId);
              if (remoteIndex === -1) {
                merged.unshift(old);
              } else if (merged[remoteIndex].updatedAt === null) {
                // Remote has pending serverTimestamp, so replace with optimistic
                merged.splice(remoteIndex, 1);
                merged.unshift(old);
              }
            }
          }

          // Then, append all older loaded conversations (the tail) that aren't in the new batch
          currentList.forEach(old => {
            if (!merged.find(m => m.conversationId === old.conversationId)) {
                merged.push(old);
            }
          });

          const final = merged.map((remote) => {
            let resolvedName = remote.customerName;
            let resolvedId = remote.customerId;
            
            if (!resolvedId || !resolvedName || resolvedName === "Unknown" || resolvedName === "Unknown Customer") {
              const cleanPhone = normalizePhone(remote.phone || '');
              const match = contactMap.get(cleanPhone);
              if (match) {
                resolvedName = match.name;
                resolvedId = match.id;
                
                // Keep Firestore updated in the background
                updateDoc(doc(db, "conversations", remote.conversationId), {
                  customerId: resolvedId,
                  customerName: resolvedName
                }).catch(err => console.error("Failed to auto-update conversation customer name:", err));
              }
            }

            const opt = currentList.find((c) => c.conversationId === remote.conversationId);
            if (opt && opt.updatedAt === "optimistic") {
              return {
                ...remote,
                customerName: resolvedName,
                customerId: resolvedId,
                lastMessagePreview: opt.lastMessagePreview,
                lastMessageAt: remote.lastMessageAt || new Date(),
              };
            }
            return {
              ...remote,
              customerName: resolvedName,
              customerId: resolvedId
            };
          });

          // Deduplicate the final list by conversationId to prevent UI duplication issues
          const seen = new Set();
          const deduplicatedFinal = final.filter(item => {
            if (seen.has(item.conversationId)) return false;
            seen.add(item.conversationId);
            return true;
          });

          set({
            conversations: deduplicatedFinal,
            isLoading: false,
            hasMore: rawDocs.length >= 50
          });
        },
        (err) => {
          console.error("Conversations sync failed: ", err);
          set({ error: err.message, isLoading: false });
        }
      );

      unsubscribe = () => {
        activeUnsub();
      };
      return unsubscribe;
    },

    loadMoreConversations: async () => {
      const { isLoadingMore, hasMore, conversations } = get();
      if (isLoadingMore || !hasMore || conversations.length === 0 || !lastVisibleDoc) return;

      set({ isLoadingMore: true });
      try {
        const q = query(
          collection(db, "conversations"),
          orderBy("updatedAt", "desc"),
          startAfter(lastVisibleDoc),
          limit(50)
        );
        
        const snap = await getDocs(q);
        CostAnalyticsEngine.recordReads("conversations_load_more", snap.size);
        
        if (snap.empty) {
          set({ hasMore: false, isLoadingMore: false });
          return;
        }

        lastVisibleDoc = snap.docs[snap.docs.length - 1];

        const nextBatch = snap.docs.map((d) => {
          const remote = d.data() as any;
          let resolvedName = remote.customerName;
          let resolvedId = remote.customerId;
          
          if (!resolvedId || !resolvedName || resolvedName === "Unknown" || resolvedName === "Unknown Customer") {
            const cleanPhone = normalizePhone(remote.phone || '');
            const match = contactMap.get(cleanPhone);
            if (match) {
              resolvedName = match.name;
              resolvedId = match.id;
              
              updateDoc(doc(db, "conversations", d.id), {
                customerId: resolvedId,
                customerName: resolvedName
              }).catch(err => console.error("Failed to auto-update conversation customer name:", err));
            }
          }

          return {
            conversationId: d.id,
            ...remote,
            customerName: resolvedName,
            customerId: resolvedId
          };
        }) as ConversationMetadata[];

        // Deduplicate the combined list
        const nextConversations = [...conversations, ...nextBatch];
        const seen = new Set();
        const deduplicatedConversations = nextConversations.filter(item => {
            if (seen.has(item.conversationId)) return false;
            seen.add(item.conversationId);
            return true;
        });

        set({
          conversations: deduplicatedConversations,
          isLoadingMore: false,
          hasMore: snap.size >= 50
        });
      } catch (err: any) {
        console.error("Failed to load more conversations", err);
        set({ error: err.message, isLoadingMore: false });
      }
    },

    optimisticMoveToTop: (conversationId, payload) => {
      const list = [...get().conversations];
      const matchIndex = list.findIndex((c) => c.conversationId === conversationId);

      const targetConv = matchIndex !== -1 ? list[matchIndex] : null;
      const updated = ConversationEngine.processNewMessage(targetConv, {
        ...payload,
        timestamp: new Date(),
      });
      // Force tag updated as optimistic
      updated.updatedAt = "optimistic";

      if (matchIndex !== -1) {
        // Remove and place at index 0 (top of the chat thread)
        list.splice(matchIndex, 1);
        list.unshift(updated);
      } else {
        // Create new item at top
        list.unshift(updated);
      }

      set({ conversations: list });
    },

    dismissYourTurnLabel: async (conversationId: string, fallbackMetadata?: Partial<ConversationMetadata>) => {
      const list = get().conversations;
      const item = list.find((c) => c.conversationId === conversationId);
      const source = item || fallbackMetadata;
      if (!source) return;

      const newLabels = LabelEngine.dismissLabel(source.labels || [], "your_turn", "operator");
      const isYourTurnActive = LabelEngine.isLabelActive(newLabels, "your_turn");

      if (item) {
        // Optimistic state change
        set({
          conversations: list.map((c) =>
            c.conversationId === conversationId
              ? { ...c, labels: newLabels, isYourTurn: isYourTurnActive }
              : c
          ),
        });
      }

      try {
        const convRef = doc(db, "conversations", conversationId);
        await setDoc(convRef, {
          labels: newLabels,
          isYourTurn: isYourTurnActive,
          updatedAt: serverTimestamp(),
          phone: source.phone || "",
          customerId: source.customerId || null,
          customerName: source.customerName || null,
          ticketNumber: source.ticketNumber || null,
        }, { merge: true });
        CostAnalyticsEngine.recordWrites(1);
      } catch (err) {
        console.error("Failed to dismiss Your Turn label: ", err);
      }
    },

    addLabelToConversation: async (conversationId: string, labelName: string, fallbackMetadata?: Partial<ConversationMetadata>) => {
      const list = get().conversations;
      const item = list.find((c) => c.conversationId === conversationId);
      const source = item || fallbackMetadata;
      if (!source) return;

      const newLabels = LabelEngine.applyLabel(source.labels || [], labelName, "manual");
      const isUrgentActive = LabelEngine.isLabelActive(newLabels, "urgent") || labelName === "urgent";
      const isYourTurnActive = LabelEngine.isLabelActive(newLabels, "your_turn") || labelName === "your_turn";

      if (item) {
        // Optimistic state change
        set({
          conversations: list.map((c) =>
            c.conversationId === conversationId
              ? { 
                  ...c, 
                  labels: newLabels, 
                  isUrgent: isUrgentActive, 
                  isYourTurn: isYourTurnActive 
                }
              : c
          ),
        });
      }

      try {
        const convRef = doc(db, "conversations", conversationId);
        await setDoc(convRef, {
          labels: newLabels,
          isUrgent: isUrgentActive,
          isYourTurn: isYourTurnActive,
          updatedAt: serverTimestamp(),
          phone: source.phone || "",
          customerId: source.customerId || null,
          customerName: source.customerName || null,
          ticketNumber: source.ticketNumber || null,
        }, { merge: true });
        CostAnalyticsEngine.recordWrites(1);
      } catch (err) {
        console.error("Failed to add label: ", err);
      }
    },

    removeLabelFromConversation: async (conversationId: string, labelName: string, fallbackMetadata?: Partial<ConversationMetadata>) => {
      const list = get().conversations;
      const item = list.find((c) => c.conversationId === conversationId);
      const source = item || fallbackMetadata;
      if (!source) return;

      const newLabels = LabelEngine.removeLabel(source.labels || [], labelName);
      const isUrgentActive = LabelEngine.isLabelActive(newLabels, "urgent") && labelName !== "urgent";
      const isYourTurnActive = LabelEngine.isLabelActive(newLabels, "your_turn") && labelName !== "your_turn";

      if (item) {
        // Optimistic state change
        set({
          conversations: list.map((c) =>
            c.conversationId === conversationId
              ? { 
                  ...c, 
                  labels: newLabels, 
                  isUrgent: isUrgentActive, 
                  isYourTurn: isYourTurnActive 
                }
              : c
          ),
        });
      }

      try {
        const convRef = doc(db, "conversations", conversationId);
        await setDoc(convRef, {
          labels: newLabels,
          isUrgent: isUrgentActive,
          isYourTurn: isYourTurnActive,
          updatedAt: serverTimestamp(),
          phone: source.phone || "",
          customerId: source.customerId || null,
          customerName: source.customerName || null,
          ticketNumber: source.ticketNumber || null,
        }, { merge: true });
        CostAnalyticsEngine.recordWrites(1);
      } catch (err) {
        console.error("Failed to remove label: ", err);
      }
    },
  };
});
