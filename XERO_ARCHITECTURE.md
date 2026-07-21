# Xero Architecture & Reconstruction Plan

## 1. Full Architecture Review
The current application needs a robust, scalable, and fail-safe synchronization engine with Xero. The invoicing, payments, and credit workflows must be decoupled from the raw UI layer and managed through robust transaction and syncing services.

### Core Architecture Components
1. **Frontend Presentation**: React/Vite using `src/App.tsx` (to be modularised further). Modals for Quotes, Invoices, Payments, and Refunds.
2. **Backend API (Node.js/Express in `server.ts`)**: 
   - `XeroService`: Handles authentication, token refresh, and direct API communication with Xero.
   - `SyncEngine`: Evaluates sync queues, runs exponential backoff algorithms for failed operations, and logs outcomes.
   - `BillingSchedulesService`: CRON-driven engine that checks for due recurring hire invoices.
3. **Database (Firestore)**: A NoSQL representation using relational design concepts (sub-collections and foreign keys) for normalized accounting data.

## 2. Database Schema Recommendations (Firestore)

### `customers`
- `id` (UUID)
- `xero_contact_id` (string)
- `name`, `email`, `phone`
- `balance` (number, cached)
- `sync_status` (LOCAL_DRAFT, PENDING_SYNC, SYNCED, SYNC_ERROR)
- `created_at`, `updated_at`, `deleted_at`

### `invoices`
- `id` (UUID)
- `xero_invoice_id` (string)
- `customer_id` (UUID)
- `status` (LOCAL_DRAFT, PENDING_SYNC, XERO_DRAFT, AUTHORISED, PARTIALLY_PAID, PAID, OVERDUE, VOIDED, CREDITED)
- `issue_date`, `due_date`
- `subtotal`, `total_tax`, `total`
- `amount_due`, `amount_paid`
- `sync_status`, `sync_version`
- `line_items` (Array of InvoiceLineItem)
- `created_at`, `updated_at`, `deleted_at`

### `payments`
- `id` (UUID)
- `xero_payment_id` (string)
- `invoice_id` (UUID)
- `customer_id` (UUID)
- `amount`
- `date`
- `method` (CASH, EFTPOS, STRIPE, BANK_TRANSFER, MANUAL)
- `reference`
- `status` (PENDING, RECONCILED, REVERSED)
- `sync_status`

### `credit_notes` & `refunds`
Similar structure to `invoices` and `payments` but mapped to Xero's CreditNotes and Overpayments/Refunds endpoints.

### `hire_contracts` (Recurring Billing)
- `id` (UUID)
- `customer_id`
- `status` (ACTIVE, PAUSED, TERMINATED)
- `billing_frequency` (WEEKLY, FORTNIGHTLY, MONTHLY)
- `next_billing_date`
- `equipment_ids` (Array)
- `rate_per_period`

### `xero_sync_queue`
- `id` (UUID)
- `entity_type` (INVOICE, PAYMENT, CUSTOMER)
- `entity_id` (UUID)
- `operation` (CREATE, UPDATE, DELETE)
- `status` (PENDING, PROCESSING, FAILED, COMPLETED)
- `attempts` (number)
- `last_error` (string)
- `next_retry_at` (timestamp)

## 3. State Machine Diagrams

**Invoice State Machine:**
`LOCAL_DRAFT` -> `PENDING_SYNC` <-> `SYNC_ERROR`
`PENDING_SYNC` -> (Syncs to Xero) -> `XERO_DRAFT`
`XERO_DRAFT` -> `AUTHORISED` (Locked)
`AUTHORISED` -> `PARTIALLY_PAID` (if partial payment)
`AUTHORISED` / `PARTIALLY_PAID` -> `PAID` 
`AUTHORISED` -> `OVERDUE` (Time-based condition)
`AUTHORISED` -> `VOIDED` (if cancelled and $0 paid)
`AUTHORISED` -> `CREDITED` (if full credit note applied)

## 4. Invoice Lifecycle Flow
1. **Creation**: User drafts invoice. Status: `LOCAL_DRAFT`.
2. **Approval**: User approves invoice. Status: `PENDING_SYNC`.
3. **Sync**: Backend queue picks it up, pushes to Xero API.
4. **Authorisation**: If Xero successfully records it, status updates to `AUTHORISED`, Xero InvoiceID is stored locally.
5. **Editing**: Editing is blocked after `AUTHORISED`. Creating a revision clones it to a new `LOCAL_DRAFT` and voids the old one (if strictly necessary and no payments attached).

## 5. Payment Allocation Logic
- Create `Payment` record locally.
- Must not exceed `amount_due` on the invoice.
- Allow overpayments to sit on `Customer` profile as unallocated funds (Credit on Account) mapped to Xero Overpayments.
- Sync `Payment` to Xero mapping it to the `xero_invoice_id` and the designated bank account code.

## 6. Recurring Billing Engine Design (HireContracts)
1. **CRON Job**: Runs daily at 1:00 AM.
2. Checks `hire_contracts` where `status == ACTIVE` and `next_billing_date <= TODAY`.
3. Generates new `invoices` populated with the contract's rate and line items.
4. Updates `next_billing_date` based on `billing_frequency`.
5. Created invoices are immediately set to `PENDING_SYNC`.
6. Uses **Idempotency Keys** (e.g., `contractId_billingDate`) to prevent duplicate invoice generation if the job retries or crashes.

