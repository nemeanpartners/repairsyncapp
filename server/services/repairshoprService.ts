import axios from "axios";
import { getDb } from "../utils/firebase.js";
import { doc, writeBatch, arrayUnion, setDoc, getDoc, runTransaction, serverTimestamp } from "firebase/firestore";



function customWriteBatch(dbInstance: any) {
  const batch = writeBatch(dbInstance);
  const originalSet = batch.set.bind(batch);
  batch.set = (ref: any, data: any, options?: any) => originalSet(ref, { uid: 'api-server', ...data }, options || {});
  const originalUpdate = batch.update.bind(batch);
  batch.update = (ref: any, data: any) => originalUpdate(ref, { uid: 'api-server', ...data });
  return batch;
}

export let migrationProgress = {
  status: "idle",
  counts: { customers: 0, tickets: 0, sms: 0, comms: 0 },
  error: null as string | null
};

export async function getRecentTickets(subdomain: string, apiKey: string) {
  const db = getDb();
  if (!db) throw new Error("Firestore not configured");

  const response = await axios.get(`https://${subdomain}.repairshopr.com/api/v1/tickets`, {
    params: { limit: 50 },
    headers: { Authorization: `Bearer ${apiKey}` }
  });

  const tickets = response.data.tickets || [];
  if (tickets.length === 0) return { message: "No tickets found", count: 0 };

  const batch = customWriteBatch(db);
  for (const t of tickets) {
    const finalId = String(t.id);
    const docRef = doc(db, "crm_tickets", finalId);
    batch.set(docRef, {
      ...t,
      id: finalId,
      created_at: t.created_at || new Date().toISOString(),
      updated_at: t.updated_at || new Date().toISOString()
    }, { merge: true });

    if (t.customer && t.customer.id) {
      const custRef = doc(db, "crm_customers", String(t.customer.id));
      batch.set(custRef, {
        ...t.customer,
        id: String(t.customer.id)
      }, { merge: true });
    }
  }

  await batch.commit();
  return { message: "Sync successful", count: tickets.length };
}

