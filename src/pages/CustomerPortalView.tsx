import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, collection, query, where, getDocs, orderBy, updateDoc, addDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { Clock, CheckCircle2, Wrench, Smartphone, Search, AlertCircle, Phone, Package, Download, Send, MessageSquare } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from "sonner";

function normalizePhone(p?: string | null): string {
  if (!p) return "";
  let clean = p.replace(/[^\d]/g, "");
  if (clean.startsWith("6104") && clean.length >= 11) {
    clean = "61" + clean.substring(2);
  } else if (clean.startsWith("04") && clean.length === 10) {
    clean = "61" + clean.substring(1);
  } else if (clean.startsWith("4") && clean.length === 9) {
    clean = "61" + clean;
  }
  return clean;
}

function cleanNoteBody(body: string): string {
  if (!body) return "";

  let clean = body;

  // 1. Check if it matches Workflow stage "..." SMS sent to customer.\nContent: "..."
  // Or simply if it has Content: "..." or Content: '...'
  const contentRegex = /Content:\s*["']([\s\S]+?)["']\s*$/i;
  const match = clean.match(contentRegex);
  if (match) {
    clean = match[1];
  } else {
    // Try searching for Content: without matching quotes at the end
    const contentRegexNoQuotes = /Content:\s*([\s\S]+)/i;
    const matchNoQuotes = clean.match(contentRegexNoQuotes);
    if (matchNoQuotes) {
      clean = matchNoQuotes[1];
    }
  }

  // 2. Remove all URLs
  clean = clean.replace(/https?:\/\/[^\s]+/gi, '');

  // 3. Remove customer-facing link instructions
  clean = clean.replace(/View\s*(?:&|and)\s*auth(?:orize)?\s*charges\s*online\s*here:?\s*$/i, '');
  clean = clean.replace(/View\s*(?:&|and)\s*auth(?:orize)?\s*charges\s*here:?\s*$/i, '');
  clean = clean.replace(/View\s*(?:&|and)\s*approve\s*charges\s*online\s*here:?\s*$/i, '');
  clean = clean.replace(/View\s*(?:&|and)\s*approve\s*charges\s*here:?\s*$/i, '');
  clean = clean.replace(/View\s*(?:&|and)\s*approve\s*online\s*here:?\s*$/i, '');
  clean = clean.replace(/View\s*(?:&|and)\s*approve\s*here:?\s*$/i, '');
  clean = clean.replace(/Authorize\s*here:?\s*$/i, '');
  clean = clean.replace(/View\s*(?:&|and)\s*authorize\s*charges\s*online\s*here:?\s*$/i, '');
  clean = clean.replace(/View\s*&\s*authorize\s*charges\s*online\s*here:?\s*$/i, '');

  // 4. Clean surrounding quotes or whitespace
  clean = clean.trim();
  if (clean.startsWith('"') && clean.endsWith('"')) {
    clean = clean.slice(1, -1);
  } else if (clean.startsWith("'") && clean.endsWith("'")) {
    clean = clean.slice(1, -1);
  }

  // 5. Clean up any leftover punctuation or trailing slashes/dashes
  clean = clean.trim().replace(/[,.:;\s]+$/, '');

  // If the parsed string is empty or contains only technical details, fall back to the original but strip url
  if (!clean || clean.includes("Workflow stage")) {
    return body.replace(/https?:\/\/[^\s]+/gi, '').trim();
  }

  return clean;
}

export function CustomerPortalView() {
  const { ticketId } = useParams();
  const [ticket, setTicket] = useState<any>(null);
  const [customer, setCustomer] = useState<any>(null);
  const [notes, setNotes] = useState<any[]>([]);
  const [estimate, setEstimate] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [isActionPending, setIsActionPending] = useState(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState('');
  
  // Messaging back state
  const [customerMessage, setCustomerMessage] = useState("");
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  const loadData = async () => {
     if (!ticketId) return;
     try {
        const docRef = doc(db, 'crm_tickets', ticketId);
        const snap = await getDoc(docRef);
        if (!snap.exists()) {
           setError("Ticket not found.");
           setLoading(false);
           return;
        }
        const tData: any = { id: snap.id, ...snap.data() };
        setTicket(tData);

        // Load customer if exists
        let customerObj: any = null;
        if (tData.customer_id) {
           const custRef = doc(db, 'crm_customers', String(tData.customer_id));
           const custSnap = await getDoc(custRef);
           if (custSnap.exists()) {
              customerObj = { id: custSnap.id, ...custSnap.data() };
           }
        }
        
        // Fallback using ticket fields if customer doesn't exist
        if (!customerObj) {
           customerObj = {
              id: tData.customer_id || tData.id,
              firstname: tData.customer_firstname || tData.customer_name?.split(' ')[0] || tData.contact_fullname?.split(' ')[0] || tData.customer_business_then_name?.split(' ')[0] || 'Customer',
              lastname: tData.customer_lastname || tData.customer_name?.split(' ').slice(1).join(' ') || tData.contact_fullname?.split(' ').slice(1).join(' ') || tData.customer_business_then_name?.split(' ').slice(1).join(' ') || '',
              fullname: tData.customer_name || tData.contact_fullname || tData.customer_business_then_name || 'Customer',
              phone: tData.phone || tData.customer_phone || tData.mobile || '',
              email: tData.email || '',
              is_stub: true
           };
        }
        setCustomer(customerObj);

        // Load activity feed
        const q = query(
           collection(db, 'crm_notes'), 
           where("ticket_id", "==", snap.id),
           orderBy("created_at", "desc")
        );
        const notesSnap = await getDocs(q);
        
        // Filter out "Internal Note" subject to protect store privacy
        const allNotes = notesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const publicNotes = allNotes.filter((n: any) => n.subject !== "Internal Note");
        setNotes(publicNotes);

        // Load recent estimate for approval
        const estQ = query(
           collection(db, 'estimates'),
           where("ticket_id", "==", snap.id),
           orderBy("created_at", "desc")
        );
        const estSnap = await getDocs(estQ);
        if (!estSnap.empty) {
           setEstimate({ id: estSnap.docs[0].id, ...estSnap.docs[0].data() });
        }

     } catch (err) {
        setError("Failed to load ticket.");
        console.error(err);
     } finally {
        setLoading(false);
     }
  };

  useEffect(() => {
    loadData();
  }, [ticketId]);

  const handleApproveEstimate = async () => {
    if (!ticket || !estimate) return;
    setIsActionPending(true);
    try {
      // 1. Update estimate status to APPROVED
      const estRef = doc(db, "estimates", estimate.id);
      await updateDoc(estRef, {
        status: "APPROVED",
        updated_at: new Date().toISOString()
      });

      // 2. Add activity notes
      await addDoc(collection(db, "crm_notes"), {
        ticket_id: ticket.id,
        body: `Customer approved the estimate ${estimate.estimate_number || ''} (total $${Number(estimate.total || 0).toFixed(2)}) online. Ready to proceed with repair.`,
        subject: "Quote Approved (Online)",
        tech: "Customer (Portal)",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // 3. Update the ticket status & stage notes
      const ticketRef = doc(db, "crm_tickets", ticket.id);
      const updatedNotes = {
        ...(ticket.stage_notes || {}),
        "Waiting on Customer": `Approved online at ${new Date().toLocaleTimeString()} - Total: $${Number(estimate.total || 0).toFixed(2)}`
      };
      await updateDoc(ticketRef, {
        status: "Waiting for Parts",
        stage_notes: updatedNotes,
        updated_at: new Date().toISOString()
      });

      await loadData();
      setEstimate((prev: any) => ({ ...prev, status: "APPROVED" }));
      setActionSuccessMessage("Thank you! Your repair quote has been approved. Our team will start repairs immediately.");
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to submit approval: " + err.message);
    } finally {
      setIsActionPending(false);
    }
  };

  const handleDeclineEstimate = async () => {
    if (!ticket || !estimate) return;
    setIsActionPending(true);
    try {
      // 1. Update estimate status to DECLINED
      const estRef = doc(db, "estimates", estimate.id);
      await updateDoc(estRef, {
        status: "DECLINED",
        updated_at: new Date().toISOString()
      });

      // 2. Add activity notes
      await addDoc(collection(db, "crm_notes"), {
        ticket_id: ticket.id,
        body: `Customer declined the estimate ${estimate.estimate_number || ''} of $${Number(estimate.total || 0).toFixed(2)} online.`,
        subject: "Quote Declined (Online)",
        tech: "Customer (Portal)",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // 3. Update ticket status to Declined
      const ticketRef = doc(db, "crm_tickets", ticket.id);
      const updatedNotes = {
        ...(ticket.stage_notes || {}),
        "Waiting on Customer": `Declined online at ${new Date().toLocaleTimeString()} - Total: $${Number(estimate.total || 0).toFixed(2)}`
      };
      await updateDoc(ticketRef, {
        status: "Declined",
        stage_notes: updatedNotes,
        updated_at: new Date().toISOString()
      });

      await loadData();
      setEstimate((prev: any) => ({ ...prev, status: "DECLINED" }));
      setActionSuccessMessage("You have declined the quote. Our technicians have been notified and will prepare your device accordingly.");
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to submit decline: " + err.message);
    } finally {
      setIsActionPending(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerMessage.trim() || !ticket || isSendingMessage) return;

    setIsSendingMessage(true);
    const textToSend = customerMessage.trim();

    try {
      const batch = writeBatch(db);
      
      const customerPhone = customer?.phone || customer?.mobile || ticket?.phone || ticket?.customer_phone || "";
      const customerName = customer?.fullname || (customer?.firstname && customer?.lastname ? `${customer.firstname} ${customer.lastname}` : "") || ticket?.customer_name || "Customer";
      const ticketNumber = ticket?.number || ticket?.id || "";

      // 1. Add note to crm_notes
      const noteRef = doc(collection(db, "crm_notes"));
      batch.set(noteRef, {
        ticket_id: ticket.id,
        body: textToSend,
        subject: "Message from Customer (Portal)",
        tech: customerName || "Customer",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // 2. Add message and update conversation if customer phone is available
      if (customerPhone) {
        const messageId = "portal_" + Date.now();
        const msgRef = doc(db, "messages", messageId);

        batch.set(msgRef, {
          from: customerPhone,
          to: "+61480807789",
          text: textToSend,
          timestamp: serverTimestamp(),
          status: "delivered",
          type: "inbound",
          customerId: customer?.id || ticket?.customer_id || null,
          customerName: customerName,
          isRCS: false,
          isInternal: false,
          isUnread: true,
          ticketNumber: ticketNumber,
        });

        const threadId = normalizePhone(customerPhone);
        if (threadId) {
          const convRef = doc(db, "conversations", threadId);
          batch.set(convRef, {
            customerId: customer?.id || ticket?.customer_id || null,
            customerName: customerName,
            phone: customerPhone,
            lastMessageAt: serverTimestamp(),
            lastMessagePreview: textToSend.substring(0, 100),
            lastMessageDirection: "inbound",
            lastMessageStatus: "delivered",
            unreadCount: 1,
            isUnread: true,
            isYourTurn: true,
            updatedAt: serverTimestamp(),
            ticketNumber: ticketNumber,
          }, { merge: true });
        }
      }

      await batch.commit();
      setCustomerMessage("");
      await loadData();
    } catch (err: any) {
      console.error("Failed to send message: ", err);
      toast.error("Failed to send message: " + err.message);
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleSmsStore = () => {
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const separator = isIos ? '&' : '?';
    const text = `Hi Phone Medic, I have a question about my repair ticket #${ticket?.number || ticket?.id || ''}`;
    window.location.href = `sms:+61480807789${separator}body=${encodeURIComponent(text)}`;
  };

  if (loading) return <div className="p-8 text-center bg-zinc-50 min-h-screen text-zinc-500">Loading your ticket status...</div>;
  if (error || !ticket) return <div className="p-8 text-center bg-zinc-50 min-h-screen text-rose-500 font-bold">{error}</div>;

  const isComplete = ticket.status === 'Resolved' || ticket.status === 'Ready for Pickup';

  return (
    <div className="min-h-screen bg-zinc-100 flex py-12 px-4 justify-center">
       <div className="max-w-2xl w-full space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200 text-center">
             <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600">
                <Wrench className="w-8 h-8" />
             </div>
             <h1 className="text-2xl font-black text-zinc-900 tracking-tight">RepairSync</h1>
             <p className="text-zinc-500 font-medium">Customer Portal</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
             <div className="p-6 border-b border-zinc-200">
                <div className="flex justify-between items-start mb-4">
                   <div>
                      <p className="text-xs font-bold text-zinc-400 uppercase tracking-wide mb-1">Ticket Number</p>
                      <p className="text-xl font-black font-mono text-zinc-900">#{ticket.number || ticket.id}</p>
                   </div>
                   <div className="text-right">
                      <p className="text-xs font-bold text-zinc-400 uppercase tracking-wide mb-1">Status</p>
                      <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5
                         ${isComplete ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}
                      `}>
                         {isComplete ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5 animate-pulse" />}
                         {ticket.status}
                      </div>
                   </div>
                </div>

                <div className="bg-zinc-50 border border-zinc-200/60 rounded-2xl p-4">
                   <p className="text-xs font-bold text-zinc-400 uppercase tracking-wide mb-2 flex items-center gap-1.5"><Smartphone className="w-3.5 h-3.5" /> Device Info</p>
                   <p className="font-semibold text-zinc-900 text-sm mb-1">{ticket.brand} {ticket.device_model}</p>
                   <p className="text-sm text-zinc-600">{ticket.subject || ticket.problem_type}</p>
                </div>
             </div>

             {/* Estimate Approvals Section */}
             {estimate && (
                <div className="p-6 border-b border-zinc-200 bg-zinc-50/10 space-y-4">
                   <div className="flex justify-between items-center bg-zinc-50 border border-zinc-150 p-3 rounded-xl">
                      <div>
                         <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Active Estimate</p>
                         <p className="text-sm font-black font-mono text-zinc-800">{estimate.estimate_number}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider
                         ${estimate.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800 border border-emerald-100' :
                           estimate.status === 'DECLINED' ? 'bg-rose-100 text-rose-800 border border-rose-105' :
                           'bg-purple-100 text-purple-800 border border-purple-105 animate-pulse'}
                      `}>
                         {estimate.status}
                      </span>
                   </div>

                   <div className="space-y-2">
                      <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Itemized Charges</p>
                      <div className="divide-y divide-zinc-100 border border-zinc-200/50 rounded-xl bg-white px-3.5">
                         {estimate.line_items?.map((item: any, idx: number) => (
                            <div key={item.id || idx} className="py-3 flex justify-between items-start gap-4 text-xs font-semibold">
                               <div className="min-w-0 flex-1">
                                  <p className="text-zinc-800">{item.name || "Repair Service"}</p>
                                  {item.description && <p className="text-[11px] text-zinc-400 font-normal leading-tight mt-0.5">{item.description}</p>}
                               </div>
                               <div className="text-right font-mono">
                                  <p className="text-zinc-900">${Number(item.unit_price).toFixed(2)}</p>
                                  {Number(item.quantity) > 1 && <p className="text-xs text-zinc-400 mt-0.5">Qty: {item.quantity}</p>}
                               </div>
                            </div>
                         ))}
                      </div>
                   </div>

                   <div className="bg-zinc-50/70 border border-zinc-150 rounded-xl p-3.5 space-y-2 text-xs font-semibold">
                      <div className="flex justify-between text-zinc-500">
                         <span>Subtotal</span>
                         <span className="font-mono">${Number(estimate.subtotal || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-zinc-950 text-sm font-bold border-t border-zinc-150 pt-2">
                         <span>Total Estimate</span>
                         <span className="font-mono">${Number(estimate.total || 0).toFixed(2)}</span>
                      </div>
                   </div>

                   {estimate.status === 'DRAFT' || estimate.status === 'PENDING' ? (
                      <div className="pt-2">
                         {actionSuccessMessage ? (
                            <div className="bg-emerald-50 border border-emerald-150 text-emerald-800 p-3 rounded-xl text-center text-xs font-bold">
                               {actionSuccessMessage}
                            </div>
                         ) : (
                            <div className="grid grid-cols-2 gap-3">
                               <button
                                  onClick={handleDeclineEstimate}
                                  disabled={isActionPending}
                                  className="h-10 bg-white hover:bg-zinc-50 text-zinc-600 font-bold border border-zinc-200 rounded-xl text-xs transition-colors shadow-sm"
                               >
                                  Decline Repair
                               </button>
                               <button
                                  onClick={handleApproveEstimate}
                                  disabled={isActionPending}
                                  className="h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs transition-colors flex items-center justify-center gap-1 shadow-sm"
                                >
                                  Approve Quote
                               </button>
                            </div>
                         )}
                      </div>
                   ) : (
                      <div className="bg-zinc-100 border border-zinc-200 text-zinc-650 p-3 rounded-xl text-xs font-bold text-center">
                         This quote has already been <span className="font-extrabold uppercase text-xs bg-zinc-250 text-zinc-800 px-1 py-0.5 rounded">{estimate.status}</span>.
                      </div>
                   )}
                </div>
             )}

             <div className="p-6 bg-zinc-50/50 space-y-4">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wide">Repair Activity timeline</h3>
                
                {/* Send message back directly to store */}
                <form onSubmit={handleSendMessage} className="bg-white border border-zinc-200 p-2 rounded-2xl shadow-sm flex items-end gap-2">
                   <textarea
                      value={customerMessage}
                      onChange={(e) => setCustomerMessage(e.target.value)}
                      placeholder="Message back to the store..."
                      className="flex-1 bg-transparent resize-none border-0 px-2 py-1.5 text-sm focus:ring-0 focus:outline-none min-h-[38px] max-h-[120px] text-zinc-800"
                      rows={1}
                      disabled={isSendingMessage}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage(e);
                        }
                      }}
                   />
                   <button
                      type="submit"
                      disabled={isSendingMessage || !customerMessage.trim()}
                      className="p-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl transition-all shadow-sm shrink-0 flex items-center justify-center"
                   >
                      {isSendingMessage ? (
                         <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                         <Send className="w-4 h-4" />
                      )}
                   </button>
                </form>

                <div className="space-y-4 pt-2">
                   {notes.length === 0 && (
                      <p className="text-sm text-zinc-500 italic">No notes yet. We'll update you soon!</p>
                   )}
                   {notes.map(note => {
                      const cleanedBody = cleanNoteBody(note.body);
                      if (!cleanedBody) return null; // Skip empty blocks

                      return (
                         <div key={note.id} className="relative pl-6">
                            <div className="absolute left-[7px] top-6 bottom-[-24px] w-px bg-zinc-200 last:hidden" />
                            <div className="absolute left-0 top-1.5 w-4 h-4 rounded-full bg-zinc-200 border border-white" />
                            <div className="bg-white border border-zinc-200 p-4 rounded-2xl shadow-sm text-sm">
                               <div className="flex justify-between items-start mb-1 gap-2">
                                 <span className="font-semibold text-zinc-900">{note.tech || 'Store'}</span>
                                 <span className="text-xs text-zinc-400 whitespace-nowrap">{formatDistanceToNow(new Date(note.created_at))} ago</span>
                               </div>
                               <p className="text-zinc-600 leading-snug" dangerouslySetInnerHTML={{__html: cleanedBody.replace(/\n/g, "<br/>")}} />
                            </div>
                         </div>
                      );
                   })}
                   <div className="h-6" />
                </div>
             </div>
          </div>

          <div className="text-center space-y-4">
             <p className="text-xs text-zinc-400 font-medium">Have questions about your repair?</p>
             <button 
                onClick={handleSmsStore}
                className="bg-white border border-zinc-200 shadow-sm text-zinc-700 px-6 py-2.5 rounded-full text-sm font-bold inline-flex items-center gap-2 hover:bg-zinc-50 transition-colors"
             >
                <MessageSquare className="w-4 h-4 text-zinc-500" /> SMS Store
             </button>
          </div>
       </div>
    </div>
  );
}

