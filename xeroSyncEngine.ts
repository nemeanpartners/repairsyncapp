import { XeroClient } from 'xero-node';
import { getFirestore, collection, query, where, getDocs, updateDoc as firestoreUpdateDoc, doc, increment, addDoc as firestoreAddDoc, serverTimestamp, getDoc, setDoc as firestoreSetDoc } from 'firebase/firestore';


async function addDoc(colRef: any, data: any) { return firestoreAddDoc(colRef, { uid: 'api-server', ...data }); }
async function setDoc(docRef: any, data: any, options: any = {}) { return firestoreSetDoc(docRef, { uid: 'api-server', ...data }, options); }
async function updateDoc(docRef: any, data: any) { return firestoreUpdateDoc(docRef, { uid: 'api-server', ...data }); }

export class XeroSyncEngine {
  private db: any;
  private xero: XeroClient;

  constructor(db: any, xero: XeroClient) {
    this.db = db;
    this.xero = xero;
  }

  // Ensures we have a valid token
  async ensureToken() {
    const snap = await getDoc(doc(this.db, 'crm_integrations', 'xero'));
    const data = snap.data();
    if (!data || !data.tokenSet) throw new Error("Xero not connected");
    
    try {
      await this.xero.initialize();
    } catch (e) {
      // Ignored if already initialized
    }
    await this.xero.setTokenSet(data.tokenSet);
    if (this.xero.readTokenSet().expired()) {
      const ts = await this.xero.refreshToken();
      await updateDoc(doc(this.db, 'crm_integrations', 'xero'), { tokenSet: JSON.parse(JSON.stringify(ts)) });
      return data.tenantId;
    }
    return data.tenantId;
  }

  // Polls the queue
  async processQueue() {
    console.log(`[XeroSyncEngine] Polling queue...`);
    try {
      const q = query(
        collection(this.db, 'xero_sync_queue'), 
        where('status', '==', 'PENDING')
      );
      const queueSnap = await getDocs(q);
      
      for (const jobDoc of queueSnap.docs) {
        const job = jobDoc.data();
        await updateDoc(jobDoc.ref, { status: 'PROCESSING' });
        
        try {
          const tenantId = await this.ensureToken();
          
          if (job.entity_type === 'INVOICE' && job.operation === 'CREATE') {
            await this.syncInvoiceCreate(job.entity_id, tenantId);
          } else if (job.entity_type === 'PAYMENT' && job.operation === 'CREATE') {
            await this.syncPaymentCreate(job.entity_id, tenantId);
          } else if (job.entity_type === 'CUSTOMER' && job.operation === 'CREATE') {
            await this.syncCustomerCreate(job.entity_id, tenantId);
          } else if (job.entity_type === 'END_OF_DAY' && job.operation === 'CREATE') {
            await this.syncEndOfDay(job.payload, tenantId);
          }
          
          await updateDoc(jobDoc.ref, { 
            status: 'COMPLETED',
            updated_at: serverTimestamp()
          });
          console.log(`[XeroSyncEngine] Job ${jobDoc.id} completed successfully.`);
          
        } catch (error: any) {
          console.error(`[XeroSyncEngine] Job ${jobDoc.id} failed:`, error.message);
          const attempts = (job.attempts || 0) + 1;
          const status = attempts >= 7 ? 'FAILED' : 'PENDING';
          
          // Next retry at (Exponential backoff: 2^attempts minutes)
          const nextRetry = new Date();
          nextRetry.setMinutes(nextRetry.getMinutes() + Math.pow(2, attempts));
          
          await updateDoc(jobDoc.ref, { 
            status,
            last_error: error.message,
            attempts,
            next_retry_at: nextRetry,
            updated_at: serverTimestamp()
          });
        }
      }
    } catch (e) {
      console.error("[XeroSyncEngine] Queue poll error:", e);
    }
  }