export async function runMigrationInBackground(subdomain: string, apiKey: string) {
  const db = getDb();
  if (!db) return;

  if (migrationProgress.status !== "idle" && migrationProgress.status !== "completed" && migrationProgress.status !== "error") {
    return;
  }

  migrationProgress = { status: "running", counts: { customers: 0, tickets: 0, sms: 0, comms: 0 }, error: null };

  try {
    // 1. Customers
    migrationProgress.status = "syncing_customers";
    let page = 1, hasMore = true, totalCustomers = 0;
    while (hasMore && page <= 200) {
      const resp = await axios.get(`https://${subdomain}.repairshopr.com/api/v1/customers`, {
        params: { page },
        headers: { Authorization: `Bearer ${apiKey}` }
      });
      const customers = resp.data.customers || [];
      if (customers.length === 0) {
        hasMore = false;
        break;
      }

      const batch = writeBatch(db);
      for (const c of customers) {
        const docRef = doc(db, "crm_customers", String(c.id));
        batch.set(docRef, { ...c, id: String(c.id), uid: "system_migration" }, { merge: true });
      }
      await batch.commit();
      totalCustomers += customers.length;
      migrationProgress.counts.customers = totalCustomers;

      const meta = resp.data.meta || {};
      if (meta.total_pages && page < meta.total_pages) page++;
      else break;
      await new Promise(r => setTimeout(r, 400));
    }

    // 2. Contacts
    migrationProgress.status = "syncing_contacts";
    page = 1;
    hasMore = true;
    while (hasMore && page <= 200) {
      const resp = await axios.get(`https://${subdomain}.repairshopr.com/api/v1/contacts`, {
        params: { page },
        headers: { Authorization: `Bearer ${apiKey}` }
      });
      const contacts = resp.data.contacts || [];
      if (contacts.length === 0) {
        hasMore = false;
        break;
      }

      const batch = writeBatch(db);
      for (const c of contacts) {
        const contactId = `contact_${c.id}`;
        const docRef = doc(db, "crm_customers", contactId);
        batch.set(docRef, {
          ...c,
          id: contactId,
          rs_contact_id: c.id,
          rs_customer_id: c.customer_id,
          firstname: c.name || c.firstname || "",
          lastname: c.lastname || "",
          uid: "system_migration",
          is_contact: true,
          }, { merge: true });
      }
      await batch.commit();

      const meta = resp.data.meta || {};
      if (meta.total_pages && page < meta.total_pages) page++;
      else break;
      await new Promise(r => setTimeout(r, 400));
    }

    // 3. Tickets
    migrationProgress.status = "syncing_tickets";
    page = 1;
    hasMore = true;
    let totalTickets = 0;
    while (hasMore && page <= 200) {
      const resp = await axios.get(`https://${subdomain}.repairshopr.com/api/v1/tickets`, {
        params: { page },
        headers: { Authorization: `Bearer ${apiKey}` }
      });
      const tickets = resp.data.tickets || [];
      if (tickets.length === 0) {
        hasMore = false;
        break;
      }

      const batch = writeBatch(db);
      for (const t of tickets) {
        const ticketRef = doc(db, "crm_tickets", String(t.id));
        batch.set(ticketRef, { ...t, id: String(t.id), customer_id: String(t.customer_id), uid: "system_migration" }, { merge: true });
        if (t.customer_id) {
          const customerRef = doc(db, "crm_customers", String(t.customer_id));
          batch.set(customerRef, {
            tickets: arrayUnion({ id: t.id, number: t.number, subject: t.subject || '', status: t.status || '' }),
            }, { merge: true });
        }
      }
      await batch.commit();
      totalTickets += tickets.length;
      migrationProgress.counts.tickets = totalTickets;

      const meta = resp.data.meta || {};
      if (meta.total_pages && page < meta.total_pages) page++;
      else break;
      await new Promise(r => setTimeout(r, 400));
    }

    // 4. Ticket Comments
    migrationProgress.status = "syncing_messages";
    try {
      const initialResp = await axios.get(`https://${subdomain}.repairshopr.com/api/v1/ticket_comments`, {
        params: { page: 1, limit: 1 },
        headers: { Authorization: `Bearer ${apiKey}` }
      });
      const totalPages = initialResp.data.meta?.total_pages || 1;
      page = Math.max(1, totalPages - 50);

      let totalMatch = 0;
      while (page <= totalPages) {
        const resp = await axios.get(`https://${subdomain}.repairshopr.com/api/v1/ticket_comments`, {
          params: { page },
          headers: { Authorization: `Bearer ${apiKey}` }
        });
        const items = resp.data.comments || [];
        if (!items || items.length === 0) break;

        for (const s of items) {
          const bodyLower = (s.body || "").toLowerCase();
          const isSms = bodyLower.includes("sms") || bodyLower.includes("text message");
          if (!isSms) continue;

          totalMatch++;
          const msgId = `rs_ticket_comments_${s.id}`;
          const type = bodyLower.includes("sent") ? "outbound" : "inbound";
          let phone = "";
          let customerId = s.customer_id ? String(s.customer_id) : null;
          const text = s.body || "";

          if (!customerId && s.ticket_id) {
            const tSnap = await getDoc(doc(db, "crm_tickets", String(s.ticket_id)));
            if (tSnap.exists()) customerId = String(tSnap.data().customer_id);
          }

          if (customerId) {
            const cSnap = await getDoc(doc(db, "crm_customers", customerId));
            if (cSnap.exists()) phone = cSnap.data().mobile || cSnap.data().phone || "";
          }

          await setDoc(doc(db, "messages", msgId), {
            from: type === "inbound" ? (phone || "external") : "system",
            to: type === "outbound" ? (phone || "external") : "system",
            text,
            timestamp: s.created_at ? new Date(s.created_at) : serverTimestamp(),
            status: "delivered",
            type,
            customerId,
            uid: "system_migration",
            repairshopr_id: s.id,
            rs_source: "ticket_comments",
            }, { merge: true });
        }
        page++;
        migrationProgress.counts.sms = totalMatch;
        await new Promise(r => setTimeout(r, 200));
      }
    } catch (e) {
      console.error("[Migration] Error with ticket comments migration", e);
    }

    migrationProgress.status = "completed";
  } catch (err: any) {
    console.error("[Migration] Fatal Error:", err.message);
    migrationProgress.status = "error";
    migrationProgress.error = err.message;
  }
}

