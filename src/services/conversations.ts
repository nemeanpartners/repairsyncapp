import { LabelEngine, LabelState } from "./labels";

export function normalizePhone(p: string) {
  if (!p) return "";
  let clean = p.replace(/[^\d]/g, "");
  if (clean.startsWith("04") && clean.length === 10) {
    clean = "61" + clean.substring(1);
  }
  if (clean.startsWith("4") && clean.length === 9) {
    clean = "61" + clean;
  }
  return clean;
}

export interface ConversationMetadata {
  conversationId: string;
  customerId: string | null;
  customerName?: string | null;
  phone: string;
  lastMessageAt: any;
  lastMessagePreview: string;
  lastMessageDirection: "inbound" | "outbound";
  unreadCount: number;
  labels: LabelState[];
  updatedAt: any;
  ticketNumber?: string | null;
  isUnread?: boolean;
  isYourTurn?: boolean;
  isUrgent?: boolean;
  isArchived?: boolean;
}

export class ConversationEngine {
  /**
   * Calculates new conversation metadata based on a new message event.
   * This implements the core system state machine for conversations, maintaining
   * atomic changes and the status of "your_turn" or "urgent" labels.
   */
  static processNewMessage(
    currentConv: Partial<ConversationMetadata> | null,
    messagePayload: {
      text: string;
      direction: "inbound" | "outbound";
      phone: string;
      customerId?: string | null;
      customerName?: string | null;
      ticketNumber?: string | null;
      timestamp: any;
    }
  ): ConversationMetadata {
    const { text, direction, phone, customerId, customerName, ticketNumber, timestamp } = messagePayload;
    
    // 1. Core fields
    const conversationId = currentConv?.conversationId || normalizePhone(phone);
    const existingLabels = currentConv?.labels || [];
    let updatedLabels = [...existingLabels];

    // 2. Compute unread count
    const isInbound = direction === "inbound";
    let newUnreadCount = currentConv?.unreadCount || 0;
    if (isInbound) {
      newUnreadCount += 1;
    }

    // 3. Label state mutations
    if (isInbound) {
      // Inbound message strictly triggers 'your_turn'
      updatedLabels = LabelEngine.forceReapplyLabel(updatedLabels, "your_turn", "system");
    } else {
      // Manual outbound replies automatically clear 'your_turn'
      updatedLabels = LabelEngine.dismissLabel(updatedLabels, "your_turn", "system");
    }

    // Determine legacy helper boolean values for backward compatibility
    const isYourTurn = LabelEngine.isLabelActive(updatedLabels, "your_turn");
    const isUnread = isInbound || (currentConv?.isUnread ?? false);

    return {
      conversationId,
      customerId: customerId || currentConv?.customerId || null,
      customerName: customerName || currentConv?.customerName || "Unknown Customer",
      phone: phone || currentConv?.phone || "",
      lastMessageAt: timestamp,
      lastMessagePreview: text.substring(0, 100),
      lastMessageDirection: direction,
      unreadCount: direction === "outbound" ? 0 : newUnreadCount,
      labels: updatedLabels,
      updatedAt: timestamp,
      ticketNumber: ticketNumber || currentConv?.ticketNumber || null,
      isUnread,
      isYourTurn,
      isUrgent: currentConv?.isUrgent || false,
      isArchived: currentConv?.isArchived || false,
    };
  }
}
