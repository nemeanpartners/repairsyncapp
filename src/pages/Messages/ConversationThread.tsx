import React, { useState, useEffect, useRef } from "react";
import { collection, query, limit, getDocs, doc, updateDoc, where, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";
import { Send, ArrowLeft, Clock, AlertCircle, Sparkles, RefreshCw, Tag, Plus, X, Check, ListTodo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMessagesStore, ChatMessage } from "../../stores/messages";
import { useConversationsStore } from "../../stores/conversations";
import { MessagesService } from "../../services/messages";
import { MessagingService } from "../../services/MessagingService";
import { normalizePhone } from "../../services/conversations";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { InlineTaskList } from "../../components/Tasks/InlineTaskList";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";

const QUICK_RESPONSES = [
  { name: "Greeting", text: "Hi {firstName}, how can I help you today?" },
  { name: "Quote Ready", text: "Hi {firstName}, the quote for repairing your {device} is ready for review. Please reply to this SMS if you have any questions, or approve it so we can start work." },
  { name: "Repair Complete", text: "Your {device} is ready for pickup." },
  { name: "Job Complete", text: "Your repair (Job #{ticketNumber}) is complete and your {device} is ready for pickup." },
  { name: "Investigating", text: "We're currently looking into the issue with your {device} and will update you shortly." },
  { name: "Thank You", text: "Thank you for choosing Phone Medic!" },
  { name: "Google Review", text: "Hi {firstName}, thanks for choosing Phone Medic Milton! We'd really appreciate it if you could leave us a quick Google review here: https://tinyurl.com/2avrh2sx" }
];

export function ConversationThread({ conversation: propConversation, onBack }: { conversation: any, onBack?: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { messages, isLoading, subscribeToThread, addOptimisticMessage, updateMessageStatus } = useMessagesStore();
  const { optimisticMoveToTop, addLabelToConversation, removeLabelFromConversation, dismissYourTurnLabel } = useConversationsStore();

  const [liveConversation, setLiveConversation] = useState<any>(propConversation);
  const [replyText, setReplyText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [linkedTicket, setLinkedTicket] = useState<any>(null);
  const [chatTemplates, setChatTemplates] = useState<{name: string, text: string}[]>(QUICK_RESPONSES);
  const [isLabelMenuOpen, setIsLabelMenuOpen] = useState(false);
  const [newLabelInput, setNewLabelInput] = useState("");
  const [callLogs, setCallLogs] = useState<any[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  // Sync prop to live state
  useEffect(() => {
    setLiveConversation(propConversation);
  }, [propConversation]);

  // Sync draft query param to replyText
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const draft = params.get("draft");
    if (draft) {
      setReplyText(draft);
      
      // Clear draft query param from URL so it doesn't persist if they type or navigate away
      const newParams = new URLSearchParams(location.search);
      newParams.delete("draft");
      const search = newParams.toString();
      navigate({ search: search ? `?${search}` : "" }, { replace: true });
    }
  }, [location.search, navigate]);

  const conversationIdRaw = liveConversation?.conversationId || (liveConversation?.phone ? normalizePhone(liveConversation.phone) : liveConversation?.id);
  const conversationId = conversationIdRaw ? String(conversationIdRaw) : "";
  const activeLabels = (liveConversation?.labels || []).filter((l: any) => !l.dismissed);

  // Subscribe to live metadata for labels, isUnread, etc.
  useEffect(() => {
    if (!conversationId) return;
    const unsub = onSnapshot(doc(db, "conversations", conversationId), (snap) => {
      if (snap.exists()) {
        setLiveConversation((prev: any) => ({
          ...prev,
          ...snap.data(),
          conversationId: snap.id
        }));
      }
    }, (error) => {
      console.error("ConversationThread onSnapshot error:", error);
    });
    return () => unsub();
  }, [conversationId]);

  // Combine messages + callLogs
  const allTimelineItems = [...messages, ...callLogs];
  allTimelineItems.sort((a, b) => {
    const aTime = a.timestamp?.seconds ? a.timestamp.seconds * 1000 : (a.timestamp?.toMillis ? a.timestamp.toMillis() : new Date(a.timestamp).getTime());
    const bTime = b.timestamp?.seconds ? b.timestamp.seconds * 1000 : (b.timestamp?.toMillis ? b.timestamp.toMillis() : new Date(b.timestamp).getTime());
    return aTime - bTime;
  });

  // Fetch local call_logs
  useEffect(() => {
    if (!propConversation?.phone) return;
    const fetchCalls = async () => {
      try {
        const qCrm = query(collection(db, 'call_logs'), where("phoneNumber", "==", propConversation.phone), limit(20));
        const snap = await getDocs(qCrm);
        const fetchedLogs = snap.docs.map(d => {
          const data = d.data();
          return {
            id: d.id,
            type: data.direction === 'Incoming' ? 'inbound' : 'outbound',
            isCall: true,
            callStatus: data.status,
            text: data.notes || `Call: ${data.status}`,
            timestamp: data.createdAt || { toDate: () => new Date() },
          };
        });
        setCallLogs(fetchedLogs);
      } catch (err) {
        console.error("Failed to fetch call logs", err);
      }
    };
    fetchCalls();
  }, [propConversation?.phone]);

  // 1. Fetch Chat templates
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const snapshot = await getDocs(collection(db, "chat_templates"));
        const templates: {name: string, text: string}[] = [];
        snapshot.forEach(doc => {
          if (doc.data().text) {
            templates.push({
              name: doc.data().name || doc.data().text.substring(0, 30) + '...',
              text: doc.data().text
            });
          }
        });
        if (templates.length > 0) {
          setChatTemplates(templates);
        }
      } catch (e) {
        console.error("Failed to fetch chat templates", e);
      }
    };
    fetchTemplates();
  }, []);

  // 2. Load linked ticket details
  useEffect(() => {
    if (!liveConversation) return;

    if (liveConversation.ticketNumber) {
      const fetchTicket = async () => {
        try {
          const qStr = query(collection(db, "crm_tickets"), where("number", "==", String(liveConversation.ticketNumber)), limit(1));
          const qInt = query(collection(db, "crm_tickets"), where("number", "==", Number(liveConversation.ticketNumber)), limit(1));
          
          const [snapStr, snapInt] = await Promise.all([getDocs(qStr), getDocs(qInt)]);
          const ticketDoc = snapStr.docs[0] || snapInt.docs[0];
          
          if (ticketDoc) {
            setLinkedTicket({ id: ticketDoc.id, ...ticketDoc.data() });
          }
        } catch (e) {
          console.error("Failed to fetch linked ticket details", e);
        }
      };
      fetchTicket();
    }

    // Mark as read in Firestore
    if (liveConversation.isUnread && conversationId) {
      const markAsRead = async () => {
        try {
          await updateDoc(doc(db, "conversations", conversationId), { isUnread: false, unreadCount: 0 });
        } catch (e) {
          console.error("Failed to mark as read", e);
        }
      };
      markAsRead();
    }
  }, [liveConversation?.ticketNumber, liveConversation?.isUnread, conversationId]);

  const handleLinkedJobClick = async () => {
    if (linkedTicket?.id) {
      navigate(`/tickets/${linkedTicket.id}`);
      return;
    }
    if (liveConversation?.ticketNumber) {
      try {
        const qStr = query(collection(db, "crm_tickets"), where("number", "==", String(liveConversation.ticketNumber)), limit(1));
        const qInt = query(collection(db, "crm_tickets"), where("number", "==", Number(liveConversation.ticketNumber)), limit(1));
        const [snapStr, snapInt] = await Promise.all([getDocs(qStr), getDocs(qInt)]);
        const ticketDoc = snapStr.docs[0] || snapInt.docs[0];
        if (ticketDoc) {
          navigate(`/tickets/${ticketDoc.id}`);
        } else {
          toast.error("Linked ticket not found");
        }
      } catch (e) {
        console.error("Failed to navigate to linked ticket", e);
        toast.error("Failed to find linked ticket");
      }
    }
  };

  // 3. Subscribe to Conversation messages
  useEffect(() => {
    if (!liveConversation?.phone) return;
    const unsub = subscribeToThread(liveConversation.customerId, liveConversation.phone);
    return () => unsub();
  }, [liveConversation?.phone, liveConversation?.customerId, subscribeToThread]);

  // 4. Stay pinned to chat bottom
  useEffect(() => {
    if (messages.length > 0 && viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
    }
  }, [messages]);

  // Execute actual message sending workflow
  const executeSendMessage = async (textToSend: string, tempId: string) => {
    if (!liveConversation?.phone) return;
    const params = {
      to: liveConversation.phone,
      text: textToSend,
      customerId: liveConversation.customerId || null,
      customerName: liveConversation.customerName || null,
      ticketNumber: liveConversation.ticketNumber || null,
      isInternal: false,
    };

    // Trigger atomic write + transport dispatch
    await MessagesService.sendSmsMessage(
      params,
      tempId,
      (remoteMsgId, transport) => {
        updateMessageStatus(tempId, "sent");
      },
      (errMessage) => {
        updateMessageStatus(tempId, "failed", errMessage);
      }
    );
  };

  const handleSend = async () => {
    const trimmed = replyText.trim();
    if (!trimmed || !liveConversation?.phone || !conversationId) return;

    const tempId = `temp_${Date.now()}`;

    // 1. Instantly place optimistic Local message
    const optMsg: ChatMessage = {
      id: tempId,
      from: "system-agent",
      to: liveConversation.phone,
      text: trimmed,
      timestamp: { toDate: () => new Date(), seconds: Date.now() / 1000 },
      status: "sending",
      type: "outbound"
    };
    addOptimisticMessage(optMsg);

    // 2. Instantly move thread to the top of the Sidebar panel
    optimisticMoveToTop(conversationId, {
      text: trimmed,
      direction: "outbound",
      phone: liveConversation.phone,
      customerId: liveConversation.customerId,
      customerName: liveConversation.customerName,
      ticketNumber: liveConversation.ticketNumber
    });

    // 3. Reset input field instantly
    setReplyText("");

    // 4. Begin actual network send workflow
    await executeSendMessage(trimmed, tempId);
  };

  const handleRetry = async (msg: ChatMessage) => {
    updateMessageStatus(msg.id, "sending");
    await executeSendMessage(msg.text, msg.id);
  };

  const handleGenerateAIResponse = async () => {
    if (messages.length === 0) return;
    setIsGenerating(true);
    try {
      const recentMessages = messages.slice(-10).map(m => ({
        sender: (m.type === "outbound" || m.isInternal) ? "Phone Medic" : (m.customerName || "Customer"),
        text: m.text
      }));

      const res = await fetch("/api/ai/draft-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recentMessages })
      });
      
      const data = await res.json();

      if (data.reply) {
        setReplyText(data.reply.trim());
      } else {
        toast.error(data.error || "Failed to generate AI response.");
      }
    } catch (e) {
      console.error("AI Generation Error: ", e);
      toast.error("Failed to generate AI response. Have you set up the Gemini API key?");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white relative font-sans">
      {/* Header */}
      <div className="py-2.5 px-4 md:px-6 border-b border-zinc-200 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0 bg-white z-20 w-full relative">
        <div className="flex items-start gap-4">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack} className="md:hidden mr-1 mt-0.5 text-zinc-500 cursor-pointer">
              <ArrowLeft className="w-5 h-5 text-zinc-600" />
            </Button>
          )}
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              {liveConversation?.customerId ? (
                <h3 
                  className="font-bold text-zinc-900 leading-tight cursor-pointer hover:underline"
                  onClick={() => navigate(`/customers/${liveConversation.customerId}`)}
                >
                  {liveConversation?.customerName || liveConversation?.phone || "Unknown Customer"}
                </h3>
              ) : (
                <h3 className="font-bold text-zinc-900 leading-tight">
                  {liveConversation?.customerName || liveConversation?.phone || "Unknown Customer"}
                </h3>
              )}
              <span className="text-xs text-zinc-400 font-semibold font-mono">{liveConversation?.phone}</span>
            </div>
            
            {/* Active Labels row */}
            <div className="flex items-center gap-1.5 flex-wrap min-h-[24px]">
              <span className="text-xs uppercase font-bold text-zinc-400 mr-0.5 flex items-center gap-1">
                <Tag className="w-3 h-3" /> Labels:
              </span>
              
              {activeLabels.map((l: any) => {
                const labelColor = 
                  l.label === "urgent" ? "bg-red-50 text-red-700 border-red-200" :
                  l.label === "your_turn" ? "bg-amber-50 text-amber-700 border-amber-200" :
                  "bg-zinc-100 text-zinc-700 border-zinc-200";

                return (
                  <span key={l.label} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${labelColor} shadow-3xs`}>
                    {l.label.replace("_", " ")}
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        const fallbackMeta = {
                          phone: liveConversation?.phone,
                          customerId: liveConversation?.customerId,
                          customerName: liveConversation?.customerName,
                          ticketNumber: liveConversation?.ticketNumber,
                          labels: liveConversation?.labels || []
                        };
                        if (l.label === "your_turn") {
                          dismissYourTurnLabel(conversationId, fallbackMeta);
                        } else {
                          removeLabelFromConversation(conversationId, l.label, fallbackMeta);
                        }
                      }}
                      className="hover:bg-black/10 rounded p-0.5 transition-colors cursor-pointer ml-0.5 inline-flex items-center justify-center"
                      title={l.label === "your_turn" ? "Snooze/Dismiss 'Your Turn'" : `Remove label: ${l.label}`}
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                );
              })}
              
              {/* Popover trigger */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsLabelMenuOpen(!isLabelMenuOpen)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 active:scale-95 transition-all cursor-pointer shadow-3xs"
                >
                  <Plus className="w-3 h-3 text-zinc-500" /> Add Label
                </button>
                
                {isLabelMenuOpen && (
                  <div className="absolute left-0 mt-2 w-64 rounded-xl bg-white border border-zinc-200 shadow-xl z-50 p-3.5 flex flex-col gap-3 animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="flex items-center justify-between pb-1 border-b border-zinc-100">
                      <span className="text-xs font-bold text-zinc-800">Manage Labels</span>
                      <button 
                        onClick={() => setIsLabelMenuOpen(false)}
                        className="text-zinc-400 hover:text-zinc-600 p-0.5 rounded cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    
                    {/* Add custom text form */}
                    <form 
                      onSubmit={(e) => {
                        e.preventDefault();
                        const val = newLabelInput.trim().toLowerCase();
                        if (val && conversationId) {
                          addLabelToConversation(conversationId, val, {
                            phone: liveConversation?.phone,
                            customerId: liveConversation?.customerId,
                            customerName: liveConversation?.customerName,
                            ticketNumber: liveConversation?.ticketNumber,
                            labels: liveConversation?.labels || []
                          });
                          setNewLabelInput("");
                        }
                      }}
                      className="flex items-center gap-1.5"
                    >
                      <input 
                        type="text"
                        placeholder="Create custom label..."
                        value={newLabelInput}
                        onChange={(e) => setNewLabelInput(e.target.value)}
                        className="flex-1 text-xs px-2.5 py-1.5 bg-zinc-50 hover:bg-zinc-100 focus:bg-white border border-zinc-200 rounded-lg outline-none font-medium text-zinc-700 transition-colors"
                      />
                      <button
                        type="submit"
                        disabled={!newLabelInput.trim()}
                        className="px-2.5 py-1.5 bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-45 text-xs font-bold rounded-lg transition-colors cursor-pointer shrink-0"
                      >
                        Add
                      </button>
                    </form>
                    
                    {/* Preset checkboxes */}
                    <div className="space-y-1.5">
                      <span className="text-[9px] uppercase font-semibold text-zinc-400 tracking-wider block">Suggested Labels</span>
                      <div className="grid grid-cols-2 gap-1.5">
                        {["urgent", "no_reply", "parts_pending", "follow_up", "waiting_customer", "completed", "ryan"].map((preset) => {
                          const active = activeLabels.some((al: any) => al.label === preset);
                          return (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => {
                                if (!conversationId) return;
                                const fallbackMeta = {
                                  phone: liveConversation?.phone,
                                  customerId: liveConversation?.customerId,
                                  customerName: liveConversation?.customerName,
                                  ticketNumber: liveConversation?.ticketNumber,
                                  labels: liveConversation?.labels || []
                                };
                                if (active) {
                                  removeLabelFromConversation(conversationId, preset, fallbackMeta);
                                } else {
                                  addLabelToConversation(conversationId, preset, fallbackMeta);
                                }
                              }}
                              className={`text-xs font-semibold px-2 py-1.5 rounded bg-zinc-50 border text-left transition-all uppercase tracking-wide cursor-pointer flex items-center justify-between ${
                                active 
                                  ? "bg-blue-50 text-blue-800 border-blue-200 font-bold" 
                                  : "bg-zinc-50 hover:bg-zinc-100 text-zinc-600 border-zinc-200"
                              }`}
                            >
                              <span>{preset.replace("_", " ")}</span>
                              {active && <span className="text-blue-600 font-extrabold text-[9px]">✓</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          <Dialog>
            <DialogTrigger render={
              <button className="bg-white hover:bg-zinc-50 px-3 py-1.5 rounded-lg border border-zinc-200 flex items-center gap-2 self-start md:self-auto shadow-3xs cursor-pointer transition-colors" />
            }>
              <ListTodo className="w-3.5 h-3.5 text-zinc-400" />
              <span className="text-xs font-bold text-zinc-600">Tasks</span>
            </DialogTrigger>
            <DialogContent className="max-w-md bg-zinc-50 border border-zinc-200 text-zinc-900 p-0 rounded-2xl overflow-hidden h-[600px] flex flex-col">
              <DialogHeader className="px-5 pt-5 pb-2 shrink-0">
                <DialogTitle>Conversation Tasks</DialogTitle>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto p-4  bg-white">
                <InlineTaskList 
                   linkedConversationPhone={liveConversation?.phone} 
                   linkedConversationId={conversationId}
                />
              </div>
            </DialogContent>
          </Dialog>

          {liveConversation?.ticketNumber && (
            <button
              onClick={handleLinkedJobClick}
              className="bg-zinc-50 hover:bg-zinc-100 px-3 py-1.5 rounded-lg border border-zinc-200 flex items-center gap-2 self-start md:self-auto shadow-3xs cursor-pointer text-left focus:outline-none transition-all active:scale-[0.98]"
            >
              <span className="text-xs uppercase font-bold text-zinc-400">Linked Job</span>
              <span className="text-sm font-mono font-bold text-blue-600">#{liveConversation.ticketNumber}</span>
            </button>
          )}
        </div>
      </div>
      
      {/* Messages viewport */}
      <div className="flex-1 p-6 overflow-y-auto space-y-6 bg-zinc-50/50" ref={viewportRef}>
        {isLoading && messages.length === 0 ? (
          <div className="text-center py-10 text-zinc-400 text-sm font-medium">Loading conversation history...</div>
        ) : (
          allTimelineItems.map((msg: any) => {
            const isOutbound = msg.type === "outbound" || msg.isInternal;
            const isFailed = msg.status === "failed";
            
            if (msg.isCall) {
              return (
                <div key={msg.id} className="flex justify-center my-4">
                  <div className="bg-white border border-zinc-200 px-4 py-2 rounded-full shadow-sm flex items-center gap-3 text-xs">
                    <div className={`p-1.5 rounded-full ${msg.type === 'inbound' ? (msg.callStatus === 'Missed' ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600') : 'bg-zinc-100 text-zinc-600'}`}>
                       <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold text-zinc-700">{msg.type === 'inbound' ? 'Incoming Call' : 'Outgoing Call'} {msg.callStatus === 'Missed' ? '(Missed)' : ''}</span>
                      <span className="text-zinc-500">{msg.text}</span>
                    </div>
                    <span className="text-xs text-zinc-400 font-medium ml-2">{msg.timestamp?.toDate ? msg.timestamp.toDate().toLocaleString() : new Date(msg.timestamp).toLocaleString()}</span>
                  </div>
                </div>
              );
            }

            return (
              <div key={msg.id} className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
                <div className="flex flex-col gap-1 items-end max-w-[80%]">
                  <div className={`w-full rounded-2xl px-4 py-2.5 shadow-sm text-sm ${
                    isOutbound 
                      ? isFailed 
                        ? 'bg-rose-50 border border-rose-200 text-rose-900 rounded-br-sm' 
                        : 'bg-blue-600 text-white rounded-br-sm' 
                      : 'bg-white border border-zinc-200 text-zinc-900 rounded-bl-sm'
                  }`}>
                    {msg.isInternal && (
                      <div className="text-[9px] uppercase tracking-wider font-extrabold text-blue-200 mb-1">
                        Internal Note
                      </div>
                    )}
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                    
                    <div className={`text-xs text-right mt-1.5 font-medium flex items-center justify-end gap-1.5 ${isOutbound ? isFailed ? 'text-rose-500' : 'text-blue-200' : 'text-zinc-400'}`}>
                      <span>{msg.timestamp?.toDate ? msg.timestamp.toDate().toLocaleString() : new Date().toLocaleString()}</span>
                      {isOutbound && (
                        <span className="flex items-center gap-1 opacity-90">
                          • <span className="uppercase text-[9px] font-bold">{msg.isRCS ? 'RCS' : 'SMS'}</span> 
                          <span>
                            {msg.status === "sending" && "sending..."}
                            {msg.status === "sent" && "✓ sent"}
                            {msg.status === "delivered" && "✓✓"}
                            {msg.status === "read" && "✓✓ read"}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Failed controls */}
                  {isFailed && (
                    <div className="flex items-center gap-2 mt-1 text-xs text-rose-600 font-bold">
                      <span className="flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> Send failed ({msg.error || "Unknown Error"})</span>
                      <button 
                        onClick={() => handleRetry(msg)} 
                        className="bg-rose-100 hover:bg-rose-200 text-rose-800 rounded px-2 py-0.5 mt-0.5 inline-flex items-center gap-1 cursor-pointer transition-colors font-extrabold uppercase text-xs"
                      >
                        <RefreshCw className="w-2.5 h-2.5" /> Retry
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        
        {/* Typist tracking indicator */}
        {liveConversation?.remoteIsTyping && (
          <div className="flex justify-start opacity-70 mt-4 animate-in fade-in duration-300">
            <div className="bg-zinc-100 rounded-full px-4 py-2 flex items-center gap-1.5 shadow-sm border border-zinc-200">
              <div className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" />
              <div className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '0.2s' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '0.4s' }} />
              <span className="text-xs text-zinc-500 font-semibold ml-1">Typing...</span>
            </div>
          </div>
        )}
        
        <div ref={endRef} />
      </div>

      {/* Reply input tray */}
      <div className="p-4 bg-white border-t border-zinc-200 shrink-0 space-y-3">
        <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pb-1">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs rounded-full border-blue-200 text-blue-700 bg-blue-50/50 hover:bg-blue-100 hover:text-blue-800 font-bold cursor-pointer transition-colors"
            onClick={handleGenerateAIResponse}
            disabled={isGenerating || messages.length === 0}
          >
            <Sparkles className="w-3.5 h-3.5 mr-1.5 text-blue-500 animate-pulse" />
            {isGenerating ? "Drafting..." : "AI Smart Reply"}
          </Button>

          {liveConversation?.isYourTurn && (
             <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs rounded-full border-amber-200 text-amber-700 bg-amber-50/50 hover:bg-amber-100 hover:text-amber-800 font-bold cursor-pointer transition-colors"
                onClick={() => conversationId && dismissYourTurnLabel(conversationId, {
                  phone: liveConversation?.phone,
                  customerId: liveConversation?.customerId,
                  customerName: liveConversation?.customerName,
                  ticketNumber: liveConversation?.ticketNumber,
                  labels: liveConversation?.labels || []
                })}
             >
                <Check className="w-3.5 h-3.5 mr-1.5" />
                Remove 'Your Turn'
             </Button>
          )}
          
          <div className="w-px h-4 bg-zinc-200 mx-1 shrink-0" />
          
          {chatTemplates.map((qr, i) => {
            return (
              <button
                key={i}
                title={qr.text}
                onClick={() => {
                  let finalMsg = qr.text
                    .replace(/{firstName}/ig, liveConversation?.customerName ? liveConversation.customerName.split(' ')[0] : "Customer")
                    .replace(/{lastName}/ig, liveConversation?.customerName ? liveConversation.customerName.split(' ').slice(1).join(' ') : "")
                    .replace(/{customerName}/ig, liveConversation?.customerName || "Customer")
                    .replace(/{device}/ig, linkedTicket?.device_model || linkedTicket?.subject || "device")
                    .replace(/{ticketNumber}/ig, liveConversation?.ticketNumber || linkedTicket?.number || "...")
                    .replace(/{issue}/ig, linkedTicket?.problem_type || linkedTicket?.issue_type || "issue")
                    .trim();
                  setReplyText(finalMsg);
                }}
                className="whitespace-nowrap px-3 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 text-[11px] font-semibold rounded-full transition-colors flex-shrink-0 border border-zinc-200 border-b-zinc-300 truncate max-w-[200px]"
              >
                {qr.name}
              </button>
            );
          })}
        </div>

        <div className="relative">
          <textarea
            className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl pl-4 pr-14 py-3 text-sm resize-none outline-none focus:border-zinc-300 focus:bg-white transition-all  font-medium text-zinc-800"
            rows={2}
            placeholder="Type your reply. Use templates or hit AI Reply..."
            value={replyText}
            onChange={(e) => {
              setReplyText(e.target.value);
              if (liveConversation?.phone && (e.target.value.length === 1 || e.target.value.length % 5 === 0)) {
                MessagingService.sendTypingIndicator(liveConversation.phone, true);
              }
            }}
            onBlur={() => {
              if (liveConversation?.phone) {
                MessagingService.sendTypingIndicator(liveConversation.phone, false);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <Button 
            size="icon" 
            className="absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-sm cursor-pointer p-0 flex items-center justify-center"
            onClick={handleSend}
          >
            <Send className="w-4 h-4 -ml-0.5" />
          </Button>
        </div>
        <div className="flex justify-between items-center px-1">
          <p className="text-xs text-zinc-400 font-bold">Press <kbd className="font-mono bg-zinc-100 px-1 rounded border border-zinc-200">Enter</kbd> to send</p>
        </div>
      </div>
    </div>
  );
}