export async function processNewTicketWebhook(payload: any) {
  const db = getDb();
  if (!db) return;

  if (payload && payload.ticket) {
    const ticket = payload.ticket;
    const number = ticket.number || ticket.id;
    const customer = ticket.customer || payload.customer;

    if (customer && customer.id) {
      const finalCustId = String(customer.id);
      await setDoc(doc(db, "crm_customers", finalCustId), {
        ...customer,
        id: finalCustId,
        created_at: customer.created_at || new Date().toISOString(),
        updated_at: customer.updated_at || new Date().toISOString(),
        firstname: customer.firstname || customer.first_name || "",
        lastname: customer.lastname || customer.last_name || "",
        uid: "system_webhook",
        }, { merge: true });
    }

    const tickId = String(ticket.id);
    await setDoc(doc(db, "crm_tickets", tickId), {
      ...ticket,
      id: tickId,
      customer_id: String(ticket.customer_id),
      uid: "system_webhook",
      }, { merge: true });

    if (ticket.customer_id) {
      await setDoc(doc(db, "crm_customers", String(ticket.customer_id)), {
        tickets: arrayUnion({ id: ticket.id, number: ticket.number, subject: ticket.subject || "", status: ticket.status || "" }),
        }, { merge: true });
    }

    const firstName = customer ? (customer.firstname || customer.first_name || "Customer").trim() : "Customer";
    const phone = customer ? (customer.mobile || customer.phone) : null;

    if (phone) {
      let messageTemplate = "Hi {firstName}, your repair has been successfully booked under job #{ticketNumber}. For updates, simply reply to this message and our team will assist you shortly.\nKind regards Phone Medic Team";
      try {
        const settingsDoc = await getDoc(doc(db, "settings", "webhook_templates"));
        if (settingsDoc.exists() && settingsDoc.data().newTicketTemplate) {
          messageTemplate = settingsDoc.data().newTicketTemplate;
        }
      } catch (e) {
        console.error("[Webhooks] Failed to fetch template from Firestore", e);
      }

      const message = messageTemplate.replace(/{firstName}/g, firstName).replace(/{ticketNumber}/g, String(number));

      const idempotencyKey = `new_ticket_sms_${number}`;
      const idempotencyRef = doc(db, "webhook_idempotency", idempotencyKey);

      try {
        await runTransaction(db, async (txn) => {
          const snap = await txn.get(idempotencyRef);
          if (snap.exists()) {
            throw new Error("ALREADY_PROCESSED");
          }
          txn.set(idempotencyRef, { processedAt: serverTimestamp(), type: "new_ticket_sms" });
        });
      } catch (err: any) {
        if (err.message === "ALREADY_PROCESSED") {
          console.log(`[Webhooks] Prevented duplicate new ticket SMS to ${phone} for ticket #${number}`);
          return;
        }
        throw err;
      }

      try {
        await axios.post(`http://127.0.0.1:${process.env.PORT || 3000}/api/mobilemessage/send`, {
          to: phone,
          message: message,
          ticket_id: ticket.id || number
        });
        console.log(`[Webhooks] Sent new ticket SMS to ${phone} for ticket #${number}`);
      } catch (smsError: any) {
        console.error(`[Webhooks] Failed to send new ticket SMS:`, smsError.message);
      }
    }
  }
}
