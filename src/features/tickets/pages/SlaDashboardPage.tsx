import React, { useState, useEffect } from 'react';
import { db } from '../../../firebase';
import { collection, query, getDocs, orderBy, limit } from 'firebase/firestore';
import { TicketSLAEngine } from '../services/TicketSLAEngine';
import { Ticket } from '../../../types';
import { AlertTriangle, Clock, TrendingDown, Users, CheckCircle2 } from 'lucide-react';
import { TicketCard } from '../../../components/TicketCard';
import { useNavigate } from 'react-router-dom';
import { ExecutiveAiDashboard } from '../../executive-ai-dashboard/components/ExecutiveAiDashboard';

export function SlaDashboardPage() {
  const [breachedTickets, setBreachedTickets] = useState<Ticket[]>([]);
  const [stats, setStats] = useState({ avgTurnaroundHours: 0, complianceRate: 100 });
  const [leaderboard, setLeaderboard] = useState<{name: string, closed: number, avgWait: number}[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  const scrollToBreaches = () => {
    const element = document.getElementById('breached-queue-section');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  useEffect(() => {
    const fetchSlaData = async () => {
      try {
        const q = query(collection(db, 'crm_tickets'), orderBy('created_at', 'desc'), limit(200));
        const snap = await getDocs(q);
        const allTickets = snap.docs.map(d => ({ id: d.id, ...d.data() } as Ticket));
        
        let breached: Ticket[] = [];
        let totalClosed = 0;
        let totalWaitMillis = 0;
        let complianceCount = 0;

        const techStats: Record<string, {closed: number, waitHours: number}> = {};

        allTickets.forEach(t => {
           const sla = TicketSLAEngine.calculateSLA(t);
           if (sla.isBreached && t.status !== 'Resolved' && t.status !== 'Ready for Pickup') {
              breached.push(t);
           }

           // Check compliance and turnaround for closed ones
           if (t.status === 'Resolved' || t.status === 'Ready for Pickup') {
              totalClosed++;
              const updatedObj: any = t.updated_at;
              const createdObj: any = t.created_at;
              const updatedTime = updatedObj?.toDate ? updatedObj.toDate().getTime() : (updatedObj ? new Date(updatedObj).getTime() : Date.now());
              const createdTime = createdObj?.toDate ? createdObj.toDate().getTime() : new Date(createdObj || Date.now()).getTime();
              const waitMillis = updatedTime - createdTime;
              totalWaitMillis += waitMillis;
              if (!sla.isBreached) complianceCount++;

              if (t.tech_id) {
                 const tName = t.tech_id; // Using ID as name if displayName unavailable
                 if (!techStats[tName]) techStats[tName] = { closed: 0, waitHours: 0 };
                 techStats[tName].closed++;
                 techStats[tName].waitHours += (waitMillis / 1000 / 60 / 60);
              }
           }
        });

        setBreachedTickets(breached);
        setStats({
          avgTurnaroundHours: totalClosed > 0 ? (totalWaitMillis / totalClosed / 1000 / 60 / 60) : 0,
          complianceRate: totalClosed > 0 ? Math.round((complianceCount / totalClosed) * 100) : 100
        });

        const leaders = Object.entries(techStats).map(([name, data]) => ({
          name: name.substring(0, 8), // shorten id
          closed: data.closed,
          avgWait: data.waitHours / data.closed
        })).sort((a,b) => b.closed - a.closed);

        setLeaderboard(leaders);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSlaData();
  }, []);

  if (isLoading) return <div className="p-8 text-center text-zinc-500">Loading SLA metrics...</div>;

  return (
    <div className="flex flex-col h-full w-full bg-zinc-50/50 border-l border-zinc-200">
      <div className="px-4 md:px-8 py-4 md:py-6 border-b border-zinc-200 bg-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-zinc-900 flex items-center gap-2">
             <AlertTriangle className="w-5 h-5 md:w-6 md:h-6 text-rose-500" /> SLA & Performance
          </h1>
          <p className="text-zinc-500 text-sm mt-1">Real-time service level agreement compliance</p>
        </div>
      </div>

      <div className="p-4 md:p-8 flex-1 overflow-auto pb-20 md:pb-8">
        <div className="max-w-7xl mx-auto space-y-6 lg:space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm flex flex-col justify-center">
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-wide mb-2 flex items-center gap-1.5"><Clock className="w-4 h-4" /> Avg Turnaround</p>
            <p className="text-4xl font-black text-zinc-900">{stats.avgTurnaroundHours.toFixed(1)} <span className="text-lg text-zinc-400">hours</span></p>
         </div>
         <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm flex flex-col justify-center">
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-wide mb-2 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> SLA Compliance</p>
            <p className="text-4xl font-black text-zinc-900">{stats.complianceRate}%</p>
         </div>
         <div 
           onClick={scrollToBreaches}
           className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm flex flex-col justify-center cursor-pointer hover:bg-rose-50/30 hover:border-rose-200 transition-all duration-200 active:scale-[0.98]"
         >
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-wide mb-2 flex items-center gap-1.5"><TrendingDown className="w-4 h-4 text-rose-500" /> Active Breaches</p>
            <p className="text-4xl font-black text-rose-600">{breachedTickets.length}</p>
         </div>
      </div>

      <div>
         <ExecutiveAiDashboard />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
         <div id="breached-queue-section" className="flex flex-col h-[500px] scroll-mt-6">
            <div className="flex items-center justify-between mb-4 shrink-0">
               <h2 className="text-sm font-bold text-zinc-900 flex items-center gap-2 uppercase tracking-wide">
                  <AlertTriangle className="w-4 h-4 text-rose-500" /> Breached Queue
               </h2>
               <span className="bg-rose-100 text-rose-700 text-xs font-semibold tracking-wide uppercase px-2 py-1 rounded-md">
                  {breachedTickets.length} Breaches
               </span>
            </div>
            <div className="flex-1 overflow-y-auto pr-2 space-y-3     hover:">
               {breachedTickets.length === 0 ? (
                 <div className="bg-white rounded-2xl p-8 border-2 border-dashed border-emerald-100/50 text-center text-emerald-600 flex flex-col items-center justify-center h-full min-h-[200px]">
                    <CheckCircle2 className="w-8 h-8 mb-2 opacity-50" />
                    <p className="font-bold tracking-tight">Zero breaches!</p>
                 </div>
               ) : (
                 breachedTickets.map(t => (
                   <TicketCard key={t.id} ticket={t} onClick={() => navigate(`/tickets/${t.id}`)} />
                 ))
               )}
            </div>
         </div>

         <div className="flex flex-col h-[500px]">
            <div className="flex items-center justify-between mb-4 shrink-0">
               <h2 className="text-sm font-bold text-zinc-900 flex items-center gap-2 uppercase tracking-wide">
                  <Users className="w-4 h-4 text-zinc-400" /> Tech Leaderboard
               </h2>
            </div>
            <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm flex flex-col flex-1 overflow-hidden">
               <div className="p-4 bg-zinc-50/50 border-b border-zinc-200 grid grid-cols-3 text-xs font-semibold uppercase text-zinc-400 tracking-wide shrink-0">
                 <span>Tech ID</span>
                 <span className="text-center">Closed Jobs</span>
                 <span className="text-right">Avg Wait</span>
               </div>
               <div className="flex-1 overflow-y-auto divide-y divide-zinc-100     hover:">
                 {leaderboard.length === 0 ? (
                    <div className="p-8 text-center text-zinc-400 text-sm font-medium">Not enough data.</div>
                 ) : leaderboard.map((tech, i) => (
                    <div key={tech.name} className="p-4 grid grid-cols-3 items-center hover:bg-zinc-50 transition-colors">
                       <span className="font-bold text-zinc-900 flex items-center gap-2">
                          <span className="w-5 h-5 rounded-md bg-zinc-100 text-zinc-500 flex items-center justify-center text-xs">{i+1}</span>
                          Tech_{tech.name}
                       </span>
                       <span className="text-center font-black text-blue-600">{tech.closed}</span>
                       <span className="text-right font-medium text-zinc-500">{tech.avgWait.toFixed(1)}h</span>
                    </div>
                 ))}
               </div>
            </div>
         </div>
      </div>
        </div>
      </div>
    </div>
  );
}
