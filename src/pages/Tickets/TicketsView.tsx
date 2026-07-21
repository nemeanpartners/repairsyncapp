import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Wrench, Search, Plus, Filter, LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { collection, query, orderBy, limit } from "firebase/firestore";
import { db } from "../../firebase";
import { RealtimeManager } from "../../services/RealtimeManager";
import { CostAnalyticsEngine } from "../../services/CostAnalyticsEngine";
import { Badge } from "@/components/ui/badge";
import { TicketDetailView } from "./TicketDetailView";

export function TicketsView() {
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [tickets, setTickets] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  useEffect(() => {
    // Basic query for now, querying both crm_tickets and tickets
    const qCrm = query(collection(db, "crm_tickets"), orderBy("created_at", "desc"), limit(100));
    const qNew = query(collection(db, "tickets"), orderBy("created_at", "desc"), limit(100));
    
    let crmData: any[] = [];
    let newData: any[] = [];
    
    const unsubCrm = RealtimeManager.subscribe("tickets_dashboard_view_crm", qCrm, (data) => {
      crmData = data || [];
      const merged = [...crmData, ...newData].sort((a, b) => {
         const ta = a.created_at?.toMillis ? a.created_at.toMillis() : 0;
         const tb = b.created_at?.toMillis ? b.created_at.toMillis() : 0;
         return tb - ta;
      });
      setTickets(merged);
      setIsLoading(false);
    });

    const unsubNew = RealtimeManager.subscribe("tickets_dashboard_view_new", qNew, (data) => {
      newData = data || [];
      const merged = [...crmData, ...newData].sort((a, b) => {
         const ta = a.created_at?.toMillis ? a.created_at.toMillis() : 0;
         const tb = b.created_at?.toMillis ? b.created_at.toMillis() : 0;
         return tb - ta;
      });
      setTickets(merged);
      setIsLoading(false);
    });

    return () => {
      unsubCrm();
      unsubNew();
    };
  }, []);

  const statuses = [
    { id: "Open", label: "Open", color: "bg-blue-500" },
    { id: "Diagnosing", label: "Diagnosing", color: "bg-orange-500" },
    { id: "Awaiting Parts", label: "Awaiting Parts", color: "bg-purple-500" },
    { id: "In Progress", label: "In Progress", color: "bg-pink-500" },
    { id: "Ready for Pickup", label: "Ready", color: "bg-green-500" },
  ];

  if (selectedTicketId) {
    return <TicketDetailView ticketId={selectedTicketId} onBack={() => setSelectedTicketId(null)} />;
  }

  return (
    <div className="flex flex-col h-full bg-zinc-50/50 w-full overflow-hidden">
      {/* Header */}
      <div className="px-4 sm:px-6 py-4 bg-white border-b border-border/30 flex flex-col sm:flex-row sm:items-center justify-between shrink-0 gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Wrench className="w-5 h-5 text-primary" />
            Tickets Dashboard
          </h2>
          <p className="text-sm text-zinc-500">Manage repair queues and workflows.</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64 sm:flex-none">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <Input 
              placeholder="Search tickets..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-zinc-50 border-zinc-200" 
            />
          </div>
          <div className="flex bg-zinc-100 p-1 rounded-lg shrink-0">
            <Button 
               variant={viewMode === "kanban" ? "default" : "ghost"} 
               size="sm" 
               onClick={() => setViewMode("kanban")}
               className={viewMode === "kanban" ? "shadow-sm" : ""}
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>
            <Button 
               variant={viewMode === "list" ? "default" : "ghost"} 
               size="sm" 
               onClick={() => setViewMode("list")}
               className={viewMode === "list" ? "shadow-sm" : ""}
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
          <Button className="rounded-xl shadow-lg shadow-primary/20 shrink-0 px-3 sm:px-4">
            <Plus className="w-5 h-5 sm:w-4 sm:h-4 sm:mr-2" />
            <span className="hidden sm:inline">New Ticket</span>
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-x-auto overflow-y-auto  p-4 sm:p-6">
        {isLoading ? (
           <div className="h-full flex items-center justify-center text-zinc-400">Loading tickets...</div>
        ) : (
          viewMode === "kanban" ? (
             <div className="flex h-full gap-6 min-w-max pb-8">
               {statuses.map(status => (
                 <div key={status.id} className="w-80 flex flex-col h-full bg-zinc-100/50 rounded-2xl border border-zinc-200/50">
                    <div className="p-4 border-b border-zinc-200/50 flex items-center justify-between shrink-0">
                      <h3 className="font-semibold text-zinc-700 flex items-center gap-2">
                         <span className={`w-2.5 h-2.5 rounded-full ${status.color}`} />
                         {status.label}
                      </h3>
                      <Badge variant="secondary" className="bg-white">{tickets.filter(t => (t.status || "Open") === status.id).length}</Badge>
                    </div>
                    <div className="p-3 flex-1 overflow-y-auto space-y-3 ">
                      {tickets
                        .filter(t => (t.status || "Open") === status.id)
                        .filter(t => String(t.id || "").toLowerCase().includes(searchQuery.toLowerCase()) || String(t.customer_name || "").toLowerCase().includes(searchQuery.toLowerCase()))
                        .map(ticket => (
                           <div key={ticket.id} className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedTicketId(ticket.id)}>
                             <div className="flex justify-between items-start mb-2">
                                <span className="text-xs font-mono text-zinc-500">#{ticket.id.slice(-6).toUpperCase()}</span>
                                <span className="text-xs text-zinc-400">2h ago</span>
                             </div>
                             <h4 className="font-bold text-sm text-zinc-900 line-clamp-1">{ticket.customer_name || ticket.customer_business_then_name || "Unknown Customer"}</h4>
                             <p className="text-xs text-zinc-600 line-clamp-1 mt-1">{ticket.device_model || ticket.device}</p>
                           </div>
                        ))}
                    </div>
                 </div>
               ))}
             </div>
          ) : (
             <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden min-w-[800px]">
                <table className="w-full text-left text-sm">
                   <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-medium">
                     <tr>
                       <th className="px-6 py-4">ID</th>
                       <th className="px-6 py-4">Customer</th>
                       <th className="px-6 py-4">Device</th>
                       <th className="px-6 py-4">Status</th>
                       <th className="px-6 py-4">Date</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-zinc-100">
                     {tickets.map(ticket => (
                        <tr key={ticket.id} className="even:bg-white odd:bg-zinc-50/60 hover:bg-zinc-100/80 transition-colors cursor-pointer" onClick={() => setSelectedTicketId(ticket.id)}>
                          <td className="px-6 py-4 font-mono text-xs">#{ticket.id.slice(-6).toUpperCase()}</td>
                          <td className="px-6 py-4 font-semibold">{ticket.customer_name || ticket.customer_business_then_name || "Unknown"}</td>
                          <td className="px-6 py-4 text-zinc-600">{ticket.device_model || ticket.device}</td>
                          <td className="px-6 py-4">
                            <Badge variant="outline">{ticket.status || "Open"}</Badge>
                          </td>
                          <td className="px-6 py-4 text-zinc-400 text-xs">Recently</td>
                        </tr>
                     ))}
                   </tbody>
                </table>
             </div>
          )
        )}
      </div>
    </div>
  );
}
