export type InvoiceStatus = 
  | 'LOCAL_DRAFT' 
  | 'PENDING_SYNC' 
  | 'XERO_DRAFT' 
  | 'AUTHORISED' 
  | 'PARTIALLY_PAID' 
  | 'PAID' 
  | 'OVERDUE' 
  | 'VOIDED' 
  | 'CREDITED' 
  | 'SYNC_ERROR';

export type PaymentMethod = 
  | 'CASH' 
  | 'EFTPOS' 
  | 'STRIPE' 
  | 'BANK_TRANSFER' 
  | 'NDIS_REMITTANCE' 
  | 'MANUAL' 
  | 'CREDIT_APPLIED';

export type SyncStatus = 'PENDING' | 'SYNCED' | 'ERROR';

export interface InvoiceLineItem {
  id: string; // Internal UUID
  xero_item_code?: string;
  description: string;
  quantity: number;
  unit_amount: number; // Tax exclusive or inclusive based on setting
  tax_type: string; // e.g., 'OUTPUT', 'EXEMPTOUTPUT'
  tax_amount: number;
  line_amount: number;
  account_code: string; // e.g., '200' for Sales
  tracking_categories?: { name: string; option: string }[];
}

export interface Invoice {
  id: string; // UUID
  xero_invoice_id?: string;
  customer_id: string;
  invoice_number: string;
  reference?: string;
  status: InvoiceStatus;
  issue_date: string; // ISO 8601
  due_date: string;
  
  // Totals
  subtotal: number;
  total_tax: number;
  total: number;
  amount_due: number;
  amount_paid: number;
  
  line_items: InvoiceLineItem[];
  
  // Tax config
  line_amount_types: 'Exclusive' | 'Inclusive' | 'NoTax';
  
  // Sync metadata
  sync_status: SyncStatus;
  sync_version: number; // Optimistic locking
  sync_error?: string;
  
  // Timestamps
  created_at: any; // Firestore timestamp
  updated_at: any;
  deleted_at?: any;
}

export interface Payment {
  id: string; // UUID
  xero_payment_id?: string;
  invoice_id: string;
  customer_id: string;
  
  amount: number;
  date: string; // ISO 8601
  method: PaymentMethod;
  reference?: string;
  
  // Xero mapping
  xero_account_id?: string; 
  
  status: 'PENDING' | 'RECONCILED' | 'REVERSED';
  sync_status: SyncStatus;
  sync_error?: string;
  
  created_at: any;
  updated_at: any;
}

export interface HireContract {
  id: string;
  customer_id: string;
  status: 'ACTIVE' | 'PAUSED' | 'TERMINATED';
  billing_frequency: 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY';
  next_billing_date: string; // YYYY-MM-DD
  start_date: string;
  end_date?: string;
  
  rate_per_period: number;
  delivery_fee?: number;
  
  equipment_ids: string[];
  line_items: InvoiceLineItem[]; // The template for the generated invoice
  
  created_at: any;
  updated_at: any;
}

export interface XeroSyncQueueItem {
  id: string;
  entity_type: 'INVOICE' | 'PAYMENT' | 'CUSTOMER' | 'CREDIT_NOTE';
  entity_id: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  
  status: 'PENDING' | 'PROCESSING' | 'FAILED' | 'COMPLETED';
  attempts: number;
  last_error?: string;
  next_retry_at?: any; // Firestore timestamp
  
  created_at: any;
  updated_at: any;
}
