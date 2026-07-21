import React, { useState, useEffect } from "react";
import { collection, query, limit, getDocs, orderBy, where } from "firebase/firestore";
import { db } from "../../../firebase";
import { Ticket, Users, Package, MessageSquare, ArrowRight, Activity, CircleDollarSign, LayoutDashboard, AlertCircle, ArrowLeft, Send, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { TechnicianDashboard } from "./TechnicianDashboardPage";
import { useWorkflowStore } from "../../../store/workflowStore";
import { SyncLogsPanel } from "../components/SyncLogsPanel";

export function DashboardView() {
  const { isTechMode } = useWorkflowStore();
  
  if (isTechMode) {
    return <TechnicianDashboard />;
  }

  const navigate = useNavigate();
  const [stats, setStats] = useState({
    openTickets: 0,
    newMessages: 0,
    customers: 0,
    yourTurnCount: 0,
    recentTickets: [] as any[],
    recentSms: [] as any[],
    urgentSms: [] as any[],
    yourTurnSms: [] as any[],
    recentTasks: [] as any[],
    recentParts: [] as any[],
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Quick stats
        const ticketsSnap = await getDocs(query(collection(db, "crm_tickets"), orderBy("updated_at", "desc"), limit(1000)));
        const oldTicketsSnap = await getDocs(query(collection(db, "tickets"), orderBy("updated_at", "desc"), limit(1000)));
        const msgsSnap = await getDocs(query(collection(db, "conversations"), where("isUnread", "==", true), limit(50)));
        const custSnap = await getDocs(query(collection(db, "crm_customers"), limit(50)));
        
        const recentTicketsSnap = await getDocs(query(collection(db, "crm_tickets"), orderBy("updated_at", "desc"), limit(5)));
        const convSnap = await getDocs(query(collection(db, "conversations"), orderBy("updatedAt", "desc"), limit(100)));
        const tasksSnap = await getDocs(query(collection(db, "tasks"), limit(100)));
        const partsSnap = await getDocs(query(collection(db, "parts_orders"), orderBy("createdAt", "desc"), limit(5)));

        const crmOpen = ticketsSnap.docs.filter(d => {
          const s = String(d.data().status || "New").toLowerCase();
          return !['resolved', 'closed', 'completed', 'picked up'].includes(s);
        }).length;

        const oldOpen = oldTicketsSnap.docs.filter(d => {
          const s = String(d.data().status || "New").toLowerCase();
          return !['resolved', 'closed', 'completed', 'picked up'].includes(s);
        }).length;
        
        const openTickets = crmOpen + oldOpen;

        const allConvs = convSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const recentSms = allConvs.slice(0, 5);
        const urgentSms = allConvs.filter((c: any) => c.isUrgent && !c.isArchived).slice(0, 5);
        const yourTurnSms = allConvs.filter((c: any) => c.isYourTurn && !c.isArchived).slice(0, 5);
        const yourTurnCount = allConvs.filter((c: any) => c.isYourTurn && !c.isArchived).length;

        const allTasks = tasksSnap.docs.map(d => ({ id: d.id, ...d.data() }))
          .filter((t: any) => t.status === 'open')
          .sort((a: any, b: any) => {
            const dateA = a.dueDate ? new Date(a.dueDate).getTime() : 0;
            const dateB = b.dueDate ? new Date(b.dueDate).getTime() : 0;
            return dateA - dateB;
          });
        const recentTasks = allTasks.slice(0, 5);

        setStats({
          openTickets,
          newMessages: msgsSnap.size,
          customers: custSnap.size,
          yourTurnCount,
          recentTickets: recentTicketsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          recentSms,
          urgentSms,
          yourTurnSms,
          recentTasks,
          recentParts: partsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
        });
      } catch (e) {
        console.error("Error loading dashboard", e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (isLoading) {
    return <div className="p-8 flex justify-center items-center h-full text-zinc-500">Loading dashboard...</div>;
  }

  return (
    <div className="flex flex-col h-full w-full bg-zinc-50/50">
      <div className="px-4 md:px-8 py-4 md:py-6 border-b border-zinc-200 bg-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
           <h1 className="text-xl md:text-2xl font-bold tracking-tight text-zinc-900">Dashboard</h1>
           <p className="text-zinc-500 text-sm mt-1">Overview of your repair shop</p>
        </div>
      </div>

      <div className="p-4 md:p-8 flex-1 overflow-auto pb-20 md:pb-8">
        <div className="max-w-7xl mx-auto space-y-6 lg:space-y-8">
          
          {/* Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div onClick={() => navigate('/tickets')} className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm flex flex-col justify-center cursor-pointer hover:border-blue-200 hover:shadow-md transition-all">
               <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Ticket className="w-5 h-5" />
                  </div>
                  <h3 className="font-medium text-zinc-500 text-sm">Open Tickets</h3>
               </div>
               <p className="text-3xl font-bold text-zinc-900">{stats.openTickets}</p>
            </div>
            
            <div onClick={() => navigate('/messages?tab=unread')} className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm flex flex-col justify-center cursor-pointer hover:border-red-200 hover:shadow-md transition-all">
               <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <h3 className="font-medium text-zinc-500 text-sm">Unread Messages</h3>
               </div>
               <p className="text-3xl font-bold text-zinc-900">{stats.newMessages}</p>
            </div>

            <div onClick={() => navigate('/messages?tab=your_turn')} className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm flex flex-col justify-center cursor-pointer hover:border-amber-200 hover:shadow-md transition-all">
               <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                    <Send className="w-5 h-5" />
                  </div>
                  <h3 className="font-medium text-zinc-500 text-sm">Your Turn SMS</h3>
               </div>
               <p className="text-3xl font-bold text-zinc-900">{stats.yourTurnCount}</p>
            </div>

            <div onClick={() => navigate('/customers')} className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm flex flex-col justify-center cursor-pointer hover:border-emerald-200 hover:shadow-md transition-all">
               <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Users className="w-5 h-5" />
                  </div>
                  <h3 className="font-medium text-zinc-500 text-sm">Total Customers</h3>
               </div>
               <p className="text-3xl font-bold text-zinc-900">{stats.customers > 49 ? '50+' : stats.customers}</p>
            </div>
            
            <div onClick={() => navigate('/tickets')} className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm flex flex-col justify-center cursor-pointer hover:border-amber-200 hover:shadow-md transition-all">
               <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                    <Activity className="w-5 h-5" />
                  </div>
                  <h3 className="font-medium text-zinc-500 text-sm">Pending Repairs</h3>
               </div>
               <p className="text-3xl font-bold text-zinc-900">{Math.max(0, stats.openTickets - 2)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {/* List Grids */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
               
              {/* Recent Tickets */}
              <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm flex flex-col">
                <div className="p-4 border-b border-zinc-100 flex items-center justify-between">
                  <h2 className="font-bold text-zinc-900 flex items-center gap-2">
                     <Ticket className="w-4 h-4 text-blue-500" /> Recent Tickets
                  </h2>
                  <Button variant="ghost" size="sm" onClick={() => navigate('/tickets')} className="text-blue-600 h-8 px-2">
                    <ArrowRight className="w-4 h-4 text-zinc-400" />
                  </Button>
                </div>
                <div className="flex-1 p-0 divide-y divide-zinc-100">
                  {stats.recentTickets.map(ticket => (
                    <div key={ticket.id} onClick={() => navigate(`/tickets/${ticket.id}`)} className="p-3 hover:bg-zinc-50 cursor-pointer transition-colors flex items-center justify-between">
                      <div className="truncate pr-4">
                        <p className="font-semibold text-sm text-zinc-900 truncate">{ticket.subject || ticket.problem_type || 'Untitled Ticket'}</p>
                        <p className="text-xs text-zinc-500 mt-0.5 uppercase tracking-wider">{ticket.status}</p>
                      </div>
                      <Badge variant="outline" className="text-zinc-500 font-mono text-xs shadow-none shrink-0 border-zinc-200">#{ticket.number}</Badge>
                    </div>
                  ))}
                  {stats.recentTickets.length === 0 && (
                    <div className="p-6 text-center text-zinc-500 text-sm">No recent tickets</div>
                  )}
                </div>
              </div>

              {/* Tasks */}
              <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm flex flex-col">
                <div className="p-4 border-b border-zinc-100 flex items-center justify-between">
                  <h2 className="font-bold text-zinc-900 flex items-center gap-2">
                     <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Pending Tasks
                  </h2>
                  <Button variant="ghost" size="sm" onClick={() => navigate('/tasks')} className="text-blue-600 h-8 px-2">
                    <ArrowRight className="w-4 h-4 text-zinc-400" />
                  </Button>
                </div>
                <div className="flex-1 p-0 divide-y divide-zinc-100">
                  {stats.recentTasks.map(task => (
                    <div key={task.id} onClick={() => navigate(`/tasks`)} className="p-3 hover:bg-zinc-50 cursor-pointer transition-colors flex items-start gap-3">
                      <div className="w-4 h-4 rounded-full border border-zinc-300 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-semibold text-sm text-zinc-900 leading-tight">{task.title}</p>
                        {task.dueDate && <p className="text-xs text-red-500 font-medium mt-1">Due: {task.dueDate}</p>}
                      </div>
                    </div>
                  ))}
                  {stats.recentTasks.length === 0 && (
                    <div className="p-6 text-center text-zinc-500 text-sm">No pending tasks</div>
                  )}
                </div>
              </div>

               {/* Your Turn SMS */}
               <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm flex flex-col">
                <div className="p-4 border-b border-zinc-100 flex items-center justify-between">
                  <h2 className="font-bold text-zinc-900 flex items-center gap-2">
                     <ArrowRight className="w-4 h-4 text-amber-500" /> Your Turn SMS
                  </h2>
                  <Button variant="ghost" size="sm" onClick={() => navigate('/messages?tab=your_turn')} className="text-blue-600 h-8 px-2">
                    <ArrowRight className="w-4 h-4 text-zinc-400" />
                  </Button>
                </div>
                <div className="flex-1 p-0 divide-y divide-zinc-100">
                  {stats.yourTurnSms.map(sms => (
                    <div key={sms.id} onClick={() => navigate(`/messages?tab=your_turn&convId=${sms.id || sms.conversationId}`)} className="p-3 hover:bg-zinc-50 cursor-pointer transition-colors flex flex-col">
                      <div className="flex justify-between items-center mb-1">
                         <p className="font-semibold text-sm text-zinc-900 truncate">{sms.customerName || sms.phone}</p>
                         <span className="text-xs text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded">Action Req</span>
                      </div>
                      <p className="text-xs text-zinc-500 line-clamp-1">{sms.lastMessage}</p>
                    </div>
                  ))}
                  {stats.yourTurnSms.length === 0 && (
                    <div className="p-6 text-center text-zinc-500 text-sm">No action required SMS</div>
                  )}
                </div>
              </div>

              {/* Urgent SMS */}
              <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm flex flex-col">
                <div className="p-4 border-b border-zinc-100 flex items-center justify-between">
                  <h2 className="font-bold text-zinc-900 flex items-center gap-2">
                     <AlertCircle className="w-4 h-4 text-red-500" /> Urgent SMS
                  </h2>
                  <Button variant="ghost" size="sm" onClick={() => navigate('/messages?tab=urgent')} className="text-blue-600 h-8 px-2">
                    <ArrowRight className="w-4 h-4 text-zinc-400" />
                  </Button>
                </div>
                <div className="flex-1 p-0 divide-y divide-zinc-100">
                  {stats.urgentSms.map(sms => (
                    <div key={sms.id} onClick={() => navigate(`/messages?tab=urgent&convId=${sms.id || sms.conversationId}`)} className="p-3 hover:bg-red-50/50 cursor-pointer transition-colors flex flex-col">
                      <div className="flex justify-between items-center mb-1">
                         <p className="font-semibold text-sm text-zinc-900 truncate text-red-900">{sms.customerName || sms.phone}</p>
                      </div>
                      <p className="text-xs text-red-600 line-clamp-1">{sms.lastMessage}</p>
                    </div>
                  ))}
                  {stats.urgentSms.length === 0 && (
                    <div className="p-6 text-center text-zinc-500 text-sm">No urgent messages</div>
                  )}
                </div>
              </div>

              {/* Recent SMS */}
              <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm flex flex-col">
                <div className="p-4 border-b border-zinc-100 flex items-center justify-between">
                  <h2 className="font-bold text-zinc-900 flex items-center gap-2">
                     <MessageSquare className="w-4 h-4 text-indigo-500" /> Recent SMS
                  </h2>
                  <Button variant="ghost" size="sm" onClick={() => navigate('/messages?tab=all')} className="text-blue-600 h-8 px-2">
                    <ArrowRight className="w-4 h-4 text-zinc-400" />
                  </Button>
                </div>
                <div className="flex-1 p-0 divide-y divide-zinc-100">
                  {stats.recentSms.map(sms => (
                    <div key={sms.id} onClick={() => navigate(`/messages?convId=${sms.id || sms.conversationId}`)} className="p-3 hover:bg-zinc-50 cursor-pointer transition-colors flex flex-col">
                      <div className="flex justify-between items-center mb-1">
                         <p className="font-semibold text-sm text-zinc-900 truncate">{sms.customerName || sms.phone}</p>
                      </div>
                      <p className="text-xs text-zinc-500 line-clamp-1">{sms.lastMessage}</p>
                    </div>
                  ))}
                  {stats.recentSms.length === 0 && (
                    <div className="p-6 text-center text-zinc-500 text-sm">No recent messages</div>
                  )}
                </div>
              </div>

               {/* Parts Orders */}
               <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm flex flex-col">
                <div className="p-4 border-b border-zinc-100 flex items-center justify-between">
                  <h2 className="font-bold text-zinc-900 flex items-center gap-2">
                     <Package className="w-4 h-4 text-purple-500" /> Recent Parts
                  </h2>
                  <Button variant="ghost" size="sm" onClick={() => navigate('/inventory')} className="text-blue-600 h-8 px-2">
                    <ArrowRight className="w-4 h-4 text-zinc-400" />
                  </Button>
                </div>
                <div className="flex-1 p-0 divide-y divide-zinc-100">
                  {stats.recentParts.map(part => (
                    <div key={part.id} onClick={() => navigate(`/inventory`)} className="p-3 hover:bg-zinc-50 cursor-pointer transition-colors flex justify-between items-center">
                       <div className="truncate pr-2">
                         <p className="font-semibold text-sm text-zinc-900">{part.partName}</p>
                         <p className="text-xs text-zinc-500 mt-0.5 truncate">{part.supplier}</p>
                       </div>
                       <Badge variant="secondary" className="text-xs whitespace-nowrap bg-zinc-100 text-zinc-600 hover:bg-zinc-200 shadow-none border-0">
                         {part.status}
                       </Badge>
                    </div>
                  ))}
                  {stats.recentParts.length === 0 && (
                    <div className="p-6 text-center text-zinc-500 text-sm">No recent parts</div>
                  )}
                </div>
              </div>

            </div>

            <div className="grid grid-cols-1 gap-6">
              <SyncLogsPanel />
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}

