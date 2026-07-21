import { useState, useEffect } from "react";
import { doc, getDoc, collection, query, where, orderBy, getDocs, onSnapshot, limit } from "firebase/firestore";
import { db } from "../firebase";

export interface TicketStatus {
  value: string;
  label: string;
  color: string;
}

export const TICKET_PIPELINE: TicketStatus[] = [
  { value: "New", label: "New", color: "bg-blue-500" },
  { value: "Customer Reply", label: "Customer Reply", color: "bg-blue-400" },
  { value: "Approved - Ready for Repair", label: "Approved - Ready for Repair", color: "bg-emerald-600" },
  { value: "Approved", label: "Approved", color: "bg-emerald-600" },
  { value: "Declined", label: "Declined", color: "bg-red-500" },
  { value: "RWA", label: "RWA", color: "bg-orange-500" },
  { value: "In Progress", label: "In Progress", color: "bg-amber-500" },
  { value: "Escalated", label: "Escalated", color: "bg-red-600" },
  { value: "Waiting on Customer", label: "Waiting on Customer", color: "bg-purple-500" },
  { value: "Waiting for Parts", label: "Waiting for Parts", color: "bg-rose-500" },
  { value: "Waiting on Parts", label: "Waiting on Parts", color: "bg-rose-400" },
  { value: "Repair in progress", label: "Repair in Progress", color: "bg-blue-600" },
  { value: "Repair in Progress", label: "Repair in Progress", color: "bg-blue-600" },
  { value: "Ready for Pickup", label: "Ready for Pickup", color: "bg-emerald-500" },
  { value: "Ready For Pickup", label: "Ready For Pickup", color: "bg-emerald-400" },
  { value: "Resolved", label: "Resolved", color: "bg-zinc-500" },
  { value: "Permanently Closed", label: "Permanently Closed", color: "bg-zinc-600" },
  { value: "Permanently Close - Bulk Action", label: "Closed - Bulk", color: "bg-zinc-700" },
];