  async syncInvoiceCreate(invoiceId: string, tenantId: string) {
    const invSnap = await getDoc(doc(this.db, 'invoices', invoiceId));
    if (!invSnap.exists()) throw new Error("Invoice not found locally");
    const invData = invSnap.data();

    // Ensure customer is synced
    let xeroContactId = await this.ensureCustomerSynced(invData.customer_id, tenantId);

    const lineItems = invData.line_items.map((li: any) => ({
      description: li.description,
      quantity: li.quantity,
      unitAmount: li.unit_amount,
      accountCode: li.account_code || '200', // Default Sales account
      taxType: li.tax_type || 'OUTPUT',
    }));

    const xeroInvoice: any = {
      type: 'ACCREC',
      contact: { contactID: xeroContactId },
      date: invData.issue_date,
      dueDate: invData.due_date,
      lineAmountTypes: invData.line_amount_types === 'Inclusive' ? 'Inclusive' : 
                       invData.line_amount_types === 'Exclusive' ? 'Exclusive' : 'NoTax',
      lineItems: lineItems,
      reference: invData.reference || '',
      status: 'AUTHORISED'
    };

    const response = await this.xero.accountingApi.createInvoices(tenantId, { invoices: [xeroInvoice] });
    const createdXeroInvoice = response.body.invoices?.[0];
    
    if (createdXeroInvoice) {
      await updateDoc(doc(this.db, 'invoices', invoiceId), {
        xero_invoice_id: createdXeroInvoice.invoiceID,
        status: 'AUTHORISED',
        sync_status: 'SYNCED',
        sync_version: increment(1)
      });
    } else {
      throw new Error("Xero API did not return an invoice");
    }
  }

  async syncPaymentCreate(paymentId: string, tenantId: string) {
    const paySnap = await getDoc(doc(this.db, 'payments', paymentId));
    if (!paySnap.exists()) throw new Error("Payment not found locally");
    const payData = paySnap.data();

    const invSnap = await getDoc(doc(this.db, 'invoices', payData.invoice_id));
    if (!invSnap.exists() || !invSnap.data().xero_invoice_id) {
       throw new Error("Target invoice is not synced to Xero yet");
    }

    const payment: any = {
      invoice: { invoiceID: invSnap.data().xero_invoice_id },
      account: { code: payData.xero_account_id || '090' }, // Default bank account code, requires mapping!
      amount: payData.amount,
      date: payData.date,
      reference: payData.reference || ''
    };

    const response = await this.xero.accountingApi.createPayments(tenantId, { payments: [payment] });
    const createdPayment = response.body.payments?.[0];

    if (createdPayment) {
      await updateDoc(doc(this.db, 'payments', paymentId), {
        xero_payment_id: createdPayment.paymentID,
        status: 'RECONCILED',
        sync_status: 'SYNCED'
      });
    }
  }

  async ensureCustomerSynced(customerId: string, tenantId: string): Promise<string> {
    const custSnap = await getDoc(doc(this.db, 'crm_customers', customerId));
    if (!custSnap.exists()) throw new Error("Customer not found locally");
    const custData = custSnap.data();

    if (custData.xero_contact_id) return custData.xero_contact_id;

    const safeName = `${custData.firstname || ''} ${custData.lastname || ''}`.trim() || 'Unknown Customer';
    
    // Check if exists by email in Xero
    if (custData.email) {
       const searchRes = await this.xero.accountingApi.getContacts(tenantId, undefined, `EmailAddress=="${custData.email}"`);
       if (searchRes.body.contacts && searchRes.body.contacts.length > 0) {
         const foundId = searchRes.body.contacts[0].contactID;
         await updateDoc(doc(this.db, 'crm_customers', customerId), { xero_contact_id: foundId, sync_status: 'SYNCED' });
         return foundId!;
       }
    }

    // Create in Xero
    const ncRes = await this.xero.accountingApi.createContacts(tenantId, { 
      contacts: [{ 
        name: safeName, 
        emailAddress: custData.email || '', 
        phones: [{ phoneType: 'MOBILE', phoneNumber: custData.phone || '' }] as any
      }] 
    });
    
    const createdId = ncRes.body.contacts?.[0]?.contactID;
    if (!createdId) throw new Error("Failed to create Xero Contact");
    
    await updateDoc(doc(this.db, 'crm_customers', customerId), { xero_contact_id: createdId, sync_status: 'SYNCED' });
    return createdId;
  }
  
