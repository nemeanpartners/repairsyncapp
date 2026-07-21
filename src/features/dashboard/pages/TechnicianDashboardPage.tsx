import React, { useState, useEffect, useRef, useMemo } from "react";
import { useAuth } from "../../../providers/AuthProvider";
import { ScannerModal } from "../../../components/ScannerModal";
import { useWorkflowStore } from "../../../store/workflowStore";

import { 
  Wrench, 
  Clock, 
  MessageSquare, 
  AlertCircle, 
  CheckCircle2, 
  Camera, 
  Search,
  LayoutGrid,
  Plus,
  RefreshCw,
  Phone,
  Mail,
  User,
  Send,
  ArrowLeft,
  Paperclip,
  Check,
  ChevronRight,
  Loader2,
  Trash2,
  Bookmark,
  Sparkles,
  Inbox,
  Package,
  Sliders,
  LogOut,
  Target,
  Flame,
  CheckCircle,
  FileText
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { collection, query, where, orderBy, onSnapshot, limit, getDocs, updateDoc, doc, addDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { db, storage } from "../../../firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { toast } from "sonner";
import { QCChecklist } from "../../tickets/components/QCChecklist";
import { MessagingService } from "../../../services/MessagingService";

const FAST_NOTES_PRESETS = [
  "🔍 Diagnostic: Liquid trace found on board; ultrasound scrub completed.",
  "🔋 Battery Check: Swapped internal battery cells; verified peak health status at 100%.",
  "📺 Display Refurb: Swapped shattered layout glass assembly with premium micro-laminated OEM grade.",
  "⚙️ Calibration: recalibrated FaceID/TouchID elements and verified sensor arrays.",
  "🧪 Multi-Point QC passes: Stress tested motherboard, CPU thermal zones and speaker units. Perfect pass."
];

export function TechnicianDashboard() {
  const { user } = useAuth();
  const { toggleTechMode } = useWorkflowStore();
  const navigate = useNavigate();

  // Operating Perspective State (Core bottom-nav bar selector)
  const [activeOSTab, setActiveOSTab] = useState<"assigned" | "messages" | "parts" | "admin">("assigned");

  // State Management
  const [assignedTickets, setAssignedTickets] = useState<any[]>([]);
  const [allConversations, setAllConversations] = useState<any[]>([]);
  const [partsOrders, setPartsOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPulling, setIsPulling] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  
  // Selection
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  
  // Tab within detailed view
  const [detailTab, setDetailTab] = useState<"checklist" | "notes" | "sms" | "parts">("checklist");
  
  // Search state inside active tabs
  const [jobsSearch, setJobsSearch] = useState("");
  const [msgSearch, setMsgSearch] = useState("");
  const [partsSearch, setPartsSearch] = useState("");

  // Custom states inside detail tab
  const [noteText, setNoteText] = useState("");
  const [smsText, setSmsText] = useState("");
  const [isSendingSms, setIsSendingSms] = useState(false);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Sub-data for selected ticket
  const [notes, setNotes] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [customer, setCustomer] = useState<any>(null);

  // Upload input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active ticket loaded
  const activeTicket = assignedTickets.find(t => t.id === selectedTicketId);

  // Global counts
  const unreadMsgsTotal = allConversations.filter(c => c.isUnread).length;

  // 1. Fetch assigned tickets in realtime
  useEffect(() => {
    if (!user) return;
    
    const q = query(
      collection(db, "crm_tickets"),
      where("tech_id", "==", user.uid),
      orderBy("updated_at", "desc"),
      limit(50)
    );

    const unsub = onSnapshot(q, (snap) => {
      setAssignedTickets(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setIsLoading(false);
    }, (err) => {
      console.error("Failed to load assigned tickets:", err);
      setIsLoading(false);
    });

    return unsub;
  }, [user]);

  // 2. Fetch lightweight messages log statically (Cost Reduction)
  useEffect(() => {
    let active = true;
    const fetchConversations = async () => {
      try {
        const q = query(
          collection(db, "conversations"),
          orderBy("updatedAt", "desc"),
          limit(40)
        );
        const snap = await getDocs(q);
        if (active) setAllConversations(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Failed to fetch messages inbox:", err);
      }
    };
    
    fetchConversations();
    
    return () => {
      active = false;
    };
  }, []);

  // 3. Fetch parts orders log statically (Cost Reduction)
  useEffect(() => {
    let active = true;
    const fetchParts = async () => {
      try {
        const q = query(
          collection(db, "parts_orders"),
          orderBy("createdAt", "desc"),
          limit(100)
        );
        const snap = await getDocs(q);
        if (active) setPartsOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Failed to fetch parts index:", err);
      }
    };
    
    fetchParts();
    
    return () => {
      active = false;
    };
  }, []);

  // 4. Fetch sub-collections when a ticket is selected
  useEffect(() => {
    if (!selectedTicketId) {
      setNotes([]);
      setMessages([]);
      setAttachments([]);
      setCustomer(null);
      return;
    }

    // A. Fetch Notes
    const notesQ = query(
      collection(db, "crm_notes"),
      where("ticket_id", "==", selectedTicketId),
      orderBy("created_at", "desc"),
      limit(25)
    );
    const unsubNotes = onSnapshot(notesQ, (snap) => {
      setNotes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.error("TechnicianDashboardPage notes subscription error:", error);
    });

    // B. Fetch Messages
    let messagesQ;
    if (activeTicket?.customer_id) {
       messagesQ = query(
          collection(db, "messages"),
          where("customerId", "==", String(activeTicket.customer_id)),
          orderBy("timestamp", "desc"),
          limit(50)
       );
    } else {
       messagesQ = query(
          collection(db, "messages"),
          orderBy("timestamp", "desc"),
          limit(20)
       );
    }
    const unsubMsgs = onSnapshot(messagesQ, (snap) => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })).reverse());
    }, (error) => {
      console.error("TechnicianDashboardPage messages subscription error:", error);
    });

    // C. Fetch Attachments from crm_attachments
    const attachQ = query(
      collection(db, "crm_attachments"),
      where("ticketId", "==", selectedTicketId),
      orderBy("createdAt", "desc")
    );
    const unsubAttach = onSnapshot(attachQ, (snap) => {
      setAttachments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.error("TechnicianDashboardPage attachments subscription error:", error);
    });

    // D. Fetch customer profile
    if (activeTicket?.customer_id) {
       getDocs(query(collection(db, "crm_customers"), where("__name__", "==", String(activeTicket.customer_id))))
         .then(snap => {
            if (!snap.empty) {
              setCustomer({ id: snap.docs[0].id, ...snap.docs[0].data() });
            }
         });
    }

    return () => {
      unsubNotes();
      unsubMsgs();
      unsubAttach();
    };
  }, [selectedTicketId, activeTicket?.customer_id]);

  // Handle Scanning barcodes / QR codes
  const handleScan = async (code: string) => {
    setIsScannerOpen(false);
    toast.info("Scanning match for barcode input: " + code);
    
    let searchValue = code.trim();
    
    // Parse URL if the code looks like a link
    try {
      if (searchValue.startsWith('http://') || searchValue.startsWith('https://')) {
        const url = new URL(searchValue);
        const pathParts = url.pathname.split('/').filter(Boolean);
        // Look for pattern like /tickets/:id
        const ticketIndex = pathParts.findIndex(p => p.toLowerCase() === 'tickets' || p.toLowerCase() === 'ticket');
        if (ticketIndex !== -1 && pathParts[ticketIndex + 1]) {
           searchValue = pathParts[ticketIndex + 1];
        } else {
           searchValue = pathParts[pathParts.length - 1] || searchValue;
        }
      }
    } catch (e) {
      console.warn("Could not parse barcode as URL", e);
    }
    
    try {
      // 1. Check if the searchValue exactly matches a ticket ID
      const docRef = doc(db, "crm_tickets", searchValue);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
         setSelectedTicketId(docSnap.id);
         setActiveOSTab("assigned");
         toast.success("Ticket loaded from QR code!");
         return;
      }
    } catch(e) {
      console.error(e);
    }

    try {
      // 2. Check if searchValue is a ticket number or IMEI in active tickets
      const q1 = query(
        collection(db, "crm_tickets"), 
        // We can't use OR easily without a composite index if the fields are different, so we do separate queries or just get both
      );
      
      const [imeiSnap, numStrSnap, numNumSnap, numTObjSnap] = await Promise.all([
         getDocs(query(collection(db, "crm_tickets"), where("device_imei", "==", searchValue), limit(1))),
         getDocs(query(collection(db, "crm_tickets"), where("number", "==", searchValue), limit(1))),
         getDocs(query(collection(db, "crm_tickets"), where("number", "==", Number(searchValue)), limit(1))),
         getDocs(query(collection(db, "crm_tickets"), where("number", "==", `T-${searchValue}`), limit(1)))
      ]);

      const foundSnap = !imeiSnap.empty ? imeiSnap : (!numStrSnap.empty ? numStrSnap : (!numNumSnap.empty ? numNumSnap : (!numTObjSnap.empty ? numTObjSnap : null)));

      if (foundSnap && !foundSnap.empty) {
        setSelectedTicketId(foundSnap.docs[0].id);
        setActiveOSTab("assigned");
        toast.success("Found matching ticket in system!");
        return;
      }
    } catch(e) {
      console.error(e);
    }

    // 3. Check if matches parts order barcode
    try {
      const partsSnap = await getDocs(query(collection(db, "parts_orders"), limit(200)));
      const matchingPart = partsSnap.docs.find(d => d.id === searchValue || String(d.data().barcode || "").toLowerCase() === searchValue.toLowerCase());
      if (matchingPart) {
         await updateDoc(doc(db, "parts_orders", matchingPart.id), {
            status: "received",
            receivedAt: new Date().toISOString()
         });
         toast.success(`Success! Marked ${matchingPart.data().partName} as RECEIVED in stock.`);
         setActiveOSTab("parts");
         return;
      }
    } catch(e) {
      console.error(e);
    }

    toast.error("Barcode scanned successfully, but no matching dispatch ticket or spare-parts order was resolved.");
  };

  // Pull oldest new job assigning to self
  const pullJob = async () => {
    if (isPulling || !user) return;
    setIsPulling(true);
    try {
      const q = query(
        collection(db, "crm_tickets"),
        where("status", "==", "New"),
        orderBy("updated_at", "asc"),
        limit(1)
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        toast.info("The new repair dispatch stack is currently empty.");
        return;
      }
      const ticket = snap.docs[0];
      await updateDoc(doc(db, "crm_tickets", ticket.id), {
        tech_id: user.uid,
        status: "Diagnosing",
        updated_at: new Date().toISOString()
      });
      setSelectedTicketId(ticket.id);
      toast.success(`Unit pulled! Assigned into ticket #${ticket.data().number}`);
    } catch (err: any) {
      toast.error("Failed to assign new job: " + err.message);
    } finally {
      setIsPulling(false);
    }
  };

  // Fast Status stage toggle
  const updateTicketStatus = async (ticketId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, "crm_tickets", ticketId), {
        status: newStatus,
        updated_at: new Date().toISOString()
      });
      // Append an internal audit note automatically
      await addDoc(collection(db, "crm_notes"), {
        ticket_id: ticketId,
        body: `🔄 Stage updated to <strong>${newStatus}</strong>`,
        subject: "Workflow Audit",
        tech: user?.displayName || "Technician",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      toast.success(`Status updated to ${newStatus}`);
    } catch (err: any) {
      toast.error("Status update error: " + err.message);
    }
  };

  // Fast Note Save
  const saveNote = async () => {
    if (!noteText.trim() || !selectedTicketId || isAddingNote) return;
    setIsAddingNote(true);
    try {
      await addDoc(collection(db, "crm_notes"), {
        ticket_id: selectedTicketId,
        body: noteText.trim(),
        subject: "Internal Note",
        tech: user?.displayName || "Technician",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      setNoteText("");
      toast.success("Internal note logged.");
    } catch (err: any) {
      toast.error("Failed to append note: " + err.message);
    } finally {
      setIsAddingNote(false);
    }
  };

  // Modern outbound SMS
  const sendSMS = async () => {
    if (!smsText.trim() || !selectedTicketId || isSendingSms) return;
    setIsSendingSms(true);
    try {
      if (!customer?.phone && !customer?.mobile) {
          toast.error("Customer record is missing a valid mobile phone endpoint.");
          setIsSendingSms(false);
          return;
      }

      await MessagingService.sendMessage({
         to: customer.phone || customer.mobile,
         text: smsText.trim(),
         customerId: customer.id,
         customerName: `${customer.firstname || ''} ${customer.lastname || ''}`.trim()
      });

      // Post back to note history as SMS sent audit line
      await addDoc(collection(db, "crm_notes"), {
        ticket_id: selectedTicketId,
        body: `💬 Outbound SMS: "${smsText.trim()}"`,
        subject: "SMS Log",
        tech: user?.displayName || "Technician",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      setSmsText("");
      toast.success("RCS / SMS Dispatched successfully!");
    } catch (err: any) {
      toast.error("Sms transmission failure: " + err.message);
    } finally {
      setIsSendingSms(false);
    }
  };

  // Finger-Friendly attachments upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedTicketId) return;

    setIsUploading(true);
    try {
      const storageRef = ref(storage, `crm_attachments/${selectedTicketId}/${Date.now()}_${file.name}`);
      const uploadResult = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(uploadResult.ref);

      // Save attachment record in Firebase
      await addDoc(collection(db, "crm_attachments"), {
        ticketId: selectedTicketId,
        name: file.name,
        url: downloadURL,
        contentType: file.type || "image/jpeg",
        createdAt: serverTimestamp(),
        uploadedBy: user?.displayName || "Technician"
      });

      // Append note indicating file attached
      await addDoc(collection(db, "crm_notes"), {
        ticket_id: selectedTicketId,
        body: `📷 Photo added to job attachments: <a href="${downloadURL}" target="_blank" class="text-blue-500 font-bold underline inline-flex items-center gap-1">View Media</a>`,
        subject: "Media Log",
        tech: user?.displayName || "Technician",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      toast.success("Media file uploaded successfully");
    } catch (err: any) {
      toast.error("Photo upload failed: " + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  // Filter systems
  const filteredActiveJobs = useMemo(() => {
    const active = assignedTickets.filter(t => t.status !== 'Resolved' && t.status !== 'Invoiced' && t.status !== 'Closed');
    if (!jobsSearch.trim()) return active;
    const q = jobsSearch.toLowerCase();
    return active.filter(t => 
       String(t.number || "").includes(q) ||
       String(t.device_model || "").toLowerCase().includes(q) ||
       String(t.brand || "").toLowerCase().includes(q) ||
       String(t.subject || "").toLowerCase().includes(q)
    );
  }, [assignedTickets, jobsSearch]);

  const filteredConversations = useMemo(() => {
     if (!msgSearch.trim()) return allConversations;
     const q = msgSearch.toLowerCase();
     return allConversations.filter(c => 
        String(c.customerName || "").toLowerCase().includes(q) ||
        String(c.phone || "").includes(q) ||
        String(c.lastMessagePreview || "").toLowerCase().includes(q)
     );
  }, [allConversations, msgSearch]);

  const filteredParts = useMemo(() => {
     if (!partsSearch.trim()) return partsOrders;
     const q = partsSearch.toLowerCase();
     return partsOrders.filter(p => 
        String(p.partName || "").toLowerCase().includes(q) ||
        String(p.customerName || "").toLowerCase().includes(q) ||
        String(p.ticketNumber || "").includes(q) ||
        String(p.supplier || "").toLowerCase().includes(q)
     );
  }, [partsOrders, partsSearch]);

  const dailyResolvedCount = useMemo(() => {
     const todayStr = new Date().toISOString().split("T")[0];
     return assignedTickets.filter(t => {
        const isResolved = t.status === "Ready for Pickup" || t.status === "Closed" || t.status === "Resolved";
        const dateStr = t.updated_at ? t.updated_at.split("T")[0] : "";
        return isResolved && dateStr === todayStr;
     }).length;
  }, [assignedTickets]);

  const activeJobsCount = assignedTickets.filter(t => t.status !== 'Resolved' && t.status !== 'Invoiced' && t.status !== 'Closed').length;
  const urgentJobs = assignedTickets.filter(t => t.priority === 'Urgent' || t.priority === 'High');

  return (
    <div className="flex flex-col h-screen w-full bg-zinc-950 font-sans text-zinc-100 overflow-hidden select-none relative pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
      
      {/* 2-way toggle depending if ticket is opened */}
      <AnimatePresence mode="wait">
        {!selectedTicketId ? (
          
          /* ========================================================================= */
          /* MAIN OS CORE VIEWPORTS (TABS SELECTOR) */
          /* ========================================================================= */
          <motion.div 
            key="os_tabs"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col h-full overflow-hidden"
          >
            {/* STICKY HEADER CONSOLE PANEL */}
            <div className="p-4 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between shrink-0">
               <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0 shadow-[0_0_12px_rgba(16,185,129,0.8)]" />
                  <div>
                    <h1 className="text-xs font-black tracking-wide text-[#10b981] uppercase leading-none">
                       TechnicianOS v1.8
                    </h1>
                    <p className="text-xs text-zinc-400 font-bold uppercase tracking-wide mt-1">
                      {user?.displayName || "Repairs Station Tech"}
                    </p>
                  </div>
               </div>
               
               <div className="flex items-center gap-2">
                 <button 
                   onClick={() => setIsScannerOpen(true)}
                   className="bg-zinc-800 hover:bg-zinc-700/80 p-2 rounded-xl border border-zinc-700 text-zinc-300 flex items-center justify-center cursor-pointer hover:text-white"
                   title="Scan Barcode / IMEI Input"
                 >
                    <Camera className="w-5 h-5" />
                 </button>
               </div>
            </div>

            {/* TAB-SPECIFIC CONTENT BODY PANEL */}
            <div className="flex-1 overflow-y-auto">
              
              {/* TAB 1: WORK DISPATCH QUEUE */}
              {activeOSTab === "assigned" && (
                <div className="p-4 space-y-6 max-w-xl mx-auto">
                  
                  {/* AUTO INTENSE REPAIR STACK DISPATCHER */}
                  <div className="p-5 bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800/80 rounded-[1.8rem] shadow-2xl flex flex-col justify-between relative overflow-hidden group">
                     <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full filter blur-2xl" />
                     <div>
                        <span className="text-[9px] font-semibold uppercase tracking-wide text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                          Automatic Dispatch
                        </span>
                        <h3 className="text-sm font-black text-white mt-2.5">Queue Intake Puller</h3>
                        <p className="text-xs text-zinc-400 mt-1 leading-relaxed font-medium">
                          Claim and auto-assign the next waiting unassigned repair card straight into your tech work order stack.
                        </p>
                     </div>
                     <button
                        onClick={pullJob}
                        disabled={isPulling}
                        className="mt-4 w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-semibold uppercase tracking-wide text-xs py-3.5 rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer shadow-lg shadow-emerald-950/20"
                     >
                        {isPulling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4.5 h-4.5" />}
                        Dispatch Job to Work List
                     </button>
                  </div>

                  {/* ACTIVE JOBS OMNI SEARCH */}
                  <div className="relative">
                     <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                     <input 
                       type="text" 
                       placeholder="Filter your assigned repair cards..."
                       value={jobsSearch}
                       onChange={e => setJobsSearch(e.target.value)}
                       className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-700 font-medium font-sans"
                     />
                     {jobsSearch && (
                        <button onClick={() => setJobsSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 text-xs font-medium">CLEAR</button>
                     )}
                  </div>

                  {/* PRIORITY ALERTS / INTERCEPTS */}
                  {urgentJobs.length > 0 && !jobsSearch.trim() && (
                    <div className="space-y-2.5">
                       <span className="text-xs font-semibold uppercase text-red-500 tracking-wide flex items-center gap-1 ml-0.5">
                          <AlertCircle className="w-3.5 h-3.5 animate-bounce text-red-500" /> Critical Intercepts ({urgentJobs.length})
                       </span>
                       <div className="grid grid-cols-1 gap-2.5">
                          {urgentJobs.map(ticket => (
                             <div 
                               key={ticket.id}
                               onClick={() => setSelectedTicketId(ticket.id)}
                               className="bg-red-950/15 hover:bg-red-950/20 border border-red-900/30 p-3.5 rounded-xl flex items-center justify-between cursor-pointer active:scale-[0.99] transition-transform animate-pulse-slow"
                             >
                                <div className="space-y-1 min-w-0 pr-2">
                                   <div className="flex items-center gap-2 font-mono">
                                      <span className="text-[9px] font-black text-red-400 uppercase tracking-tight bg-red-950/30 border border-red-800/40 px-1 py-0.5 rounded">
                                        #{ticket.number}
                                      </span>
                                      <span className="text-[9px] font-black bg-rose-500/10 text-rose-400 uppercase px-1 rounded">URGENT</span>
                                   </div>
                                   <h4 className="font-bold text-sm text-white truncate">{ticket.brand} {ticket.device_model}</h4>
                                   <p className="text-xs text-red-100/70 truncate">{ticket.subject || "No problem detail logged"}</p>
                                </div>
                                <ChevronRight className="w-5 h-5 text-red-400/80 shrink-0" />
                             </div>
                          ))}
                       </div>
                    </div>
                  )}

                  {/* ACTIVE WORK ASSIGNMENTS (SWIPEABLE LIST) */}
                  <div className="space-y-3 pb-8">
                     <span className="text-xs font-semibold uppercase text-zinc-500 tracking-wide flex items-center gap-1.5 ml-0.5">
                        <Wrench className="w-3.5 h-3.5 text-[#10b981]" /> Active Repair Stack ({filteredActiveJobs.length})
                     </span>

                     <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider italic text-center py-1">
                       💡 Pro Tip: Swipe any card left to trigger fast stage actions!
                     </p>

                     <div className="grid grid-cols-1 gap-3">
                        {filteredActiveJobs.length > 0 ? (
                           filteredActiveJobs.map(ticket => (
                             <div 
                               key={ticket.id} 
                               className="relative overflow-hidden rounded-[1.4rem] bg-zinc-900 border border-zinc-800/80"
                             >
                                {/* Swipe Action Backplane Underlay */}
                                <div className="absolute inset-y-0 right-0 w-44 bg-zinc-950 flex items-center justify-end px-3 gap-2 z-0">
                                  <button 
                                    onClick={(e) => { 
                                      e.stopPropagation(); 
                                      updateTicketStatus(ticket.id, "Ready for Pickup"); 
                                    }} 
                                    className="bg-emerald-600 hover:bg-emerald-500 text-white p-2 w-18 h-12 rounded-xl text-[9px] font-semibold uppercase tracking-wide flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors"
                                    title="Complete repair"
                                  >
                                    <Check className="w-4 h-4" /> Ready
                                  </button>
                                  <button 
                                    onClick={(e) => { 
                                      e.stopPropagation(); 
                                      updateTicketStatus(ticket.id, "Waiting for Parts"); 
                                    }} 
                                    className="bg-zinc-800 hover:bg-zinc-700 text-amber-500 border border-zinc-700 p-2 w-18 h-12 rounded-xl text-[9px] font-semibold uppercase tracking-wide flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors"
                                    title="Put on spare parts hold"
                                  >
                                    <Clock className="w-3.5 h-3.5" /> Post Part
                                  </button>
                                </div>

                                {/* Drag/Swipe Content Layer */}
                                <motion.div
                                  drag="x"
                                  dragDirectionLock
                                  dragConstraints={{ left: -160, right: 0 }}
                                  dragElastic={{ left: 0.1, right: 0.05 }}
                                  className="relative z-10 bg-zinc-900 p-4 shrink-0 flex items-center justify-between cursor-pointer border border-transparent hover:border-zinc-800 rounded-[1.4rem] select-none active:scale-[0.99] transition-transform"
                                  onClick={() => setSelectedTicketId(ticket.id)}
                                >
                                   <div className="flex items-start gap-3 min-w-0 pr-4">
                                      {/* Device Brand Initial */}
                                      <div className="w-10 h-10 rounded-xl bg-zinc-950 border border-zinc-800 font-black text-sm text-[#10b981] flex items-center justify-center shrink-0 uppercase">
                                         {ticket.brand?.charAt(0) || "D"}
                                      </div>
                                      <div className="space-y-0.5 min-w-0">
                                         <div className="flex items-center gap-2 flex-wrap font-mono">
                                            <span className="text-xs font-medium text-zinc-500 leading-none mr-2">#{ticket.number}</span>
                                            <span className={`px-1 rounded font-sans leading-none text-[8.5px] font-semibold uppercase tracking-wide bg-zinc-800/80 ${
                                               ticket.status === 'Diagnosing' ? 'text-blue-400' :
                                               ticket.status === 'In Progress' ? 'text-amber-400' :
                                               ticket.status === 'Waiting for Parts' ? 'text-rose-400 bg-rose-950/20' :
                                               'text-zinc-300'
                                            }`}>
                                               {ticket.status}
                                            </span>
                                         </div>
                                         <h4 className="font-extrabold text-sm text-white truncate pr-1">{ticket.brand} {ticket.device_model}</h4>
                                         <p className="text-xs text-zinc-400 truncate leading-snug">{ticket.subject || "No core details logged"}</p>
                                      </div>
                                   </div>
                                   <ChevronRight className="w-5 h-5 text-zinc-500 group-hover:text-zinc-300 shrink-0" />
                                </motion.div>
                             </div>
                           ))
                        ) : (
                           <div className="border border-dashed border-zinc-800 rounded-2xl p-16 text-center text-zinc-500 flex flex-col items-center justify-center">
                              <Inbox className="w-8 h-8 opacity-25 mb-3" />
                              <p className="font-black text-sm text-zinc-400">Zero Repair Cards Filtered</p>
                              <p className="text-xs text-zinc-500 tracking-wider font-semibold uppercase mt-1">
                                No assigned repairs are currently active matching search criteria.
                              </p>
                           </div>
                        )}
                     </div>
                  </div>

                </div>
              )}

              {/* TAB 2: CENTRAL SMS LOG MESSAGES */}
              {activeOSTab === "messages" && (
                <div className="p-4 space-y-4 max-w-xl mx-auto pb-8">
                  <div className="flex flex-col gap-1.5">
                     <h3 className="text-sm font-semibold uppercase tracking-wide text-[#10b981]">Centralized Customer Chat</h3>
                     <p className="text-xs text-zinc-400">View recent incoming Customer SMS inquiries and dispatch updates.</p>
                  </div>

                  <div className="relative">
                     <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                     <input 
                       type="text" 
                       placeholder="Search active conversation threads..."
                       value={msgSearch}
                       onChange={e => setMsgSearch(e.target.value)}
                       className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none"
                     />
                  </div>

                  <div className="divide-y divide-zinc-900 bg-zinc-900/40 border border-zinc-900 rounded-2xl overflow-hidden mt-2">
                     {filteredConversations.length > 0 ? (
                        filteredConversations.map(conv => {
                           // Find corresponding ticket if any
                           const linkedTicket = assignedTickets.find(t => String(t.customer_id) === String(conv.customerId));
                           return (
                              <div 
                                key={conv.id}
                                onClick={() => {
                                   if (linkedTicket) {
                                      setSelectedTicketId(linkedTicket.id);
                                      setDetailTab("sms");
                                   } else {
                                      toast.warning("Customer details match open, but no active dispatch ticket is currently assigned to you.");
                                   }
                                }}
                                className={`p-4 flex items-start justify-between cursor-pointer hover:bg-zinc-900 transition-colors ${conv.isUnread ? 'bg-zinc-900/60' : ''}`}
                              >
                                 <div className="space-y-1.5 min-w-0 pr-4">
                                    <div className="flex items-center gap-2 flex-wrap">
                                       <span className="font-extrabold text-sm text-white">
                                          {conv.customerName || conv.phone || "Intake Customer"}
                                       </span>
                                       {conv.isUnread && (
                                          <span className="w-2 h-2 rounded-full bg-blue-500 shadow-md shadow-blue-500" />
                                       )}
                                    </div>
                                    <p className={`text-xs truncate ${conv.isUnread ? 'text-zinc-200 font-semibold' : 'text-zinc-400'}`}>
                                       {conv.lastMessagePreview || "No current communications"}
                                    </p>
                                    
                                    <div className="flex items-center gap-3">
                                       <span className="text-xs text-zinc-500 font-bold font-mono">
                                          {conv.updatedAt ? new Date(conv.updatedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ""}
                                       </span>
                                       {linkedTicket && (
                                          <span className="bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/20 font-bold font-mono text-[9px] px-1.5 py-0.5 rounded uppercase">
                                             Linked Job #{linkedTicket.number}
                                          </span>
                                       )}
                                    </div>
                                 </div>
                                 <ChevronRight className="w-5 h-5 text-zinc-600 self-center shrink-0" />
                              </div>
                           );
                        })
                     ) : (
                        <div className="p-12 text-center text-zinc-500 text-xs font-bold uppercase tracking-wide">
                           No customer communications resolved
                        </div>
                     )}
                  </div>
                </div>
              )}

              {/* TAB 3: PARTS & INVENTORY LOGGER */}
              {activeOSTab === "parts" && (
                <div className="p-4 space-y-4 max-w-xl mx-auto pb-8">
                  <div className="flex flex-col gap-1.5">
                     <h3 className="text-sm font-semibold uppercase tracking-wide text-[#10b981]">Parts directory lookup</h3>
                     <p className="text-xs text-zinc-400">Lookup requested spare elements, parts statuses, and suppliers instantly.</p>
                  </div>

                  <div className="relative">
                     <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                     <input 
                       type="text" 
                       placeholder="Filter by part name, ticket, supplier..."
                       value={partsSearch}
                       onChange={e => setPartsSearch(e.target.value)}
                       className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none"
                     />
                  </div>

                  <div className="grid grid-cols-1 gap-2.5 mt-2">
                     {filteredParts.length > 0 ? (
                        filteredParts.map(part => (
                           <div 
                              key={part.id}
                              className="bg-zinc-900 border border-zinc-800/80 p-4 rounded-xl flex items-center justify-between"
                           >
                              <div className="space-y-1 min-w-0 pr-3">
                                 <div className="flex items-center gap-2">
                                    <Package className="w-4 h-4 text-zinc-500 shrink-0" />
                                    <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider">{part.supplier || "Vendor Store / Scrap"}</span>
                                 </div>
                                 <h4 className="font-extrabold text-sm text-white truncate">{part.partName || "Unknown Component"}</h4>
                                 <div className="flex items-center gap-2 text-xs text-zinc-500 font-bold">
                                    <span>Client: {part.customerName || "N/A"}</span>
                                    <span>•</span>
                                    {part.ticketNumber && <span className="font-mono text-[#10b981]">Job #{part.ticketNumber}</span>}
                                 </div>
                              </div>
                              <span className={`px-2 py-1 rounded text-[9px] font-semibold uppercase tracking-wider ${
                                 part.status === "received" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                                 part.status === "ordered" ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" :
                                 "bg-zinc-800 text-zinc-400 border border-zinc-700"
                              }`}>
                                 {part.status || "ordered"}
                              </span>
                           </div>
                        ))
                     ) : (
                        <div className="border border-zinc-900 p-12 text-center text-zinc-600 font-semibold uppercase text-xs">
                           No stock orders registered
                        </div>
                     )}
                  </div>
                </div>
              )}

              {/* TAB 4: CONSOLE & PERFORMANCE METRICS */}
              {activeOSTab === "admin" && (
                <div className="p-4 space-y-6 max-w-xl mx-auto pb-12">
                   <div className="text-center space-y-2 py-4">
                      <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-xl">
                         <Wrench className="w-8 h-8 text-emerald-400" />
                      </div>
                      <h3 className="font-black text-lg text-white">Technician Operations Center</h3>
                      <p className="text-xs text-zinc-500 font-mono">STATION ONLINE • READY DISPATCH ASSIGNMENTS</p>
                   </div>

                   {/* PERFORMANCE METRICS GRID */}
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      <div className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-2xl flex items-center justify-between">
                         <div className="space-y-1">
                            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block">Today's Completed</span>
                            <span className="text-2xl font-black text-emerald-400">{dailyResolvedCount}</span>
                         </div>
                         <CheckCircle className="w-8 h-8 text-emerald-500/25 shrink-0" />
                      </div>

                      <div className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-2xl flex items-center justify-between">
                         <div className="space-y-1">
                            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block">Active Reparations</span>
                            <span className="text-2xl font-black text-teal-400">{activeJobsCount}</span>
                         </div>
                         <Target className="w-8 h-8 text-teal-500/25 shrink-0" />
                      </div>
                   </div>

                   {/* CORE CONSOLE DIRECT ACTION BUTTON */}
                   <div className="bg-gradient-to-br from-red-950/10 to-transparent border border-red-900/20 p-5 rounded-2xl space-y-3">
                      <div className="space-y-1">
                         <h4 className="font-bold text-sm text-red-400 flex items-center gap-1.5">
                           <LogOut className="w-4 h-4" /> Exit TechnicianOS Console
                         </h4>
                         <p className="text-xs text-zinc-400 leading-relaxed font-semibold">
                            Returns you back directly to the administrative CRM dashboard including reports, accounts, invoices, and settings profiles.
                         </p>
                      </div>
                      <button
                        onClick={toggleTechMode}
                        className="w-full bg-zinc-900 hover:bg-zinc-800 border border-red-900/30 text-white font-extrabold uppercase tracking-wide text-xs py-3 rounded-xl transition-all hover:border-red-600/50 cursor-pointer text-center"
                      >
                         Switch back to Main CRM Admin
                      </button>
                   </div>
                </div>
              )}

            </div>

          </motion.div>
        ) : (
          
          /* ========================================================================= */
          /* ULTRA STREAMLINED WORKFLOW COMPONENT DETAILS TRAY */
          /* ========================================================================= */
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
               <button 
                 onClick={() => setSelectedTicketId(null)}
                 className="flex items-center gap-1.5 text-xs text-zinc-400 font-extrabold uppercase tracking-wider h-9 px-3 hover:bg-zinc-800 rounded-xl outline-none cursor-pointer transition-colors"
               >
                  <ArrowLeft className="w-4 h-4" /> Back
               </button>
               <div className="text-center min-w-0 px-2">
                  <span className="text-xs font-mono text-zinc-500 font-bold">#{activeTicket?.number || "JOB"}</span>
                  <h4 className="font-extrabold text-sm text-white truncate max-w-[140px] md:max-w-xs">{activeTicket?.brand} {activeTicket?.device_model}</h4>
               </div>
               <div>
                  <span className="bg-emerald-600 text-white font-black text-[9px] uppercase tracking-wider px-2 py-1 rounded">
                     {activeTicket?.status}
                  </span>
               </div>
            </div>

            {/* Client micro context strip */}
            <div className="bg-zinc-900/40 p-3 border-b border-zinc-950 flex items-center justify-between text-xs font-semibold px-4 shrink-0 text-zinc-400">
               <div className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                  <span className="truncate max-w-[120px]">{customer ? `${customer.firstname || ''} ${customer.lastname || ''}`.trim() : "Intake Client"}</span>
               </div>
               <div className="flex items-center gap-4">
                  {customer?.phone && (
                     <a href={`tel:${customer.phone}`} className="flex items-center gap-1 hover:text-white transition-colors py-1 px-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <Phone className="w-3.5 h-3.5" />
                        <span>Call</span>
                     </a>
                  )}
               </div>
            </div>

            {/* Sub Tabs control header */}
            <div className="bg-zinc-900/80 px-2 pt-1 border-b border-zinc-800 shrink-0 flex gap-0.5">
               {(["checklist", "notes", "sms", "parts"] as const).map(tab => (
                  <button
                     key={tab}
                     onClick={() => setDetailTab(tab)}
                     className={`flex-1 text-center py-2.5 text-xs font-semibold uppercase tracking-wide border-b-2 outline-none transition-all ${
                        detailTab === tab 
                          ? "border-[#10b981] text-white font-bold" 
                          : "border-transparent text-zinc-500 hover:text-zinc-300"
                     }`}
                  >
                     {tab}
                  </button>
               ))}
            </div>

            {/* Active Content Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-20 scrollbar-thin">
               
               {/* 1. Checklist Tab */}
               {detailTab === "checklist" && (
                  <div className="space-y-4 max-w-xl mx-auto">
                     <div className="bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800">
                        <span className="text-[9px] font-semibold uppercase tracking-wide text-[#10b981] block mb-1">
                          Assigned Problem Diagnosis
                        </span>
                        <p className="text-xs font-semibold text-zinc-300 leading-snug">{activeTicket?.subject || "No descriptions detailed on ticket intake."}</p>
                     </div>
                     
                     <div className="rounded-2xl">
                        <QCChecklist 
                          ticketId={selectedTicketId || ""} 
                          category={activeTicket?.repair_category || activeTicket?.device_model || "smartphone"} 
                        />
                     </div>
                  </div>
               )}

               {/* 2. Notes Tab with inline add */}
               {detailTab === "notes" && (
                  <div className="space-y-4 max-w-xl mx-auto h-full flex flex-col justify-between">
                     <div className="flex-1 min-h-[160px] overflow-y-auto space-y-2.5">
                        {notes.length > 0 ? (
                           notes.map(note => (
                              <div key={note.id} className="bg-zinc-900/40 border border-zinc-900 p-3.5 rounded-xl space-y-2">
                                 <div className="flex justify-between items-start text-xs text-zinc-500 font-bold">
                                    <span>{note.tech || "System Tech"}</span>
                                    <span>{note.created_at ? new Date(note.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ""}</span>
                                 </div>
                                 <p className="text-xs text-zinc-300 leading-relaxed font-sans" dangerouslySetInnerHTML={{ __html: note.body }} />
                              </div>
                           ))
                        ) : (
                           <div className="text-center py-12 text-zinc-600 font-extrabold uppercase text-xs tracking-wider">No logged internal comments.</div>
                        )}
                     </div>

                     <div className="border-t border-zinc-900 pt-3 flex flex-col gap-3 shrink-0">
                        
                        {/* ULTRA-FAST TECH NOTE FORM PRESETS */}
                        <div className="space-y-1 px-1">
                           <span className="text-[8.5px] uppercase font-semibold text-zinc-500 tracking-wider block">Rapid Notes Presets:</span>
                           <div className="flex gap-1.5 overflow-x-auto pb-1 max-w-full whitespace-nowrap scrollbar-thin">
                              {FAST_NOTES_PRESETS.map((preset, pIdx) => (
                                 <button
                                    key={pIdx}
                                    type="button"
                                    onClick={() => setNoteText(prev => (prev ? prev + " " : "") + preset)}
                                    className="bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold text-zinc-300 px-3 py-1.5 rounded-xl border border-zinc-800 active:scale-95 transition-all outline-none cursor-pointer inline-block shrink-0"
                                 >
                                    {preset.substring(0, 18)}...
                                 </button>
                              ))}
                           </div>
                        </div>

                        <div className="flex flex-col gap-2">
                           <textarea 
                             placeholder="Write technical internal note or tap a preset above..." 
                             value={noteText}
                             onChange={e => setNoteText(e.target.value)}
                             className="w-full h-18 px-3 py-2 text-xs bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-700 resize-none font-medium text-zinc-200"
                           />
                           <button 
                             onClick={saveNote}
                             disabled={isAddingNote || !noteText.trim()}
                             className="w-full bg-[#10b981] hover:bg-emerald-500 text-black py-3 rounded-xl text-xs uppercase font-semibold tracking-wide flex items-center justify-center gap-1.5 active:scale-95 transition-colors font-sans cursor-pointer disabled:opacity-40"
                           >
                              {isAddingNote ? "Adding Note..." : "Save Technical Audit Note"}
                           </button>
                        </div>
                     </div>
                  </div>
               )}

               {/* 3. Outbound SMS Communication Client */}
               {detailTab === "sms" && (
                  <div className="space-y-4 max-w-xl mx-auto h-full flex flex-col justify-between">
                     <div className="flex-1 min-h-[160px] overflow-y-auto space-y-2 bg-zinc-900/10 p-2.5 rounded-2xl border border-zinc-900">
                        {messages.length > 0 ? (
                           messages.map(msg => {
                              const isOutbound = msg.type === "outbound";
                              return (
                                 <div key={msg.id} className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
                                    <div 
                                       className={`p-3 rounded-2xl max-w-[85%] text-xs shadow-md space-y-1 ${
                                         isOutbound 
                                           ? "bg-emerald-600 text-white rounded-tr-none" 
                                           : "bg-zinc-850 text-zinc-200 rounded-tl-none border border-zinc-800"
                                       }`}
                                    >
                                       <p className="font-semibold leading-relaxed font-sans">{msg.text}</p>
                                       <span className="text-[8px] opacity-70 block text-right font-mono">
                                          {msg.timestamp ? new Date(msg.timestamp?.seconds ? msg.timestamp.seconds * 1000 : Date.now()).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : ""}
                                       </span>
                                    </div>
                                 </div>
                              );
                           })
                        ) : (
                           <div className="text-center py-12 text-zinc-600 font-extrabold uppercase text-xs">No direct chat history.</div>
                        )}
                     </div>

                     <div className="border-t border-zinc-900 pt-3 flex flex-col gap-2 shrink-0">
                        {/* Templates shortcut chips */}
                        <div className="flex gap-1.5 overflow-x-auto pb-1 whitespace-nowrap scrollbar-thin">
                           {["Diagnostic completed.", "Ready for Pickup.", "Waiting for parts approval."].map(tc => (
                              <button 
                                key={tc} 
                                onClick={() => setSmsText(tc)}
                                className="bg-zinc-900 hover:bg-zinc-850 px-3 py-1.5 text-[9.5px] uppercase font-bold text-zinc-400 rounded-xl border border-zinc-850 active:scale-95 transition-all outline-none cursor-pointer"
                              >
                                 {tc}
                              </button>
                           ))}
                        </div>
                        <div className="flex gap-2">
                           <input 
                             type="text" 
                             placeholder="Message client directly..." 
                             value={smsText}
                             onChange={e => setSmsText(e.target.value)}
                             onKeyDown={e => {
                                if (e.key === 'Enter') sendSMS();
                             }}
                             className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-zinc-700 font-medium text-zinc-200"
                           />
                           <button 
                             onClick={sendSMS}
                             disabled={isSendingSms || !smsText.trim()}
                             className="bg-emerald-600 hover:bg-emerald-500 p-3 rounded-xl flex items-center justify-center text-white active:scale-95 transition-colors outline-none cursor-pointer disabled:opacity-40"
                           >
                              {isSendingSms ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                           </button>
                        </div>
                     </div>
                  </div>
               )}

               {/* 4. Parts & Orders requirement Tab */}
               {detailTab === "parts" && (
                  <div className="space-y-4 max-w-xl mx-auto">
                     <div className="bg-zinc-900/60 border border-zinc-800 p-5 rounded-2xl text-center">
                        <Wrench className="w-8 h-8 mx-auto text-zinc-600 mb-2.5" />
                        <h4 className="font-extrabold text-xs uppercase tracking-wide text-[#10b981]">Parts inventory lookup</h4>
                        <p className="text-xs text-zinc-400 mt-1 max-w-xs mx-auto">Requires spare component assignment. Request matching parts for {activeTicket?.brand}.</p>
                        <button 
                          onClick={() => {
                             toast.success("Dispatcher request sent to spare parts stack!");
                          }}
                          className="mt-4 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-xs uppercase font-bold tracking-wider text-white border border-zinc-700 transition-all outline-none cursor-pointer"
                        >
                           Request Parts Dispatch
                        </button>
                     </div>
                  </div>
               )}

            </div>

            {/* STICKY WORKFLOW BOTTOM CONTROLS (ALWAYS FLOATING WHEN TICKET OPENED) */}
            <div className="fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-800 p-2.5 py-4 flex items-center justify-around gap-2.5 z-44 select-none pb-safe">
               {/* Quick Attachment triggering */}
               <input 
                 type="file" 
                 ref={fileInputRef} 
                 onChange={handleFileUpload} 
                 accept="image/*" 
                 className="hidden" 
               />
               <button 
                 onClick={() => fileInputRef.current?.click()}
                 disabled={isUploading}
                 className="flex flex-col items-center justify-center gap-1 w-12 text-zinc-450 active:scale-90 transition-all outline-none cursor-pointer"
               >
                  <div className="w-9 h-9 rounded-xl bg-zinc-800/80 hover:bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                     {isUploading ? <Loader2 className="w-4 h-4 animate-spin text-[#10b981]" /> : <Camera className="w-4 h-4 text-zinc-300" />}
                  </div>
                  <span className="text-[8px] font-semibold uppercase tracking-wide">Photo</span>
               </button>

               {/* Quick Checklist tab shortcut */}
               <button 
                 onClick={() => { setDetailTab("checklist"); }}
                 className="flex flex-col items-center justify-center gap-1 w-12 text-zinc-450 active:scale-90 transition-all outline-none cursor-pointer"
               >
                  <div className="w-9 h-9 rounded-xl bg-zinc-800/80 hover:bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                     <CheckCircle2 className="w-4 h-4 text-[#10b981]" />
                  </div>
                  <span className="text-[8px] font-semibold uppercase tracking-wide">QC</span>
               </button>

               {/* Rapid action trigger: move to next stage (Waiting on parts/QC/etc) */}
               <div className="relative group flex flex-col items-center justify-center cursor-pointer">
                  <select 
                     onChange={(e) => updateTicketStatus(selectedTicketId || "", e.target.value)}
                     value={activeTicket?.status || "New"}
                     className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-25"
                  >
                     <option value="New">New Intake</option>
                     <option value="Diagnosing">Diagnosing</option>
                     <option value="In Progress">In Progress</option>
                     <option value="Waiting for Parts">Parts Hold</option>
                     <option value="Ready for Pickup">Ready Pickup</option>
                  </select>
                  <button className="flex flex-col items-center justify-center gap-1 w-16 text-zinc-450 active:scale-90 transition-all outline-none pointer-events-none">
                     <div className="w-9 h-9 rounded-xl bg-zinc-800/80 border border-zinc-700 flex items-center justify-center">
                        <Wrench className="w-4 h-4 text-amber-500" />
                     </div>
                     <span className="text-[8px] font-semibold uppercase tracking-wide leading-none text-center">Stage</span>
                  </button>
               </div>

               {/* Quick resolve / pickup closure action */}
               <button 
                 onClick={() => updateTicketStatus(selectedTicketId || "", "Ready for Pickup")}
                 className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-semibold text-xs uppercase tracking-wide text-[#000] shadow-xl flex items-center justify-center gap-1 active:scale-95 transition-all outline-none cursor-pointer"
               >
                  <Check className="w-4 h-4" /> Resolve Repair
               </button>
            </div>

          </motion.div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      /* PERSISTENT BOTTOM NAVIGATION (ONLY VISIBLE WHEN IN MAIN WORKSPACE) */
      /* ========================================================================= */
      {!selectedTicketId && (
         <div className="fixed bottom-0 left-0 right-0 h-[calc(4.5rem+env(safe-area-inset-bottom))] bg-zinc-900 border-t border-zinc-800/80 flex items-center justify-around px-2 pb-[env(safe-area-inset-bottom)] z-[65] shrink-0 shadow-[0_-8px_20px_rgba(0,0,0,0.6)] select-none">
            {/* Nav Active Work order jobs */}
            <button
              onClick={() => setActiveOSTab("assigned")}
              className={`flex flex-col items-center justify-center p-1 relative w-16 h-12 transition-all group outline-none cursor-pointer ${activeOSTab === "assigned" ? 'text-[#10b981]' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              <div className={`flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-300 ${activeOSTab === "assigned" ? 'bg-emerald-500/10' : 'group-hover:bg-zinc-800'}`}>
                <Wrench className={`w-5 h-5 transition-transform duration-300 ${activeOSTab === "assigned" ? 'scale-110' : ''}`} strokeWidth={2.5} />
              </div>
              <span className={`text-[9px] font-semibold uppercase tracking-wider mt-0.5 transition-colors ${activeOSTab === "assigned" ? 'text-[#10b981]' : 'text-zinc-500'}`}>
                 Work Space
              </span>
            </button>

            {/* Nav central customer communications */}
            <button
              onClick={() => setActiveOSTab("messages")}
              className={`flex flex-col items-center justify-center p-1 relative w-16 h-12 transition-all group outline-none cursor-pointer ${activeOSTab === "messages" ? 'text-[#10b981]' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              <div className={`flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-300 ${activeOSTab === "messages" ? 'bg-emerald-500/10' : 'group-hover:bg-zinc-800'}`}>
                <MessageSquare className={`w-5 h-5 transition-transform duration-300 ${activeOSTab === "messages" ? 'scale-110' : ''}`} strokeWidth={2.5} />
              </div>
              <span className={`text-[9px] font-semibold uppercase tracking-wider mt-0.5 transition-colors ${activeOSTab === "messages" ? 'text-[#10b981]' : 'text-zinc-500'}`}>
                 SMS Chat
              </span>
              {unreadMsgsTotal > 0 && (
                 <span className="absolute top-0 right-1.5 bg-red-600 text-white min-w-[16px] h-4 rounded-full text-[9px] font-black flex items-center justify-center px-1 border border-zinc-900 shadow-md">
                   {unreadMsgsTotal}
                 </span>
              )}
            </button>

            {/* Nav inventory parts listing */}
            <button
              onClick={() => setActiveOSTab("parts")}
              className={`flex flex-col items-center justify-center p-1 relative w-16 h-12 transition-all group outline-none cursor-pointer ${activeOSTab === "parts" ? 'text-[#10b981]' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              <div className={`flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-300 ${activeOSTab === "parts" ? 'bg-emerald-500/10' : 'group-hover:bg-zinc-800'}`}>
                <Package className={`w-5 h-5 transition-transform duration-300 ${activeOSTab === "parts" ? 'scale-110' : ''}`} strokeWidth={2.5} />
              </div>
              <span className={`text-[9px] font-semibold uppercase tracking-wider mt-0.5 transition-colors ${activeOSTab === "parts" ? 'text-[#10b981]' : 'text-zinc-500'}`}>
                 Parts Box
              </span>
            </button>

            {/* Nav system metrics config toggle */}
            <button
              onClick={() => setActiveOSTab("admin")}
              className={`flex flex-col items-center justify-center p-1 relative w-16 h-12 transition-all group outline-none cursor-pointer ${activeOSTab === "admin" ? 'text-[#10b981]' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              <div className={`flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-300 ${activeOSTab === "admin" ? 'bg-emerald-500/10' : 'group-hover:bg-zinc-800'}`}>
                <Sliders className={`w-5 h-5 transition-transform duration-300 ${activeOSTab === "admin" ? 'scale-110' : ''}`} strokeWidth={2.5} />
              </div>
              <span className={`text-[9px] font-semibold uppercase tracking-wider mt-0.5 transition-colors ${activeOSTab === "admin" ? 'text-[#10b981]' : 'text-zinc-500'}`}>
                 OS Switch
              </span>
            </button>
         </div>
      )}

      {/* QR Code / IMEI camera scanner modal */}
      {isScannerOpen && (
         <ScannerModal 
           onClose={() => setIsScannerOpen(false)}
           onScan={handleScan}
         />
      )}

    </div>
  );
}
