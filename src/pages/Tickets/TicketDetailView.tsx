import React, { useState, useEffect } from "react";
import { 
  ChevronLeft, Wrench, Clock, MessageSquare, Paperclip, Activity, FileText, 
  Send, MoreVertical, CreditCard, Play, Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { doc, deleteDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { RealtimeManager } from "../../services/RealtimeManager";

interface TicketDetailViewProps {
  ticketId: string;
  onBack: () => void;
}

export function TicketDetailView({ ticketId, onBack }: TicketDetailViewProps) {
  const [ticket, setTicket] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!ticketId) return;
    const unsub = RealtimeManager.subscribe(`ticket_detail_${ticketId}`, doc(db, "tickets", ticketId), (data) => {
      if (data) {
        setTicket(data);
      }
      setIsLoading(false);
    });
    return () => unsub();
  }, [ticketId]);

  const [isDeleting, setIsDeleting] = useState(false);
  const handleDeleteTicket = async () => {
    if (!window.confirm(`Are you sure you want to delete ticket #${ticket?.id?.slice(-6) || ''}? This action cannot be undone.`)) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, "tickets", ticketId));
      onBack();
    } catch(err) {
      console.error(err);
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return <div className="h-full flex items-center justify-center">Loading ticket details...</div>;
  }

  if (!ticket) {
    return (
      <div className="h-full flex flex-col items-center justify-center">
        <p className="text-zinc-500 mb-4">Ticket not found.</p>
        <Button variant="outline" onClick={onBack}>Go Back</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-zinc-50 w-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 bg-white border-b border-border/30 flex items-center justify-between shrink-0 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack} className="-ml-2 text-zinc-500 hover:text-zinc-900">
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold flex items-center gap-2">
                Ticket #{ticket.id.slice(-6).toUpperCase()}
              </h1>
              <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-200">
                {ticket.status || "Open"}
              </Badge>
            </div>
            <p className="text-sm text-zinc-500">{ticket.customer_name || ticket.customer_business_then_name || "Unknown Customer"} • {ticket.device_model || ticket.device}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="hidden sm:flex">
            <CreditCard className="w-4 h-4 mr-2" /> Take Payment
          </Button>
          <Button className="shadow-sm">
            <Wrench className="w-4 h-4 mr-2" /> Update Status
          </Button>
          <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={handleDeleteTicket} disabled={isDeleting}>
            <Trash2 className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
        {/* Left Column - Main Details */}
        <div className="flex-1 overflow-y-auto  p-6">
          <Tabs defaultValue="overview" className="w-full">
             <TabsList className="grid w-full max-w-md grid-cols-4 mb-6 sticky top-0 z-20 bg-zinc-50 py-1">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
                <TabsTrigger value="communication">Comms</TabsTrigger>
                <TabsTrigger value="financials">Finance</TabsTrigger>
             </TabsList>

             <TabsContent value="overview" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Customer Info Card */}
                  <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm">
                    <h3 className="font-semibold text-zinc-900 mb-4 flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                        {(ticket.customer_name || ticket.customer_business_then_name) ? (ticket.customer_name || ticket.customer_business_then_name).charAt(0) : "?"}
                      </div>
                      Customer Details
                    </h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Name</span>
                        <span className="font-medium">{ticket.customer_name || ticket.customer_business_then_name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Phone</span>
                        <span className="font-medium text-primary cursor-pointer hover:underline">{ticket.customer_phone}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Email</span>
                        <span className="font-medium">{ticket.customer_email || "N/A"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Device Info Card */}
                  <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm">
                    <h3 className="font-semibold text-zinc-900 mb-4">Device Info</h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Device</span>
                        <span className="font-medium">{ticket.device}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Model</span>
                        <span className="font-medium">{ticket.device_model || "N/A"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Passcode</span>
                        <span className="font-mono bg-zinc-100 px-2 py-0.5 rounded">{ticket.passcode || "N/A"}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Issue Description */}
                <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm">
                   <h3 className="font-semibold text-zinc-900 mb-2">Issue Description</h3>
                   <p className="text-zinc-700 whitespace-pre-wrap text-sm leading-relaxed">
                     {ticket.issue || "No description provided."}
                   </p>
                </div>
                
                {/* Tech Notes */}
                <div className="bg-orange-50/50 p-5 rounded-2xl border border-orange-100 shadow-sm">
                   <h3 className="font-semibold text-orange-900 mb-2">Technician Notes</h3>
                   {ticket.technician_notes ? (
                     <p className="text-zinc-800 text-sm whitespace-pre-wrap">{ticket.technician_notes}</p>
                   ) : (
                     <p className="text-zinc-400 text-sm italic">No internal technician notes added yet.</p>
                   )}
                </div>
             </TabsContent>

             <TabsContent value="timeline">
                <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm min-h-[400px] flex items-center justify-center flex-col">
                  <Activity className="w-10 h-10 text-zinc-300 mb-3" />
                  <p className="text-zinc-500 font-medium">Timeline Refactor in Progress</p>
                  <p className="text-xs text-zinc-400 mt-1 max-w-xs text-center">We are optimizing Firestore listeners for the ticket timeline.</p>
                </div>
             </TabsContent>

             <TabsContent value="communication">
                <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm min-h-[400px] flex items-center justify-center flex-col">
                  <MessageSquare className="w-10 h-10 text-zinc-300 mb-3" />
                  <p className="text-zinc-500 font-medium">Communications Center</p>
                  <p className="text-xs text-zinc-400 mt-1 max-w-xs text-center">Unified SMS and Email threads will appear here.</p>
                </div>
             </TabsContent>
          </Tabs>
        </div>

        {/* Right Sidebar - Actions & Quick State */}
        <div className="w-full md:w-80 bg-white border-l border-zinc-200 p-6 overflow-y-auto hidden md:block">
           <h3 className="text-sm font-black tracking-wider text-zinc-400 uppercase mb-4">Quick Actions</h3>
           <div className="flex flex-col gap-2 mb-8">
             <Button variant="secondary" className="justify-start"><Clock className="w-4 h-4 mr-2 text-zinc-500" /> Log Time</Button>
             <Button variant="secondary" className="justify-start"><MessageSquare className="w-4 h-4 mr-2 text-zinc-500" /> Send SMS</Button>
             <Button variant="secondary" className="justify-start"><Play className="w-4 h-4 mr-2 text-zinc-500" /> Start Diagnosing</Button>
           </div>
           
           <h3 className="text-sm font-black tracking-wider text-zinc-400 uppercase mb-4">Ticket Status</h3>
           <div className="space-y-4">
             <div className="flex flex-col border border-zinc-200 rounded-xl overflow-hidden text-sm">
                <div className="p-3 bg-zinc-50 border-b border-zinc-200 font-semibold text-zinc-700">Aging</div>
                <div className="p-3 text-2xl font-black text-rose-600">3d 4h</div>
             </div>
             
             <div className="flex flex-col border border-zinc-200 rounded-xl overflow-hidden text-sm">
                <div className="p-3 bg-zinc-50 border-b border-zinc-200 font-semibold text-zinc-700">Parts Needed</div>
                <div className="p-3 text-zinc-500">None ordered</div>
             </div>
           </div>
        </div>
      </div>
    </div>
  );
}
