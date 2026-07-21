import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Clock, MessageSquare, AlertCircle, User, Wrench, Calendar, Bot } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Ticket } from "../types";
import { motion } from "motion/react";
import { doc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { db } from "../firebase";

interface TicketCardProps {
  ticket: Ticket;
  onClick?: () => void;
  variant?: "compact" | "full" | "mobile";
}

export function TicketCard({ ticket, onClick, variant = "full" }: TicketCardProps) {
  const isUrgent = ticket.priority === "Urgent" || ticket.priority === "High";
  const [isTagging, setIsTagging] = useState(false);
  const isTaggedRobot = Array.isArray(ticket.tags) && ticket.tags.includes("Robot Vac");
  
  const toggleRobotTag = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!ticket.id || isTagging) return;
    setIsTagging(true);
    try {
      const ticketRef = doc(db, "crm_tickets", ticket.id.toString());
      if (isTaggedRobot) {
        await updateDoc(ticketRef, { tags: arrayRemove("Robot Vac") });
      } else {
        await updateDoc(ticketRef, { tags: arrayUnion("Robot Vac") });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsTagging(false);
    }
  };

  const toggleUrgency = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!ticket.id) return;
    try {
      const ticketRef = doc(db, "crm_tickets", ticket.id.toString());
      const newPriority = isUrgent ? "Medium" : "Urgent";
      await updateDoc(ticketRef, { 
        priority: newPriority, 
        updated_at: new Date().toISOString() 
      });
    } catch (err) {
      console.error("Failed to toggle urgency:", err);
    }
  };
  
  const createdDate = ticket.created_at?.toDate ? ticket.created_at.toDate() : new Date(ticket.created_at || Date.now());
  const ageInDays = Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
  
  const statusColorMap: Record<string, string> = {
    "New": "bg-blue-500",
    "In Progress": "bg-amber-500",
    "Waiting for Parts": "bg-rose-500",
    "Ready for Pickup": "bg-emerald-500",
    "Resolved": "bg-zinc-500",
  };
  
  const accentColor = statusColorMap[ticket.status] || "bg-zinc-400";

  if (variant === "mobile") {
    return (
      <motion.div
        whileTap={{ scale: 0.98 }}
        onClick={onClick}
        className={`p-4 rounded-2xl border shadow-sm flex flex-col gap-3 transition-colors ${isUrgent ? 'bg-red-50/50 border-red-200 active:bg-red-50' : 'bg-white border-zinc-200 active:bg-zinc-50'}`}
      >
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-1">
             <span className="text-xs font-medium text-zinc-400 tracking-wide uppercase">#{ticket.number}</span>
             <h3 className="font-bold text-zinc-900 leading-tight line-clamp-1">{`${ticket.brand || ''} ${ticket.device_model || ''}`.trim() || ticket.subject || "No Device"}</h3>
          </div>
          <Badge className={`${accentColor} text-white border-none text-xs uppercase font-bold tracking-wider`}>
            {ticket.status}
          </Badge>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-xs text-zinc-500">
             <User className="w-3.5 h-3.5 shrink-0" />
             <span className="truncate max-w-[100px]">{ticket.customer_firstname || ticket.customer_business_then_name || 'Customer'}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-zinc-500 max-w-[150px]">
             <AlertCircle className="w-3.5 h-3.5 shrink-0" />
             <span className="truncate" title={ticket.issue_description || ticket.subject || ticket.problem_type}>{ticket.issue_description || ticket.subject || ticket.problem_type}</span>
          </div>
        </div>

        <div className="flex justify-between items-center pt-2 border-t border-zinc-100">
           <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 uppercase tracking-wide">
              <Clock className="w-3.5 h-3.5" />
              {formatDistanceToNow(createdDate)} ago
           </div>
           <button type="button" onClick={toggleUrgency} className="transition-transform hover:scale-110">
             {isUrgent ? (
               <Badge className="bg-red-50 text-red-600 border border-red-100 shadow-none px-2 py-0 h-5 text-[9px] font-semibold uppercase hover:bg-red-100">Urgent</Badge>
             ) : (
               <AlertCircle className="w-4 h-4 text-zinc-300 hover:text-zinc-500" />
             )}
           </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      whileHover={{ y: -2, boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)" }}
      onClick={onClick}
      className={`rounded-xl p-3 lg:p-4 border shadow-sm cursor-pointer group relative overflow-hidden transition-all flex flex-col gap-2 ${isUrgent ? 'bg-red-50/50 border-red-200 hover:border-red-300' : 'bg-white border-zinc-200 hover:border-zinc-300'}`}
    >
      <div className={`absolute top-0 left-0 w-full h-1 ${accentColor} opacity-80`} />
      
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold font-mono text-zinc-400 bg-zinc-50 px-1.5 py-0.5 rounded border border-zinc-100 tracking-wider">#{ticket.number}</span>
          <button 
            type="button" 
            onClick={toggleRobotTag} 
            disabled={isTagging}
            className={`p-1 rounded-md transition-colors ${isTaggedRobot ? 'bg-primary/10 text-primary' : 'bg-zinc-50 text-zinc-300 hover:text-zinc-500 hover:bg-zinc-100'}`}
            title="Tag as Robot Vac"
          >
            <Bot className="w-3 h-3" />
          </button>
        </div>
        <div className="flex items-center gap-1.5">
           {ageInDays > 3 && (
             <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-100 uppercase tracking-tighter">Aging</span>
           )}
           <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider truncate max-w-[120px] text-right" title={ticket.issue_description || ticket.subject || ticket.problem_type}>
             {ticket.issue_description || ticket.subject || ticket.problem_type}
           </span>
        </div>
      </div>
      
      <h4 className="font-bold text-sm text-zinc-900 leading-snug line-clamp-2 group-hover:text-primary transition-colors">
        {`${ticket.brand || ''} ${ticket.device_model || ''}`.trim() || ticket.subject || "No Device"}
      </h4>
      
      <div className="space-y-2 mt-1">
        <div className="flex items-center gap-2 border-t border-zinc-100 pt-2">
          <div className="w-5 h-5 rounded-full bg-zinc-100 flex items-center justify-center shrink-0">
             <User className="w-3 h-3 text-zinc-500" />
          </div>
          <span className="text-[11px] font-semibold text-zinc-700 truncate">
            {ticket.customer_name || ticket.customer_business_then_name || (ticket.customer_firstname ? `${ticket.customer_firstname} ${ticket.customer_lastname || ''}` : 'No Customer')}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <div className="flex items-center gap-1 text-[9px] font-bold text-zinc-400 uppercase tracking-wide">
            <Clock className="w-3 h-3" />
            {formatDistanceToNow(createdDate)}
          </div>
          <div className="flex gap-1.5 items-center">
             <button type="button" onClick={toggleUrgency} className="transition-transform hover:scale-105 flex items-center justify-center">
               {isUrgent ? (
                 <div className="flex items-center gap-1 px-2 h-5 rounded bg-red-100 text-red-700 border border-red-200 hover:bg-red-200 text-[9px] font-bold uppercase tracking-wider">
                    <AlertCircle className="w-3 h-3" /> Urgent
                 </div>
               ) : (
                 <div className="flex items-center gap-1 px-2 h-5 rounded bg-zinc-50 text-zinc-500 border border-zinc-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 text-[9px] font-bold uppercase tracking-wider transition-colors">
                    <AlertCircle className="w-3 h-3" /> Mark
                 </div>
               )}
             </button>
             <div className="w-5 h-5 rounded-full bg-zinc-50 flex items-center justify-center text-zinc-400 border border-zinc-100">
                <MessageSquare className="w-3 h-3" />
             </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