  async syncCustomerCreate(customerId: string, tenantId: string) {
    await this.ensureCustomerSynced(customerId, tenantId);
  }

  async syncEndOfDay(payload: any, tenantId: string) {
    const transactions = [];
    
    // We assume contact "Daily Sales" exists or will be auto-created by Xero if configured,
    // though Xero BankTransactions requires a valid Contact.
    // Xero might throw if contact is missing. We should ensure contact exists or just use a generic name
    // actually, in Xero, a bank transaction contact will be created if it doesn't exist, if it has a Name.
    
    if (payload.cash > 0) {
      transactions.push({
        type: 'RECEIVE',
        contact: { name: 'Daily Sales' },
        lineItems: [{
          description: `Daily Sales (Cash) - ${payload.date}`,
          quantity: 1,
          unitAmount: payload.cash,
          accountCode: '200'
        }],
        bankAccount: { code: '090' },
        date: payload.date,
        reference: `Cash - ${payload.date}`
      });
    }
    
    if (payload.eftpos > 0) {
      transactions.push({
        type: 'RECEIVE',
        contact: { name: 'Daily Sales' },
        lineItems: [{
          description: `Daily Sales (EFTPOS) - ${payload.date}`,
          quantity: 1,
          unitAmount: payload.eftpos,
          accountCode: '200'
        }],
        bankAccount: { code: '090' },
        date: payload.date,
        reference: `EFTPOS - ${payload.date}`
      });
    }
    
    if (transactions.length > 0) {
      const response = await this.xero.accountingApi.createBankTransactions(tenantId, {
        bankTransactions: transactions
      } as any);
      console.log(`[XeroSyncEngine] Synced End of Day Bank Transactions:`, response.body);
    }
  }

  async processHireContracts() {
    console.log(`[XeroSyncEngine] Evaluating Hire Contracts for recurring billing...`);
    try {
      const todayString = new Date().toISOString().split('T')[0];
      const q = query(
        collection(this.db, 'hire_contracts'),
        where('status', '==', 'ACTIVE'),
        where('next_billing_date', '<=', todayString)
      );
      const activeContractsSnap = await getDocs(q);

      for (const contractDoc of activeContractsSnap.docs) {
        const contract = contractDoc.data();
        const idempotencyKey = `billing_${contractDoc.id}_${contract.next_billing_date}`;
        
        // Skip if already processed
        const auditSnap = await getDoc(doc(this.db, 'audit_logs', idempotencyKey));
        if (auditSnap.exists()) continue;

        // Generate Invoice
        const invRef = await addDoc(collection(this.db, 'invoices'), {
          customer_id: contract.customer_id,
          invoice_number: `REC-${Date.now()}`,
          status: 'LOCAL_DRAFT',
          sync_status: 'PENDING',
          issue_date: todayString,
          due_date: new Date(Date.now() + 7 * 86400000).toISOString(),
          subtotal: contract.rate_per_period,
          total_tax: contract.rate_per_period * 0.1,
          total: contract.rate_per_period * 1.1,
          amount_due: contract.rate_per_period * 1.1,
          amount_paid: 0,
          line_amount_types: 'Exclusive',
          line_items: contract.line_items || [],
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
          source_contract_id: contractDoc.id
        });

        // Update Contract
        const nextDate = new Date(contract.next_billing_date);
        if (contract.billing_frequency === 'WEEKLY') nextDate.setDate(nextDate.getDate() + 7);
        else if (contract.billing_frequency === 'FORTNIGHTLY') nextDate.setDate(nextDate.getDate() + 14);
        else if (contract.billing_frequency === 'MONTHLY') nextDate.setMonth(nextDate.getMonth() + 1);

        await updateDoc(contractDoc.ref, {
          next_billing_date: nextDate.toISOString().split('T')[0],
          updated_at: serverTimestamp()
        });

        // Write Audit Log
        await setDoc(doc(this.db, 'audit_logs', idempotencyKey), {
          contract_id: contractDoc.id,
          invoice_id: invRef.id,
          billing_date: contract.next_billing_date,
          created_at: serverTimestamp()
        });
      }
    } catch (e: any) {
      console.error("[XeroSyncEngine] Hire Contracts error:", e.message);
    }
  }
}
