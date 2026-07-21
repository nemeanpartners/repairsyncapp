import React, { useState, useEffect, useRef } from "react";
import { db, storage } from "../../../firebase";
import { collection, query, where, orderBy, getDocs, updateDoc, doc, addDoc, serverTimestamp, onSnapshot } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { motion } from "motion/react";
import { toast } from "sonner";
import { 
  ArrowLeft, User, MessageSquare, Flame, CheckCircle, 
  Trash2, FileText, Send, Loader2, Sparkles, Plus, Image as ImageIcon
} from "lucide-react";
import { QCChecklist } from "../../tickets/components/QCChecklist";

interface Props {
  ticket: any;
  onClose: () => void;
  onStatusChange: (status: string) => Promise<void>;
  currentUser: any;
}

export function DashboardTicketDetail({ ticket, onClose, onStatusChange, currentUser }: Props) {
  const [detailTab, setDetailTab] = useState<"checklist" | "notes" | "sms" | "parts">("checklist");
  
  const [notes, setNotes] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [customer, setCustomer] = useState<any>(null);

  const [noteText, setNoteText] = useState("");
  const [smsText, setSmsText] = useState("");
  const [isSendingSms, setIsSendingSms] = useState(false);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // File upload
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!ticket) return;

    // A. Fetch Notes
    const notesQ = query(collection(db, "crm_notes"), where("ticket_id", "==", ticket.id), orderBy("created_at", "desc"));
    const unsubNotes = onSnapshot(notesQ, (snap) => {
      setNotes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.error("DashboardTicketDetail notes query error:", error);
    });

    // B. Fetch Messages
    let unsubMsgs = () => {};
    if (ticket.customer_id) {
       const msgsQ = query(
          collection(db, "messages"),
          where("customerId", "==", String(ticket.customer_id)),
          orderBy("timestamp", "desc")
       );
       unsubMsgs = onSnapshot(msgsQ, (snap) => {
         setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })).reverse());
       }, (error) => {
         console.error("DashboardTicketDetail messages query error:", error);
       });
    }

    // C. Fetch Customer
    if (ticket.customer_id) {
       getDocs(query(collection(db, "crm_customers"), where("__name__", "==", String(ticket.customer_id))))
         .then(snap => {
            if (!snap.empty) setCustomer({ id: snap.docs[0].id, ...snap.docs[0].data() });
         });
    }

    return () => {
      unsubNotes();
      unsubMsgs();
    };
  }, [ticket]);

  // Actions
  const addNote = async () => {
    if (!noteText.trim() || isAddingNote) return;
    setIsAddingNote(true);
    try {
      await addDoc(collection(db, "crm_notes"), {
        ticket_id: ticket.id,
        body: noteText.trim(),
        created_at: serverTimestamp(),
        author: currentUser?.displayName || "System"
      });
      setNoteText("");
      toast.success("Note added");
    } catch (err) {
      toast.error("Failed to add note");
    } finally {
      setIsAddingNote(false);
    }
  };

  const sendSms = async () => {
    if (!smsText.trim() || isSendingSms) return;
    setIsSendingSms(true);
    try {
      await addDoc(collection(db, "messages"), {
        customerId: ticket.customer_id,
        direction: "outbound",
        text: smsText.trim(),
        timestamp: serverTimestamp(),
        senderId: currentUser?.uid || "system"
      });
      setSmsText("");
      toast.success("SMS queued");
    } catch (err) {
      toast.error("Failed to queue SMS");
    } finally {
      setIsSendingSms(false);
    }
  };

  return (
    <motion.div 
      key="details"
      initial={{ opacity: 0, x: 25 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -25 }}
      transition={{ type: "spring", stiffness: 350, damping: 30 }}
      className="flex flex-col h-full bg-zinc-950 text-zinc-100 overflow-hidden relative"
    >
      {/* Nav & Info Context Container */}
      <div className="p-4 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between shrink-0">
         <button onClick={onClose} className="flex items-center gap-1.5 text-xs text-zinc-400 font-extrabold uppercase tracking-wider h-9 px-3 hover:bg-zinc-800 rounded-xl outline-none cursor-pointer transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back
         </button>
         <div className="text-center min-w-0 px-2">
            <span className="text-xs font-mono text-zinc-500 font-bold">#{ticket?.number || "JOB"}</span>
            <h4 className="font-extrabold text-sm text-white truncate max-w-[140px] md:max-w-xs">{ticket?.brand} {ticket?.device_model}</h4>
         </div>
         <div>
            <span className="bg-emerald-600 text-white font-black text-[9px] uppercase tracking-wider px-2 py-1 rounded">
               {ticket?.status}
            </span>
         </div>
      </div>

      {/* Detail view content placeholder */}
      <div className="flex-1 overflow-y-auto p-4 content-container">
          <QCChecklist ticketId={ticket.id} category="general" />
          {/* Note: I'll expand this with everything from TechnicianDashboardPage.tsx */}
          <div className="mt-8 flex gap-4">
             <button
               onClick={() => onStatusChange("Ready for Pickup")}
               className="bg-emerald-600 px-6 py-3 rounded text-white font-bold text-xs"
             >
                MARK: READY FOR PICKUP
             </button>
          </div>
      </div>
    </motion.div>
  );
}
