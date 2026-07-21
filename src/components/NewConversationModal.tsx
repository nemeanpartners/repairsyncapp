import React, { useState, useEffect } from "react";
import { X, User, Loader2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import axios from "axios";
import { toast } from "sonner";
import { CustomerSearchBox } from "../features/customers/components/CustomerSearchBox";
import { NormalizedCustomer } from "../hooks/customers/useCustomerSearch";
import { collection, getDocs, query, where, orderBy, limit } from "firebase/firestore";
import { db } from "../firebase";

const DEFAULT_TEMPLATES = [
  { id: '1', text: "Hi {firstName}, how can I help you today?" },
  { id: '2', text: "Hi {firstName}, the quote for repairing your {device} is ready for review. Please reply to this SMS if you have any questions, or approve it so we can start work." },
  { id: '3', text: "Your {device} is ready for pickup." },
  { id: '4', text: "Your repair (Job #{ticketNumber}) is complete and your {device} is ready for pickup." },
  { id: '5', text: "We're currently looking into the issue with your {device} and will update you shortly." },
  { id: '6', text: "Thank you for choosing Phone Medic!" }
];

export function NewConversationModal({ isOpen, onClose, onConversationCreated }: { isOpen: boolean, onClose: () => void, onConversationCreated?: (conv: any) => void }) {
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  
  // Custom lookup
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedCustomerName, setSelectedCustomerName] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<NormalizedCustomer | null>(null);
  const [recentTicket, setRecentTicket] = useState<any | null>(null);
  const [templates, setTemplates] = useState<{ id: string, text: string }[]>(DEFAULT_TEMPLATES);

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const snapshot = await getDocs(collection(db, "chat_templates"));
        const fetched: {id: string, text: string}[] = [];
        snapshot.forEach((doc: any) => fetched.push({ id: doc.id, text: doc.data().text || ""}));
        if (fetched.length > 0) {
           setTemplates(fetched);
        }
      } catch (err) {
        console.error("Failed to fetch templates", err);
      }
    };
    if (isOpen) {
      fetchTemplates();
    }
  }, [isOpen]);

  const selectExistingCustomer = async (c: NormalizedCustomer) => {
    setSelectedCustomerId(c.customerId);
    // @ts-ignore compatibility
    setSelectedCustomerName(c.business_then_name || c.fullname || `${c.firstName || c.firstname || ''} ${c.lastName || c.lastname || ''}`.trim());
    setPhone(c.phone || "");
    setSelectedCustomer(c);
    
    // Fetch latest ticket context for template merging
    try {
      const ticketsRef = collection(db, "crm_tickets");
      // Use client side sorting if index isn't ready
      const q = query(ticketsRef, where("customer_id", "==", c.customerId));
      const snapshot = await getDocs(q);
      const tickets: any[] = [];
      snapshot.forEach(doc => {
         tickets.push({ id: doc.id, ...doc.data() });
      });
      // Sort descending by created_at
      tickets.sort((a, b) => {
         const tA = a.created_at?.toMillis ? a.created_at.toMillis() : Date.now();
         const tB = b.created_at?.toMillis ? b.created_at.toMillis() : Date.now();
         return tB - tA;
      });
      if (tickets.length > 0) {
         setRecentTicket(tickets[0]);
      } else {
         setRecentTicket(null);
      }
    } catch(err) {
      console.error("Could not fetch recent ticket", err);
    }
  };

  const handleTemplateSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
     const tId = e.target.value;
     if (!tId) return;
     const t = templates.find(temp => temp.id === tId);
     if (t) {
        let text = t.text;
        // @ts-ignore compatibility
        const fname = selectedCustomer?.firstName || selectedCustomer?.firstname || "";
        // @ts-ignore compatibility
        const lname = selectedCustomer?.lastName || selectedCustomer?.lastname || "";
        const cname = selectedCustomerName || "";
        const deviceType = recentTicket?.device_model || recentTicket?.subject || "device";
        
        text = text.replace(/{{customer\.firstname}}/gi, fname)
                   .replace(/{{customer\.first_name}}/gi, fname)
                   .replace(/{{customer\.lastname}}/gi, lname)
                   .replace(/{{customer\.last_name}}/gi, lname)
                   .replace(/{{customer\.name}}/gi, fname)
                   .replace(/{{customer\.fullname}}/gi, cname)
                   .replace(/{{customer\.business_name}}/gi, selectedCustomer?.businessName || "")
                   .replace(/{device}/ig, deviceType)
                   .replace(/{{device_type}}/ig, deviceType)
                   .replace(/{{device_model}}/ig, deviceType)
                   .replace(/{{ticket\.device_model}}/ig, deviceType)
                   .replace(/{firstName}/ig, fname) // Support {firstName} settings variables
                   .replace(/{lastName}/ig, lname)
                   .replace(/{customerName}/ig, cname)
                   .replace(/{ticketNumber}/ig, recentTicket?.number || "")
                   .replace(/{issue}/ig, recentTicket?.problem_type || "");
        
        setMessage(text);
     }
  };
  
  if (!isOpen) return null;

  const handleSend = async () => {
    if (!phone.trim() || !message.trim()) {
      toast.error("Please provide a phone number and message.");
      return;
    }

    setIsSending(true);
    try {
      await axios.post('/api/mobilemessage/send', {
        to: phone,
        message: message,
        customer_id: selectedCustomerId,
        ticket_id: recentTicket?.id
      });

      toast.success("Message sent successfully!");
      if (onConversationCreated) onConversationCreated(null);
      
      // reset forms
      setPhone("");
      setMessage("");
      setSelectedCustomerId(null);
      setSelectedCustomerName(null);
      setSelectedCustomer(null);
      setRecentTicket(null);
      
      onClose();
    } catch (e: any) {
      console.error("Failed to send message:", e);
      toast.error(e.response?.data?.error || "Failed to send message.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl sm:rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col relative animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-zinc-100 flex items-center justify-between bg-white relative z-10">
          <h3 className="text-lg font-black text-zinc-900">New Message</h3>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full text-zinc-400 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 bg-zinc-50/50">
           
           <div className="space-y-4">
              {!selectedCustomerId ? (
                  <CustomerSearchBox 
                    selectedCustomerId={selectedCustomerId}
                    onSelectCustomer={selectExistingCustomer}
                  />
              ) : (
                  <div className="flex items-center justify-between p-4 bg-blue-50 rounded-xl border border-blue-100">
                      <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                             <User className="w-5 h-5" />
                          </div>
                          <div>
                              <p className="text-sm font-black text-blue-900">{selectedCustomerName}</p>
                              <p className="text-xs font-bold text-blue-600/70">{phone}</p>
                          </div>
                      </div>
                      <button 
                         onClick={() => { setSelectedCustomerId(null); setSelectedCustomerName(null); setPhone(""); setSelectedCustomer(null); setRecentTicket(null); }}
                         className="p-2 text-blue-400 hover:text-blue-600 hover:bg-blue-100 rounded-full transition-colors"
                      >
                         <X className="w-4 h-4" />
                      </button>
                  </div>
              )}
           </div>

           {!selectedCustomerId && (
              <div className="flex items-center gap-4 py-2">
                 <div className="flex-1 h-px bg-zinc-200" />
                 <span className="text-xs font-bold text-zinc-400 uppercase">Or</span>
                 <div className="flex-1 h-px bg-zinc-200" />
              </div>
           )}

           <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wide pl-1">Phone Number *</label>
              <input 
                 type="tel"
                 placeholder="e.g. 0412345678"
                 className="w-full bg-white border border-zinc-200 rounded-xl h-12 px-4 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-bold text-zinc-900 shadow-sm transition-all"
                 value={phone}
                 onChange={(e) => setPhone(e.target.value)}
                 disabled={!!selectedCustomerId}
              />
           </div>

           <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wide pl-1">Message *</label>
              
              {templates.length > 0 && (
                <div className="mb-4 relative">
                  <select
                     className="w-full bg-white border border-zinc-200 rounded-xl h-10 pl-3 pr-8 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-zinc-900 shadow-sm transition-all  cursor-pointer"
                     onChange={handleTemplateSelect}
                     defaultValue=""
                  >
                     <option value="" disabled>Insert a template...</option>
                     {templates.map(t => (
                        <option key={t.id} value={t.id}>
                           {t.text.substring(0, 50)}{t.text.length > 50 ? '...' : ''}
                        </option>
                     ))}
                  </select>
                  <ChevronDown className="w-4 h-4 absolute right-3 top-3 text-zinc-400 pointer-events-none" />
                </div>
              )}

              <textarea 
                 placeholder="Type your message here..."
                 className="w-full bg-white border border-zinc-200 rounded-xl p-4 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-zinc-900 shadow-sm min-h-[120px] resize-none transition-all"
                 value={message}
                 onChange={(e) => setMessage(e.target.value)}
                 onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                       e.preventDefault();
                       handleSend();
                    }
                 }}
              />
           </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-white border-t border-zinc-100 flex justify-end gap-3 rounded-b-2xl sm:rounded-b-[2rem]">
           <Button variant="ghost" onClick={onClose} className="font-bold text-zinc-500 hover:text-zinc-900 rounded-xl">
              Cancel
           </Button>
           <Button 
               onClick={handleSend} 
               disabled={isSending || !phone.trim() || !message.trim()}
               className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-sm shadow-blue-600/20 px-6"
           >
              {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send Message"}
           </Button>
        </div>
      </div>
    </div>
  );
}