export function useTicketData(ticketId?: string) {
  const [ticket, setTicket] = useState<any>(null);
  const [customer, setCustomer] = useState<any>(null);
  const [notes, setNotes] = useState<any[]>([]);
  const [lineItems, setLineItems] = useState<any[]>([]);
  const [partsOrders, setPartsOrders] = useState<any[]>([]);
  const [estimates, setEstimates] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!ticketId) {
      setTicket(null);
      setCustomer(null);
      setNotes([]);
      setLineItems([]);
      setEstimates([]);
      setInvoices([]);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    let unsubTicketNew: any = null;

    // 1. Attach listener for Ticket
    const tRef = doc(db, "crm_tickets", ticketId);
    const unsubTicket = onSnapshot(tRef, async (tSnap) => {
      const processTicketData = async (snap: any) => {
          const tData = { id: snap.id, ...(snap.data() as object) } as any;
          if (isMounted) {
              setTicket(tData);
              // 2. Fetch Customer if exists (one-time fetch or separate listener)
              if (tData.customer_id) {
                  const cRef = doc(db, "crm_customers", String(tData.customer_id));
                  const cSnap = await getDoc(cRef);
                  if (cSnap.exists()) {
                      if (isMounted) setCustomer({ id: cSnap.id, ...cSnap.data() });
                  } else if (isMounted) {
                      // Fallback using ticket fields if customer doesn't exist in DB
                      setCustomer({
                          id: tData.customer_id,
                          firstname: tData.customer_firstname || tData.customer_name?.split(' ')[0] || tData.contact_fullname?.split(' ')[0] || tData.customer_business_then_name?.split(' ')[0] || '',
                          lastname: tData.customer_lastname || tData.customer_name?.split(' ').slice(1).join(' ') || tData.contact_fullname?.split(' ').slice(1).join(' ') || tData.customer_business_then_name?.split(' ').slice(1).join(' ') || '',
                          fullname: tData.customer_name || tData.contact_fullname || tData.customer_business_then_name,
                          phone: tData.phone || '',
                          email: tData.email || '',
                          is_stub: true
                      });
                  }
              } else if (isMounted && (tData.customer_name || tData.contact_fullname || tData.customer_business_then_name || tData.phone || tData.email)) {
                   setCustomer({
                      id: snap.id, 
                      firstname: tData.customer_firstname || tData.customer_name?.split(' ')[0] || tData.contact_fullname?.split(' ')[0] || tData.customer_business_then_name?.split(' ')[0] || '',
                      lastname: tData.customer_lastname || tData.customer_name?.split(' ').slice(1).join(' ') || tData.contact_fullname?.split(' ').slice(1).join(' ') || tData.customer_business_then_name?.split(' ').slice(1).join(' ') || '',
                      fullname: tData.customer_name || tData.contact_fullname || tData.customer_business_then_name,
                      phone: tData.phone || '',
                      email: tData.email || '',
                      is_stub: true
                  });
              } else if (isMounted) {
                  setCustomer(null);
              }
          }
      };

      if (tSnap.exists()) {
        await processTicketData(tSnap);
      } else {
        // Fallback to tickets array
        const tNewRef = doc(db, "tickets", ticketId);
        unsubTicketNew = onSnapshot(tNewRef, async (tNewSnap) => {
            if (tNewSnap.exists()) {
               await processTicketData(tNewSnap);
            } else {
               if (isMounted) setError(new Error("Ticket not found"));
            }
        }, (err) => {
            console.error("useTicketData: unsubTicketNew onSnapshot error:", err);
            if (isMounted) setError(err);
        });
      }
    }, (err) => {
      if (isMounted) {
          setError(err);
          setIsLoading(false);
      }
    });

    if (isMounted) setIsLoading(false);


    // 4. Attach simple listener for Notes
    const notesQ = query(
      collection(db, "crm_notes"),
      where("ticket_id", "==", String(ticketId)),
      orderBy("created_at", "asc")
    );
    
    const unsubNotes = onSnapshot(notesQ, (snap) => {
      if (isMounted) {
        const newNotes = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setNotes(newNotes.sort((a: any, b: any) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()));
      }
    }, (err) => {
      console.error("useTicketData: unsubNotes error:", err);
    });

    const itemsQ = query(
      collection(db, "crm_line_items"),
      where("ticket_id", "==", String(ticketId)),
      orderBy("created_at", "asc")
    );
    
    const unsubItems = onSnapshot(itemsQ, (snap) => {
      if (isMounted) {
        setLineItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      }
    }, (err) => {
      console.error("useTicketData: unsubItems error:", err);
    });

    const partsQ = query(
      collection(db, "parts_orders"),
      where("ticketId", "==", String(ticketId)),
      orderBy("createdAt", "asc")
    );

    const unsubParts = onSnapshot(partsQ, (snap) => {
      if (isMounted) {
        setPartsOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      }
    }, (err) => {
      console.error("useTicketData: unsubParts error:", err);
    });

    const estimatesQ = query(
      collection(db, "estimates"),
      where("ticket_id", "==", String(ticketId)),
      orderBy("created_at", "asc")
    );

    const unsubEstimates = onSnapshot(estimatesQ, (snap) => {
      if (isMounted) {
        setEstimates(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      }
    }, (err) => {
      console.error("useTicketData: unsubEstimates error:", err);
    });

    const invoicesQ = query(
      collection(db, "invoices"),
      where("ticket_id", "==", String(ticketId)),
      orderBy("created_at", "asc")
    );

    const unsubInvoices = onSnapshot(invoicesQ, (snap) => {
       if (isMounted) {
         setInvoices(snap.docs.map(d => ({ id: d.id, ...d.data() })));
       }
    }, (err) => {
      console.error("useTicketData: unsubInvoices error:", err);
    });

    return () => {
      isMounted = false;
      unsubTicket();
      if (typeof unsubTicketNew === "function") unsubTicketNew();
      unsubNotes();
      unsubItems();
      unsubParts();
      unsubEstimates();
      unsubInvoices();
    };
  }, [ticketId]);

  return { ticket, customer, notes, lineItems, partsOrders, estimates, invoices, isLoading, error };
}
