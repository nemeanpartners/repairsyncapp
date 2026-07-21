import React, { useState, useEffect } from 'react';
import { db } from '../../../firebase';
import { collection, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import { PhoneIncoming, PhoneOutgoing, PhoneMissed, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

export function CustomerCallLogs({ customer }: { customer: any }) {
  const [callLogs, setCallLogs] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  useEffect(() => {
    const fetchLogs = async () => {
      if (!customer) return;
      setIsLoadingLogs(true);
      try {
        const cPhone = customer.phone?.replace(/\D/g, '') || '';
        
        // Use phone number matching for call logs initially
        const queries = [];
        if (cPhone) {
            queries.push(getDocs(query(collection(db, 'call_logs'), where('phoneNumber', '==', cPhone), limit(20))));
            // Also try format with + or local 0 if it starts with 0
        }
        
        if (customer.id) {
           queries.push(getDocs(query(collection(db, 'call_logs'), where('customerId', '==', customer.id), limit(20))));
        }

        const results = await Promise.all(queries);
        const map = new Map();
        
        results.forEach(snap => {
           snap.docs.forEach(doc => {
              map.set(doc.id, { id: doc.id, ...doc.data() });
           });
        });

        // Add global fallback for missing schemas
        if (map.size === 0) {
            const fallback = await getDocs(query(collection(db, 'call_logs'), orderBy('createdAt', 'desc'), limit(50)));
            fallback.docs.forEach(doc => {
                const log = doc.data();
                const lPhone = log.phoneNumber?.replace(/\D/g, '') || '';
                const lName = log.customerName?.toLowerCase() || '';
                const cName = customer.fullname?.toLowerCase() || '';

                if ((cPhone && lPhone && lPhone.includes(cPhone)) || (cName && lName && lName.includes(cName))) {
                    map.set(doc.id, { id: doc.id, ...log });
                }
            });
        }
        
        setCallLogs(Array.from(map.values()).sort((a, b) => {
            const ta = a.createdAt?.toMillis?.() || new Date(a.createdAt).getTime();
            const tb = b.createdAt?.toMillis?.() || new Date(b.createdAt).getTime();
            return tb - ta;
        }));
      } catch (e) {
        console.error('Error fetching call logs', e);
      } finally {
        setIsLoadingLogs(false);
      }
    };
    
    fetchLogs();
  }, [customer]);

  if (isLoadingLogs) {
    return <div className="p-12 text-center text-zinc-500 flex flex-col items-center">
            <Loader2 className="w-5 h-5 animate-spin mb-2" />
            <p className="text-sm">Loading interaction history...</p>
          </div>;
  }

  if (callLogs.length === 0) {
     return <div className="p-12 text-center text-zinc-500">
            <PhoneMissed className="w-8 h-8 opacity-20 mx-auto mb-3" />
            <p className="font-medium text-sm">No recent calls logged</p>
          </div>;
  }

  return (
    <div className="space-y-4">
      {callLogs.map(log => (
        <div key={log.id} className="p-4 bg-white border border-zinc-200/60 rounded-2xl flex gap-4 items-start shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_4px_15px_-4px_rgba(0,0,0,0.1)] transition-all">
          <div className={`p-2.5 rounded-xl shrink-0 ${
            log.direction === 'inbound' ? 'bg-blue-100/50 text-blue-600' : 
            log.status === 'missed' ? 'bg-rose-100/50 text-rose-600' : 'bg-emerald-100/50 text-emerald-600'
          }`}>
            {log.status === 'missed' ? <PhoneMissed className="w-5 h-5" /> :
             log.direction === 'inbound' ? <PhoneIncoming className="w-5 h-5" /> : 
             <PhoneOutgoing className="w-5 h-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-zinc-900 text-sm">
              {log.direction === 'inbound' ? 'Inbound' : 'Outbound'} Call
              {log.status === 'missed' && <span className="ml-2 text-rose-500 font-bold uppercase text-xs bg-rose-50 px-1.5 py-0.5 rounded">Missed</span>}
            </p>
            <p className="text-xs text-zinc-500 mt-1 mb-2">
              {log.createdAt ? format(log.createdAt?.toDate ? log.createdAt.toDate() : new Date(log.createdAt), 'MMM d, h:mm a') : 'Unknown time'}
              {log.duration && ` • ${Math.round(log.duration / 60)}m ${log.duration % 60}s`}
            </p>
            {log.notes && (
               <div className="bg-zinc-50 p-2.5 rounded-lg text-sm text-zinc-700 italic border border-zinc-100">
                 "{log.notes}"
               </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
