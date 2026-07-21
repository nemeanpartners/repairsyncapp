import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { startOfDay } from 'date-fns';
import { Loader2 } from 'lucide-react';

export function TodayStatsWidget() {
  const [closedTickets, setClosedTickets] = useState(0);
  const [paymentsTotal, setPaymentsTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const fetchStats = async () => {
      try {
        const start = startOfDay(new Date());
        // Fetch tickets closed today
        const ticketsQ = query(
          collection(db, 'tickets'),
          where('updated_at', '>=', start)
        );
        const tSnap = await getDocs(ticketsQ);
        const count = tSnap.docs.filter(d => {
          const data = d.data();
          return data.status === 'resolved' || data.status === 'closed';
        }).length;
        
        // Fetch payments made today
        const paymentsQ = query(
          collection(db, 'payments'),
          where('created_at', '>=', start)
        );
        const pSnap = await getDocs(paymentsQ);
        const total = pSnap.docs.reduce((sum, doc) => sum + (Number(doc.data().amount) || 0), 0);

        if (active) {
          setClosedTickets(count);
          setPaymentsTotal(total);
          setIsLoading(false);
        }
      } catch (err) {
        console.error("Failed to load today stats", err);
        if (active) setIsLoading(false);
      }
    };
    fetchStats();
    return () => { active = false; };
  }, []);

  if (isLoading) return <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />;

  return (
    <div className="flex gap-4">
      <div className="bg-zinc-50 border border-zinc-200 rounded-lg px-4 py-2 flex flex-col items-end">
        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Tickets Closed Today</span>
        <span className="text-xl font-black text-emerald-600">{closedTickets}</span>
      </div>
      <div className="bg-zinc-50 border border-zinc-200 rounded-lg px-4 py-2 flex flex-col items-end">
        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Payments Today</span>
        <span className="text-xl font-black text-emerald-600">${paymentsTotal.toFixed(2)}</span>
      </div>
    </div>
  );
}
