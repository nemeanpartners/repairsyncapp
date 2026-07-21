import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../../../firebase';
import { doc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { CustomerProfile } from '../components/CustomerProfile';
import { Loader2 } from 'lucide-react';

export function CustomerProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<any>(null);
  const [tickets, setTickets] = useState<any[]>([]);
  const [latestSyncJob, setLatestSyncJob] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    // 1. Listen to customer document
    const unsubCustomer = onSnapshot(doc(db, 'crm_customers', id), (docSnap) => {
      if (docSnap.exists()) {
        setCustomer({ id: docSnap.id, ...docSnap.data() });
      } else {
        setCustomer(null);
      }
      setIsLoading(false);
    }, (err) => {
      console.error("Customer listener error:", err);
      setIsLoading(false);
    });

    // 2. Listen to customer's tickets
    const qTickets = query(collection(db, 'crm_tickets'), where('customer_id', '==', id));
    const unsubTickets = onSnapshot(qTickets, (snap) => {
      setTickets(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => {
      console.error("Tickets listener error:", err);
    });

    // 3. Listen to Xero sync jobs for this customer
    const qSync = query(
      collection(db, 'xero_sync_queue'),
      where('entity_id', '==', id),
      where('entity_type', '==', 'CUSTOMER')
    );
    const unsubSync = onSnapshot(qSync, (snap) => {
      const jobs = snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
      // Sort in-memory descending by created_at to avoid requiring compound Firestore index
      jobs.sort((a: any, b: any) => {
        const timeA = a.created_at?.seconds || a.created_at?.toMillis?.() || (a.created_at instanceof Date ? a.created_at.getTime() : 0);
        const timeB = b.created_at?.seconds || b.created_at?.toMillis?.() || (b.created_at instanceof Date ? b.created_at.getTime() : 0);
        return timeB - timeA;
      });
      setLatestSyncJob(jobs[0] || null);
    }, (err) => {
      console.error("Sync queue listener error:", err);
    });

    return () => {
      unsubCustomer();
      unsubTickets();
      unsubSync();
    };
  }, [id]);

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center text-zinc-500">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Loading profile...
      </div>
    );
  }

  if (!customer) {
    return <div className="p-8 text-center text-zinc-500">Customer not found.</div>;
  }

  return (
    <CustomerProfile 
      customer={customer}
      tickets={tickets}
      latestSyncJob={latestSyncJob}
      onNavigate={(view, draft) => {
        if (view === 'messages') {
          const phone = customer?.phone || customer?.mobile || '';
          const name = customer?.firstname || customer?.lastname ? `${customer.firstname || ''} ${customer.lastname || ''}`.trim() : customer?.business_name || 'Unnamed';
          const customerId = customer?.id || '';
          let url = `/messages?phone=${encodeURIComponent(phone)}&customerId=${encodeURIComponent(customerId)}&customerName=${encodeURIComponent(name)}`;
          if (draft) {
            url += `&draft=${encodeURIComponent(draft)}`;
          }
          navigate(url);
        } else {
          navigate('/customers');
        }
      }}
      onSelectTicket={(tick) => navigate(`/tickets/${tick.id}`)}
      onUpdateCustomer={(updated) => setCustomer(updated)}
      onNewTicket={() => navigate('/tickets/new')}
    />
  );
}
