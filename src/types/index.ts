import { Timestamp } from "firebase/firestore";

export interface Message {
  id: string;
  to: string;
  from?: string;
  text: string;
  timestamp: Timestamp | any;
  status: "sending" | "sent" | "delivered" | "failed" | "received";
  type: "inbound" | "outbound" | "internal";
  customerId?: string;
  customerName?: string;
  ticketId?: string;
  ticketNumber?: string;
  replyToId?: string;
  attachmentUrl?: string;
  attachmentType?: string;
  isInternal?: boolean;
}

export interface ConversationMetadata {
  id: string;
  customerId?: string;
  customerName?: string;
  ticketNumber?: string;
  phone: string;
  isArchived: boolean;
  isUnread?: boolean;
  isUrgent?: boolean;
  requiresResponse?: boolean;
  isYourTurn?: boolean;
  isPinned?: boolean;
  lastMessageAt: Timestamp | any;
  uid: string;
}

export interface Customer {
  id: string;
  first_name?: string;
  last_name?: string;
  fullname?: string;
  phone: string;
  email: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  foundViaTicket?: boolean;
  last_service_date?: string;
  ticketNumbers?: string[];
  updated_at?: Timestamp | any;
}

export interface Ticket {
  id: string;
  number: string;
  subject: string;
  issue_description?: string;
  status: string;
  customer_id: string;
  customer_name?: string;
  customer_business_then_name?: string;
  customer_firstname?: string;
  customer_lastname?: string;
  customer_phone?: string;
  customer_email?: string;
  issue_type?: string;
  problem_type?: string;
  brand?: string;
  device_model?: string;
  updated_at?: string;
  created_at?: Timestamp | any;
  tech_id?: string;
  tech_name?: string;
  due_date?: string;
  tags?: string[];
  priority?: "Low" | "Medium" | "High" | "Urgent";
  stage_notes?: Record<string, string>;
  stage_message_status?: Record<string, string>;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  status: "open" | "completed";
  dueDate?: string;
  linkedCustomerId?: string;
  linkedTicketId?: string;
  linkedTicketNumber?: string;
  linkedConversationPhone?: string;
  linkedMessageId?: string;
  createdAt: Timestamp | any;
  createdBy: string;
}

export interface PartsOrder {
  id: string;
  partName: string;
  supplier: string;
  status: "ordered" | "shipped" | "received" | "installed" | "returned";
  trackingNumber?: string;
  cost?: number;
  price?: number;
  ticketId?: string;
  ticketNumber?: string;
  createdAt: Timestamp | any;
  notes?: string;
}