## 7. Xero API Integration Architecture
- Endpoint wrapper utilizing `xero-node`.
- Centralized token management in Firebase (`crm_integrations/xero`), updating automatically via the offline_access refresh token on intercept.
- Granular scopes: `accounting.transactions`, `accounting.contacts`, `offline_access`.

## 8. Webhook Handling Logic
- Expose `/api/xero/webhook` endpoint.
- Verify payload signature using the Webhook Key.
- Process incoming events (e.g., Invoice Paid natively in Xero).
- Identify local entity via `xero_id` mapping.
- Update local `status` preventing circular sync triggers.

## 9. Retry/Recovery System
- Operations are written to `xero_sync_queue`.
- A background worker processes `PENDING` operations.
- On failure (HTTP 5xx or rate limit), `attempts` increments, and `next_retry_at` is pushed out via exponential backoff (e.g., `2^attempts * 1 minute`).
- Dead Letter Queue: After 7 attempts, mark `FAILED` and alert admins on the dashboard.

## 10. Edge Case Handling
- **Duplicate Webooks**: Stored processed webhook IDs.
- **Race conditions**: Payments added locally while webhook pushes payment from Xero. Use Xero's source of truth and `updated_at` timestamps.
- **Token Expiry during Sync**: Xero SDK handles auto-refresh upon `401 Unauthorized` responses before retrying the endpoint once.

## 11. Validation Rules
- Prevent sync if Contact Name/Email is blank.
- Total calculation validation: `LineAmount = UnitAmount * Quantity`.
- Tax check: GST in Australia is exactly 1/11th of the Tax Inclusive amount or 10% of Exclusive.
- Payments cannot be allocated against `XERO_DRAFT`, only `AUTHORISED`.

## 12. Recommended Frontend Modal Redesigns
1. **Invoice View Modal**: Read-only once `AUTHORISED`. Action buttons for "Add Payment", "Add Credit Note", "Void". Status badges showing Xero Sync State.
2. **Payment Modal**: Options to select full/partial payment, payment method, drop-down mapping to Xero Account Codes. Shows "Balance Due" dynamically.
3. **Hire Agreement Modal**: Explicit frequency settings, pause/resume toggles, delivery fee addition, proration calculation displays for partial weeks.

## 13. API Endpoint Structure
- `POST /api/invoices` -> Local Create -> Queues Sync
- `PUT /api/invoices/:id` -> Local Update -> Queues Sync
- `POST /api/invoices/:id/payments` -> Local Payment -> Queues Sync
- `POST /api/hire/evaluate` -> Trigger recurring evaluation (used via internal CRON)
- `POST /api/webhooks/xero` -> External Xero event push

## 14. Security Recommendations
- All API routes handling payments or status changes require IAM/Firebase Auth validation.
- Validated role definitions (e.g., only `admin` or `billing_manager` can void invoices).
- Never expose Xero tokens to clients.

## 15. Audit Logging Strategy
- Create an `audit_logs` collection.
- Triggered on every significant mutation. Fields: `timestamp`, `user_id`, `action` (e.g., "VOIDED INVOICE"), `entity_type`, `entity_id`, `previous_state`, `new_state`.

## 16. Step-by-Step Implementation Plan
1. **Phase 1: Foundation**: 
   - Define exact Typescript interfaces for the new Models (`Invoice`, `Payment`, `HireContract`).
   - Create Firebase schema rules and indexes.
2. **Phase 2: Client/Customer Sync**: 
   - Implement Contact synchronization safely using robust UI alerts.
3. **Phase 3: The Sync Queue**: 
   - Build the `XeroSyncEngine` queue mechanisms in `server.ts`.
4. **Phase 4: Invoice Core Lifecycle**: 
   - Refactor Invoice creation, validation and the sync worker logic for single-off generation.
5. **Phase 5: Payments & Credits**: 
   - Add Payment logic with checks against overpayment and reconciliation.
6. **Phase 6: Recurring Billing Engine**: 
   - Create `HireContract` UI and internal CRON evaluating worker.
7. **Phase 7: Webhooks & Reconciliation**: 
   - Webhook setup, verification, and automated downstream processing.
8. **Phase 8: Audit & Dashboard UI Improvements**:
   - Re-construct error notifications, badging, and history logs on the UI.

## 17. Example Xero Sync Service Queue Worker (Concept)
```typescript
async function processSyncQueue() {
  const queueSnap = await getDocs(query(collection(db, 'xero_sync_queue'), where('status', '==', 'PENDING')));
  
  for (const job of queueSnap.docs) {
    const data = job.data();
    try {
      if (data.entity_type === 'INVOICE' && data.operation === 'CREATE') {
         // Transform local invoice to Xero Invoice Object
         const xeroInvoice = await transformToXeroInvoice(data.entity_id);
         const response = await xero.accountingApi.createInvoices(tenantId, { invoices: [xeroInvoice] });
         
         // Update Local
         await updateDoc(doc(db, 'invoices', data.entity_id), { 
            xero_invoice_id: response.body.invoices[0].invoiceID, 
            status: 'AUTHORISED',
            sync_status: 'SYNCED'
         });
         await updateDoc(job.ref, { status: 'COMPLETED' });
      }
    } catch (e) {
      await updateDoc(job.ref, { 
        status: 'FAILED', 
        last_error: e.message, 
        attempts: increment(1) 
      });
      // Handle backoff logic
    }
  }
}
```
