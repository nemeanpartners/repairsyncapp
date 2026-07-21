import React, { useState, useEffect, useMemo } from "react";
import { collection, query, orderBy, limit, where, onSnapshot, doc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { db } from "../../firebase";
import { SearchService } from "../../services/search/SearchService";
import { TICKET_PIPELINE } from "../../hooks/useTicketData";
import { REPAIR_CATEGORIES } from "../../features/tickets/pages/NewTicketPage";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Search,
  Filter,
  LayoutGrid,
  List as ListIcon,
  Bot,
  RefreshCw,
  BarChart2,
  AlertCircle,
} from "lucide-react";
import { TicketCard } from "../../components/TicketCard";
import { motion, AnimatePresence } from "motion/react";

export function TicketKanbanView({
  filterCategories,
}: {
  filterCategories?: string[];
}) {
  const [tickets, setTickets] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [extraTickets, setExtraTickets] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"kanban" | "list">(() => {
    return "list";
  });
  const [isLoading, setIsLoading] = useState(true);
  const [robovacTab, setRobovacTab] = useState<"tagged_tickets" | "tagged_messages" | "dashboards" | "urgent_tickets">("tagged_messages");
  const [pipelineTab, setPipelineTab] = useState<"all_tickets" | "urgent_tickets" | "dashboards">("all_tickets");
  const [messagesSearch, setMessagesSearch] = useState("");
  const [ticketsSearch, setTicketsSearch] = useState("");
  const [messagesSort, setMessagesSort] = useState<"recent" | "oldest" | "urgent">("recent");
  const [ticketsSort, setTicketsSort] = useState<"recent" | "oldest" | "priority">("recent");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const statusParam = searchParams.get("status");

  useEffect(() => {
    if (statusParam) {
      setSelectedStatus(statusParam);
      // Force list view if we are filtering specifically by a status
      setViewMode("list");
    }
  }, [statusParam]);

  useEffect(() => {
    if (pipelineTab === "urgent_tickets" || robovacTab === "urgent_tickets") {
      setViewMode("list");
    }
  }, [pipelineTab, robovacTab]);

  const isRobovacArea = useMemo(() => {
    return !!(
      filterCategories &&
      (filterCategories.includes("robovac repair") ||
        filterCategories.includes("vacuum") ||
        filterCategories.includes("vaccuum") ||
        filterCategories.includes("robovac") ||
        filterCategories.includes("robot vacs"))
    );
  }, [filterCategories]);

  // Sync SMS conversations in background if we're in the Robovac/Roborock area
  useEffect(() => {
    if (!isRobovacArea) {
      setConversations([]);
      return;
    }

    const q = query(collection(db, "conversations"), limit(1000));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setConversations(docs);
    }, (err) => {
      console.error("Conversations subscription error:", err);
    });

    return unsubscribe;
  }, [isRobovacArea]);

  // Filter conversations for ryan, laben, or RYAM
  const ryanConversations = useMemo(() => {
    if (!isRobovacArea || conversations.length === 0) return [];
    
    return conversations.filter((conv: any) => {
      // Check labels array on conversation
      const hasMatchingLabel = Array.isArray(conv.labels) && conv.labels.some((l: any) => {
        const lbl = String(l.label || "").toLowerCase();
        return lbl.includes("ryan") || lbl.includes("laben") || lbl.includes("ryam");
      });

      return hasMatchingLabel;
    });
  }, [conversations, isRobovacArea]);

  const ryanTicketNumbers = useMemo(() => {
    const matched = new Set<string>();
    ryanConversations.forEach((conv: any) => {
      if (conv.ticketNumber) {
        matched.add(String(conv.ticketNumber).trim());
      }
    });
    return Array.from(matched);
  }, [ryanConversations]);

  // Dynamically fetch and subscribe to those extra matched tickets
  useEffect(() => {
    if (!isRobovacArea || ryanTicketNumbers.length === 0) {
      setExtraTickets([]);
      return;
    }

    const searchValues: any[] = [];
    ryanTicketNumbers.forEach((numStr) => {
      searchValues.push(numStr);
      const parsed = parseInt(numStr, 10);
      if (!isNaN(parsed)) {
        searchValues.push(parsed);
      }
    });

    const chunkedValues = searchValues.slice(0, 30);

    const qCrm = query(collection(db, "crm_tickets"), where("number", "in", chunkedValues));
    const qNew = query(collection(db, "tickets"), where("number", "in", chunkedValues));

    let crmData: any[] = [];
    let newData: any[] = [];

    const updateExtra = () => {
      setExtraTickets([...crmData, ...newData]);
    };

    const unsubCrm = onSnapshot(qCrm, (snapshot) => {
      crmData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data({ serverTimestamps: "estimate" }),
      }));
      updateExtra();
    }, (err) => console.error(err));

    const unsubNew = onSnapshot(qNew, (snapshot) => {
      newData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data({ serverTimestamps: "estimate" }),
      }));
      updateExtra();
    }, (err) => console.error(err));

    return () => {
      unsubCrm();
      unsubNew();
    };
  }, [isRobovacArea, ryanTicketNumbers]);

  useEffect(() => {
    // Exclude resolved and closed from realtime snapshot to save rendering and connection cost
    // Firestore lacks "not-in" arrays > 10 cleanly in some older SDKs, so we'll just limit to 100 for open queue.

    let qCrm, qNew;
    let queryKeyCrm = "crm_tickets_kanban_100";
    let queryKeyNew = "tickets_kanban_100";

    if (
      filterCategories &&
      (filterCategories.includes("robovac repair") ||
        filterCategories.includes("vacuum") ||
        filterCategories.includes("vaccuum") ||
        filterCategories.includes("robovac") ||
        filterCategories.includes("robot vacs"))
    ) {
      qCrm = query(collection(db, "crm_tickets"), orderBy("updated_at", "desc"), limit(1500));
      qNew = query(collection(db, "tickets"), orderBy("updated_at", "desc"), limit(1500));
      queryKeyCrm = "crm_tickets_kanban_1500_robovac_v3";
      queryKeyNew = "tickets_kanban_1500_robovac_v3";
    } else {
      qCrm = query(collection(db, "crm_tickets"), orderBy("updated_at", "desc"), limit(100));
      qNew = query(collection(db, "tickets"), orderBy("updated_at", "desc"), limit(100));
    }

    let crmData: any[] = [];
    let newData: any[] = [];

    const updateTickets = () => {
      const merged = [...crmData, ...newData].sort((a,b) => {
         const tA = Math.max(a.updated_at?.seconds || 0, a.created_at?.seconds || 0);
         const tB = Math.max(b.updated_at?.seconds || 0, b.created_at?.seconds || 0);
         return tB - tA;
      });
      setTickets(merged);
      setIsLoading(false);
    };

    const unsubscribeCrm = SearchService.subscribeToDeduplicatedQuery(
      queryKeyCrm,
      qCrm,
      (mappedDocs) => {
        crmData = mappedDocs || [];
        updateTickets();
      },
    );

    const unsubscribeNew = SearchService.subscribeToDeduplicatedQuery(
      queryKeyNew,
      qNew,
      (mappedDocs) => {
        newData = mappedDocs || [];
        updateTickets();
      },
    );

    return () => {
      unsubscribeCrm();
      unsubscribeNew();
    };
  }, [filterCategories]);

  const filteredTickets = useMemo(() => {
    // Merge standard tickets and dynamically fetched extra tickets
    const allTicketsMap = new Map<string, any>();
    tickets.forEach((t) => {
      if (t.id) allTicketsMap.set(String(t.id), t);
    });
    extraTickets.forEach((t) => {
      if (t.id) allTicketsMap.set(String(t.id), t);
    });

    const existingTicketNumbers = new Set(
      Array.from(allTicketsMap.values()).map((t) => String(t.number || "").trim())
    );

    // Create virtual tickets for matched ryan/laben/ryam conversations that do not have a ticket yet
    if (isRobovacArea && ryanConversations.length > 0) {
      ryanConversations.forEach((conv: any) => {
        const tNum = String(conv.ticketNumber || "").trim();
        const alreadyHasTicket = tNum && existingTicketNumbers.has(tNum);
        if (!alreadyHasTicket) {
          let dateVal = new Date();
          if (conv.lastMessageAt) {
            if (typeof conv.lastMessageAt.toDate === "function") {
              dateVal = conv.lastMessageAt.toDate();
            } else if (typeof conv.lastMessageAt.seconds === "number") {
              dateVal = new Date(conv.lastMessageAt.seconds * 1000);
            } else {
              dateVal = new Date(conv.lastMessageAt);
            }
          } else if (conv.updatedAt) {
            if (typeof conv.updatedAt.toDate === "function") {
              dateVal = conv.updatedAt.toDate();
            } else if (typeof conv.updatedAt.seconds === "number") {
              dateVal = new Date(conv.updatedAt.seconds * 1000);
            } else {
              dateVal = new Date(conv.updatedAt);
            }
          }

          const lbls = Array.isArray(conv.labels)
            ? conv.labels.filter((l: any) => !l.dismissed).map((l: any) => l.label)
            : [];
          const isRyan = lbls.some((l: string) => l.toLowerCase().includes("ryan"));

          const convId = String(conv.conversationId || conv.id || "");
          const virtId = `conversations_${convId}`;
          const customerNameStr = conv.customerName || "SMS Customer";
          const virtTicket = {
            id: virtId,
            number: conv.ticketNumber || (convId ? `SMS-${convId.slice(-4)}` : "SMS"),
            subject: conv.lastMessagePreview ? `"${conv.lastMessagePreview}"` : `SMS Chat with ${customerNameStr}${isRyan ? " (RYAN)" : ""}`,
            problem_type: conv.lastMessagePreview || "SMS Conversation",
            brand: "SMS",
            device_model: lbls.length > 0 ? lbls.map((l: string) => l.toUpperCase()).join(", ") : "ROBOROCK REPAIR",
            customer_name: customerNameStr,
            customer_firstname: customerNameStr.split(" ")[0] || "SMS",
            customer_lastname: customerNameStr.split(" ").slice(1).join(" ") || "Customer",
            created_at: dateVal.toISOString(),
            updated_at: dateVal.toISOString(),
            status: conv.isYourTurn ? "In Progress" : "New",
            priority: conv.isUrgent ? "Urgent" : "Normal",
            repair_category: "robovac repair",
            isVirtual: true,
            conversation_id: convId,
          };
          allTicketsMap.set(virtId, virtTicket);
        }
      });
    }

    let result = Array.from(allTicketsMap.values());

    if (filterCategories && filterCategories.length > 0) {
      result = result.filter((t) => {
        // Standard category check
        const cat = String(t.repair_category || "").toLowerCase().trim();
        const issue = String(t.issue_type || t.problem_type || "")
          .toLowerCase()
          .trim();
        const deviceType = String(t.device_type || "")
          .toLowerCase()
          .trim();
        const subject = String(t.subject || t.title || t.issueDescription || "")
          .toLowerCase()
          .trim();
        const brand = String(t.brand || t.device_model || "")
          .toLowerCase()
          .trim();
        const sourceName = String(t.source || t.integration_source || "")
          .toLowerCase()
          .trim();
          
        const filterStr = filterCategories.join(" ");

        const matchesCategory = filterCategories.some(
          (fc) => {
            const f = fc.toLowerCase().trim();
            if (!f) return false;
            return (cat && cat.includes(f)) ||
            (cat && f.includes(cat)) ||
            (issue && issue.includes(f)) ||
            (issue && f.includes(issue)) ||
            (deviceType && deviceType.includes(f)) ||
            (deviceType && f.includes(deviceType)) ||
            (subject && subject.includes(f)) ||
            (brand && brand.includes(f))
          }
        );

        // check if they specifically wanted repairshopr tickets matching
        const isRepairshopr = sourceName.includes("repairshopr");
        const hasVacuumKeyword = subject.includes("vacuum") || subject.includes("vaccuum") || 
                                 issue.includes("vacuum") || issue.includes("vaccuum") ||
                                 deviceType.includes("vacuum") || deviceType.includes("vaccuum") ||
                                 cat.includes("vacuum") || cat.includes("vaccuum");

        const matchesSourceVacuum = (isRepairshopr && hasVacuumKeyword && filterStr.includes('vacuum'));

        // Or if it matches from the ryan/laben/RYAM conversations or is a virtual ticket
        const isSmsMatch = ryanTicketNumbers.includes(String(t.number || "").trim());
        const isVirtualForRobo = t.isVirtual && t.repair_category === "robovac repair";

        return matchesCategory || isSmsMatch || isVirtualForRobo || matchesSourceVacuum;
      });
    }
    if (searchQuery.trim()) {
      const lowerQ = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          String(t.subject || t.issueDescription || "")
            .toLowerCase()
            .includes(lowerQ) ||
          String(t.customer_name || t.customer_business_then_name || "")
            .toLowerCase()
            .includes(lowerQ) ||
          String(t.number || "")
            .toLowerCase()
            .includes(lowerQ) ||
          String(t.brand || "").toLowerCase().includes(lowerQ) ||
          String(t.device_model || "").toLowerCase().includes(lowerQ),
      );
    }
    
    if (selectedStatus && selectedStatus !== "all") {
      result = result.filter(t => String(t.status || "New").toLowerCase() === selectedStatus.toLowerCase());
    }

    if (selectedCategory && selectedCategory !== "all") {
      result = result.filter(t => {
         const cat = String(t.repair_category || "").toLowerCase();
         return cat.includes(selectedCategory.toLowerCase());
      });
    }

    if (ticketsSort === "priority") {
      result.sort((a, b) => {
        if (a.priority === "Urgent" && b.priority !== "Urgent") return -1;
        if (b.priority === "Urgent" && a.priority !== "Urgent") return 1;
        const timeA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
        const timeB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
        return timeB - timeA;
      });
    } else if (ticketsSort === "oldest") {
      result.sort((a, b) => {
        const timeA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
        const timeB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
        return timeA - timeB;
      });
    } else {
      result.sort((a, b) => {
        const timeA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
        const timeB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
        return timeB - timeA;
      });
    }
    
    if (!isRobovacArea && pipelineTab === "urgent_tickets") {
      result = result.filter(t => t.priority === "Urgent" || t.priority === "High");
    }

    return result;
  }, [tickets, extraTickets, ryanConversations, ryanTicketNumbers, searchQuery, filterCategories, isRobovacArea, selectedStatus, selectedCategory, ticketsSort, pipelineTab]);

  const displayRobovacMessages = useMemo(() => {
    let result = [...ryanConversations];
    if (messagesSearch) {
      const q = messagesSearch.toLowerCase();
      result = result.filter(v => 
        (v.customerName || "").toLowerCase().includes(q) ||
        (v.lastMessagePreview || "").toLowerCase().includes(q) ||
        (String(v.ticketNumber || "")).toLowerCase().includes(q)
      );
    }
    result.sort((a, b) => {
      if (messagesSort === "urgent") {
        if (a.isUrgent && !b.isUrgent) return -1;
        if (b.isUrgent && !a.isUrgent) return 1;
      }
      if (messagesSort === "oldest") {
        const timeA = a.lastContactAt?.toMillis?.() || new Date(a.lastContactAt || 0).getTime();
        const timeB = b.lastContactAt?.toMillis?.() || new Date(b.lastContactAt || 0).getTime();
        return timeA - timeB;
      }
      const timeA = a.lastContactAt?.toMillis?.() || new Date(a.lastContactAt || 0).getTime();
      const timeB = b.lastContactAt?.toMillis?.() || new Date(b.lastContactAt || 0).getTime();
      return timeB - timeA;
    });
    return result;
  }, [ryanConversations, messagesSearch, messagesSort]);

  const displayRobovacTickets = useMemo(() => {
    let result = filteredTickets.filter(t => {
      if (t.isVirtual) return false;
      const tTags = Array.isArray(t.tags) ? t.tags.map(tag => tag.toLowerCase()) : [];
      const tagList = Array.isArray(t.tag_list) ? t.tag_list.map(tag => tag.toLowerCase()) : [];
      const hasVacTag = tTags.some(tag => tag.includes('vac') || tag.includes('robot')) || tagList.some(tag => tag.includes('vac') || tag.includes('robot'));
      const cat = String(t.repair_category || "").toLowerCase();
      const prob = String(t.problem_type || "").toLowerCase();
      const subj = String(t.subject || "").toLowerCase();
      const hasVacText = cat.includes("vac") || prob.includes("robovac") || subj.includes("robovac") || cat.includes("robot") || prob.includes("vacuum") || subj.includes("vacuum");
      return hasVacTag || hasVacText;
    });
    if (ticketsSearch) {
      const q = ticketsSearch.toLowerCase();
      result = result.filter(t => 
        String(t.subject || t.issueDescription || "").toLowerCase().includes(q) ||
        String(t.customer_name || t.customer_business_then_name || "").toLowerCase().includes(q) ||
        String(t.number || "").toLowerCase().includes(q) ||
        String(t.brand || "").toLowerCase().includes(q) ||
        String(t.device_model || "").toLowerCase().includes(q)
      );
    }
    if (ticketsSort === "priority") {
      result.sort((a, b) => {
        if (a.priority === "Urgent" && b.priority !== "Urgent") return -1;
        if (b.priority === "Urgent" && a.priority !== "Urgent") return 1;
        const timeA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
        const timeB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
        return timeB - timeA;
      });
    } else if (ticketsSort === "oldest") {
      result.sort((a, b) => {
        const timeA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
        const timeB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
        return timeA - timeB;
      });
    } else {
      result.sort((a, b) => {
        const timeA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
        const timeB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
        return timeB - timeA;
      });
    }
    return result;
  }, [filteredTickets, ticketsSearch, ticketsSort]);

  const displayUrgentTickets = useMemo(() => {
    return displayRobovacTickets.filter(t => t.priority === "Urgent" || t.priority === "High");
  }, [displayRobovacTickets]);

  const toggleRobotTag = async (e: React.MouseEvent, ticket: any) => {
    e.stopPropagation();
    if (!ticket.id) return;
    try {
      const ticketRef = doc(db, "crm_tickets", ticket.id.toString());
      const isTaggedRobot = Array.isArray(ticket.tags) && ticket.tags.includes("Robot Vac");
      if (isTaggedRobot) {
        await updateDoc(ticketRef, { tags: arrayRemove("Robot Vac") });
      } else {
        await updateDoc(ticketRef, { tags: arrayUnion("Robot Vac") });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const toggleUrgency = async (e: React.MouseEvent, ticket: any) => {
    e.stopPropagation();
    if (!ticket.id || ticket.isVirtual) return;
    try {
      const ticketRef = doc(db, "crm_tickets", ticket.id.toString());
      const newPriority = ticket.priority === "Urgent" ? "Medium" : "Urgent";
      await updateDoc(ticketRef, { 
        priority: newPriority, 
        updated_at: new Date().toISOString() 
      });
    } catch (err) {
      console.error("Failed to toggle urgency:", err);
    }
  };

  const uniqueCategories = useMemo(() => {
    const categories = new Set<string>();
    
    // Add existing predefined categories
    REPAIR_CATEGORIES.forEach(c => {
      categories.add(typeof c === 'string' ? c : c.name);
    });

    tickets.forEach(t => {
      const type = String(t.repair_category || "").trim();
      if (type && type.length < 35) categories.add(type);
    });
    return Array.from(categories).sort();
  }, [tickets]);

  const pipelineStats = useMemo(() => {
    const currentList = isRobovacArea ? displayRobovacTickets : filteredTickets;
    
    // Filter out resolved/closed for open count
    const openList = currentList.filter(t => !['resolved', 'closed', 'completed', 'picked up'].includes(String(t.status || '').toLowerCase()));
    const totalOpen = openList.length;
    
    const urgentPending = currentList.filter(t => t.priority === 'Urgent' || t.priority === 'High').length;
    
    // Average Wait Time calculation based on elapsed time since created_at
    let totalAgeHours = 0;
    let ageCount = 0;
    openList.forEach(t => {
      const dateVal = t.created_at?.toDate ? t.created_at.toDate() : new Date(t.created_at || Date.now());
      if (dateVal && !isNaN(dateVal.getTime())) {
        const ageMs = Date.now() - dateVal.getTime();
        totalAgeHours += ageMs / (1000 * 60 * 60);
        ageCount++;
      }
    });

    let avgWaitTime = "0h";
    if (ageCount > 0) {
      const avgHours = totalAgeHours / ageCount;
      if (avgHours > 24) {
        avgWaitTime = `${Math.round(avgHours / 24)}d ${Math.round(avgHours % 24)}h`;
      } else {
        avgWaitTime = `${Math.round(avgHours)}h`;
      }
    }

    return { totalOpen, urgentPending, avgWaitTime };
  }, [displayRobovacTickets, filteredTickets, isRobovacArea]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-zinc-400 h-full">
        <div className="w-16 h-16 rounded-2xl bg-zinc-100 flex items-center justify-center mb-6 animate-pulse">
          <BarChart2 className="w-8 h-8 text-zinc-300" />
        </div>
        <p className="font-bold uppercase tracking-wide text-xs text-zinc-400">
          Initializing Engine...
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full bg-zinc-50/50 pr-1">
      {isRobovacArea ? (
        <div className="px-4 md:px-8 py-4 md:py-5 border-b border-zinc-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 sticky top-0 z-40 bg-white/95 backdrop-blur-sm">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-zinc-900">Robot Vac Repairs</h1>
              <div className="flex items-center text-xs font-medium text-zinc-500 uppercase tracking-wide bg-zinc-100 px-2.5 py-1 rounded-full border border-zinc-200 shadow-sm shrink-0">
                <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse" />
                Live Pipeline
              </div>
            </div>
            <p className="text-zinc-500 text-sm mt-1">Manage and track robot vacuum repairs</p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="flex bg-zinc-100 p-1 rounded-xl shrink-0">
              <button
                onClick={() => setViewMode("kanban")}
                className={`p-1.5 rounded-lg transition-all ${viewMode === "kanban" ? "bg-white shadow-sm text-zinc-900" : "text-zinc-400 hover:text-zinc-600"}`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-1.5 rounded-lg transition-all ${viewMode === "list" ? "bg-white shadow-sm text-zinc-900" : "text-zinc-400 hover:text-zinc-600"}`}
              >
                <ListIcon className="w-4 h-4" />
              </button>
            </div>

            <div className="relative w-full sm:w-64 shrink-0">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Search sequence..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 h-10 text-sm bg-zinc-100 hover:bg-zinc-100 inline-block border-none rounded-xl focus:bg-white focus:ring-4 focus:ring-primary/10 transition-all outline-none"
              />
            </div>

            <button
              onClick={() =>
                window.dispatchEvent(new CustomEvent("open-new-ticket"))
              }
              className="bg-zinc-900 hover:bg-black text-white rounded-xl px-5 h-10 text-sm font-bold shadow-sm transition-all active:scale-95 flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              Intake New Unit
            </button>
          </div>
        </div>
      ) : (
        <div className="px-4 md:px-8 py-4 border-b border-zinc-200 bg-white flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 sticky top-0 z-40 bg-white/95 backdrop-blur-sm">
          <div className="flex items-center gap-3 w-full overflow-x-auto pb-2 xl:pb-0   ">
            <div className="flex bg-zinc-100 p-1 rounded-xl shrink-0">
              <button
                onClick={() => setViewMode("kanban")}
                className={`p-1.5 rounded-lg transition-all ${viewMode === "kanban" ? "bg-white shadow-sm text-zinc-900" : "text-zinc-400 hover:text-zinc-600"}`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-1.5 rounded-lg transition-all ${viewMode === "list" ? "bg-white shadow-sm text-zinc-900" : "text-zinc-400 hover:text-zinc-600"}`}
              >
                <ListIcon className="w-4 h-4" />
              </button>
            </div>
            <div className="relative min-w-[200px] md:w-64 shrink-0">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Search sequence..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 h-10 text-sm bg-zinc-50 border border-zinc-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-primary/10 transition-all outline-none"
              />
            </div>
            {!isRobovacArea && (
              <div className="flex items-center gap-2 shrink-0">
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="h-10 pl-3 pr-8 py-2 text-sm bg-zinc-50 border border-zinc-100 rounded-xl outline-none focus:bg-zinc-100 focus:border-zinc-300 max-w-[160px] truncate "
                  >
                  <option value="all">All Statuses</option>
                  {TICKET_PIPELINE.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="h-10 pl-3 pr-8 py-2 text-sm bg-zinc-50 border border-zinc-100 rounded-xl outline-none focus:bg-zinc-100 focus:border-zinc-300 max-w-[160px] truncate "
                  >
                  <option value="all">All Categories</option>
                  {uniqueCategories.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                <select
                  value={ticketsSort}
                  onChange={(e) => setTicketsSort(e.target.value as any)}
                  className="h-10 pl-3 pr-8 py-2 text-sm bg-zinc-50 border border-zinc-100 rounded-xl outline-none focus:bg-zinc-100 focus:border-zinc-300 truncate "
                  >
                  <option value="recent">Newest updates</option>
                  <option value="oldest">Oldest updates</option>
                  <option value="priority">Priority first</option>
                </select>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 w-full xl:w-auto justify-between xl:justify-end shrink-0">
            <div className="flex items-center text-xs font-medium text-zinc-400 uppercase tracking-wide mr-0 xl:mr-4">
              <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse" />
              Live Pipeline
            </div>
            <button
              onClick={() =>
                window.dispatchEvent(new CustomEvent("open-new-ticket"))
              }
              className="bg-zinc-900 hover:bg-black text-white rounded-xl px-5 py-2 text-sm font-bold shadow-sm transition-all active:scale-95 flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              Intake New Unit
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col p-0 md:p-8 gap-4 md:gap-6">
        <div className="px-4 md:px-0 grid grid-cols-3 gap-4 shrink-0 mt-4 md:mt-0">
           <div 
             onClick={() => {
               if (isRobovacArea) {
                 setRobovacTab("tagged_tickets");
               } else {
                 setPipelineTab("all_tickets");
               }
             }}
             className="bg-white rounded-xl border border-zinc-200 p-4 shadow-sm flex flex-col cursor-pointer hover:border-zinc-300 hover:shadow-md transition-all active:scale-95 group"
           >
              <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1 group-hover:text-zinc-700 transition-colors">Total Open</span>
              <span className="text-2xl font-black text-zinc-900">{pipelineStats.totalOpen}</span>
           </div>
           <div 
             onClick={() => {
               if (isRobovacArea) {
                 setRobovacTab("urgent_tickets");
               } else {
                 setPipelineTab("urgent_tickets");
               }
             }}
             className="bg-white rounded-xl border border-zinc-200 p-4 shadow-sm flex flex-col cursor-pointer hover:border-red-200 hover:shadow-md transition-all active:scale-95 group"
           >
              <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1 group-hover:text-red-500 transition-colors">Urgent Pending</span>
              <span className="text-2xl font-black text-red-600 flex items-center gap-2">
                {pipelineStats.urgentPending}
                {pipelineStats.urgentPending > 0 && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
              </span>
           </div>
           <div className="bg-white rounded-xl border border-zinc-200 p-4 shadow-sm flex flex-col">
              <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1">Avg Ticket Age</span>
              <span className="text-2xl font-black text-zinc-900">{pipelineStats.avgWaitTime}</span>
           </div>
        </div>

        <div className="px-4 md:px-0 py-2 border-b md:border-b-0 border-zinc-200 flex gap-6 shrink-0 bg-white md:bg-transparent overflow-x-auto whitespace-nowrap ">
          {isRobovacArea ? (
            <>
              <button
                onClick={() => setRobovacTab("tagged_tickets")}
                className={`text-sm font-bold pb-2 transition-colors border-b-2 whitespace-nowrap ${
                  robovacTab === "tagged_tickets" ? "border-zinc-900 text-zinc-900" : "border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300"
                }`}
              >
                Robot Tickets
              </button>
              <button
                onClick={() => setRobovacTab("tagged_messages")}
                className={`text-sm font-bold pb-2 transition-colors border-b-2 whitespace-nowrap ${
                  robovacTab === "tagged_messages" ? "border-zinc-900 text-zinc-900" : "border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300"
                }`}
              >
                Tagged Messages
              </button>
              <button
                onClick={() => setRobovacTab("urgent_tickets")}
                className={`text-sm font-bold pb-2 transition-colors border-b-2 whitespace-nowrap ${
                  robovacTab === "urgent_tickets" ? "border-red-600 text-red-600" : "border-transparent text-zinc-500 hover:text-red-500 hover:border-red-200"
                }`}
              >
                Urgent Tickets
              </button>
              <button
                onClick={() => setRobovacTab("dashboards")}
                className={`text-sm font-bold pb-2 transition-colors border-b-2 whitespace-nowrap ${
                  robovacTab === "dashboards" ? "border-zinc-900 text-zinc-900" : "border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300"
                }`}
              >
                Dashboards
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setPipelineTab("all_tickets")}
                className={`text-sm font-bold pb-2 transition-colors border-b-2 whitespace-nowrap ${
                  pipelineTab === "all_tickets" ? "border-zinc-900 text-zinc-900" : "border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300"
                }`}
              >
                All Tickets
              </button>
              <button
                onClick={() => setPipelineTab("urgent_tickets")}
                className={`text-sm font-bold pb-2 transition-colors border-b-2 whitespace-nowrap ${
                  pipelineTab === "urgent_tickets" ? "border-red-600 text-red-600" : "border-transparent text-zinc-500 hover:text-red-500 hover:border-red-200"
                }`}
              >
                Urgent Tickets
              </button>
              <button
                onClick={() => setPipelineTab("dashboards")}
                className={`text-sm font-bold pb-2 transition-colors border-b-2 whitespace-nowrap ${
                  pipelineTab === "dashboards" ? "border-zinc-900 text-zinc-900" : "border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300"
                }`}
              >
                Dashboards
              </button>
            </>
          )}
        </div>

        <div className={`flex-1 flex flex-col ${isRobovacArea ? 'p-4 md:p-0' : ''} min-h-0`}>
          {isRobovacArea && robovacTab === "dashboards" && (
            <div className="bg-white rounded-2xl border border-zinc-200 p-8 text-center text-zinc-500 shadow-sm w-full mt-2">
              <BarChart2 className="w-12 h-12 mx-auto text-zinc-300 mb-4" />
              <h3 className="font-bold text-zinc-900 mb-2">Robovac Analytics Dashboard</h3>
              <p className="text-sm">Metrics and KPI tracking for robotic vacuum repairs will appear here.</p>
            </div>
          )}

          {(!isRobovacArea && pipelineTab === "dashboards") && (
            <div className="bg-white rounded-2xl border border-zinc-200 p-8 text-center text-zinc-500 shadow-sm w-full mt-2">
              <BarChart2 className="w-12 h-12 mx-auto text-zinc-300 mb-4" />
              <h3 className="font-bold text-zinc-900 mb-2">Pipeline Analytics Dashboard</h3>
              <p className="text-sm">Metrics and KPI tracking for your complete repair queue will appear here.</p>
            </div>
          )}

          {isRobovacArea && robovacTab === "tagged_messages" && (
            <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden shrink-0 w-full mb-2 mt-2 flex flex-col">
              <div className="p-4 bg-zinc-50/80 border-b border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="font-bold text-zinc-700 flex items-center gap-2">
                  <span className="text-zinc-400">🤖</span> Tagged Messages
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input
                      type="text"
                      placeholder="Search messages..."
                      value={messagesSearch}
                      onChange={(e) => setMessagesSearch(e.target.value)}
                      className="pl-8 pr-3 py-1.5 text-xs bg-white border border-zinc-200 rounded-lg outline-none focus:ring-0 focus:border-zinc-300 w-40"
                    />
                  </div>
                  <select
                    value={messagesSort}
                    onChange={(e) => setMessagesSort(e.target.value as any)}
                    className="py-1.5 px-2 text-xs bg-white border border-zinc-200 rounded-lg outline-none focus:ring-0 focus:border-zinc-300"
                  >
                    <option value="recent">Newest updates</option>
                    <option value="oldest">Oldest updates</option>
                    <option value="urgent">Urgent first</option>
                  </select>
                </div>
              </div>
              {displayRobovacMessages.length === 0 ? (
                  <div className="p-8 text-center text-sm text-zinc-500">No tagged messages found.</div>
              ) : (
                <div className="overflow-x-auto w-full ">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-medium">
                    <tr>
                      <th className="px-6 py-4">Customer</th>
                      <th className="px-6 py-4">Ticket</th>
                      <th className="px-6 py-4">Context</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Priority</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {displayRobovacMessages.map((conv: any) => {
                        const lbls = Array.isArray(conv.labels) ? conv.labels.filter((l: any) => !l.dismissed).map((l: any) => l.label) : [];
                        const isRyan = lbls.some((l: string) => l.toLowerCase().includes("ryan"));
                        const customerNameStr = conv.customerName || "SMS Customer";
                        const tNum = String(conv.ticketNumber || "").trim();
                        // Find if we have the actual ticket to link to
                        const actualTicket = tNum ? tickets.find(t => String(t.number).trim() === tNum) || extraTickets.find(t => String(t.number).trim() === tNum) : null;

                        return (
                          <tr 
                            key={conv.id || conv.conversationId} 
                            className="even:bg-white odd:bg-zinc-50/60 hover:bg-zinc-100/80 transition-colors" 
                          >
                            <td className="px-6 py-4 font-semibold text-zinc-900 cursor-pointer" onClick={() => navigate(`/messages?convId=${conv.conversationId || conv.id}`)}>
                              {customerNameStr}
                            </td>
                            <td className="px-6 py-4 font-mono text-xs">
                              {actualTicket ? (
                                <div className="text-blue-600 hover:underline cursor-pointer inline-block" onClick={() => navigate(`/tickets/${actualTicket.id}`)}>
                                  #{tNum}
                                </div>
                              ) : tNum ? (
                                <div className="text-zinc-500 cursor-pointer inline-block" onClick={() => navigate(`/messages?convId=${conv.conversationId || conv.id}`)}>
                                  #{tNum}
                                </div>
                              ) : (
                                <div className="text-zinc-400 italic cursor-pointer inline-block" onClick={() => navigate(`/messages?convId=${conv.conversationId || conv.id}`)}>No Ticket</div>
                              )}
                            </td>
                            <td className="px-6 py-4 text-zinc-600 line-clamp-1 cursor-pointer" onClick={() => navigate(`/messages?convId=${conv.conversationId || conv.id}`)}>
                              {conv.lastMessagePreview ? `"${conv.lastMessagePreview}"` : `SMS Chat with ${customerNameStr}${isRyan ? " (RYAN)" : ""}`}
                            </td>
                            <td className="px-6 py-4 cursor-pointer" onClick={() => navigate(`/messages?convId=${conv.conversationId || conv.id}`)}>
                              <Badge variant="outline" className="bg-white shadow-sm font-bold text-xs uppercase tracking-wider">{conv.isYourTurn ? "In Progress" : "New"}</Badge>
                            </td>
                            <td className="px-6 py-4 cursor-pointer" onClick={() => navigate(`/messages?convId=${conv.conversationId || conv.id}`)}>
                              {conv.isUrgent ? (
                                <Badge className="bg-rose-100/50 text-rose-600 border-none shadow-none font-bold uppercase tracking-wider text-xs">Urgent</Badge>
                              ) : (
                                <Badge className="bg-zinc-100 text-zinc-500 border-none shadow-none font-bold uppercase tracking-wider text-xs">Normal</Badge>
                              )}
                            </td>
                          </tr>
                        )
                    })}
                  </tbody>
                </table>
                </div>
              )}
            </div>
          )}

          {((isRobovacArea && (robovacTab === "tagged_tickets" || robovacTab === "urgent_tickets")) || (!isRobovacArea && (pipelineTab === "all_tickets" || pipelineTab === "urgent_tickets"))) && (
            <div className={`flex-1 min-h-[500px] h-[calc(100vh-260px)] ${viewMode === "list" ? "w-full flex flex-col gap-8 pb-12 overflow-y-auto" : "overflow-auto flex gap-4 md:snap-none snap-x snap-mandatory scroll-smooth     hover:  w-full"} mt-2`}>
              {viewMode === "list" ? (
                isRobovacArea ? (
                  <>
                    <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden w-full flex flex-col">
                      <div className="p-4 bg-zinc-50/80 border-b border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="font-bold text-zinc-700 flex items-center gap-2">
                          <span className="text-zinc-400">{robovacTab === "urgent_tickets" ? "🚨" : "📝"}</span> {robovacTab === "urgent_tickets" ? "Urgent Tickets" : "Robot Tickets"}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                            <input
                              type="text"
                              placeholder="Search tickets..."
                              value={ticketsSearch}
                              onChange={(e) => setTicketsSearch(e.target.value)}
                              className="pl-8 pr-3 py-1.5 text-xs bg-white border border-zinc-200 rounded-lg outline-none focus:ring-0 focus:border-zinc-300 w-40"
                            />
                          </div>
                          <select
                            value={ticketsSort}
                            onChange={(e) => setTicketsSort(e.target.value as any)}
                            className="py-1.5 px-2 text-xs bg-white border border-zinc-200 rounded-lg outline-none focus:ring-0 focus:border-zinc-300"
                          >
                            <option value="recent">Newest updates</option>
                            <option value="oldest">Oldest updates</option>
                            <option value="priority">Priority first</option>
                          </select>
                        </div>
                      </div>
                  {(robovacTab === "urgent_tickets" ? displayUrgentTickets : displayRobovacTickets).length === 0 ? (
                     <div className="p-8 text-center text-sm text-zinc-500">No tickets found.</div>
                  ) : (
                    <div className="overflow-x-auto ">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-medium">
                        <tr>
                          <th className="px-6 py-4">ID</th>
                          <th className="px-6 py-4">Customer</th>
                          <th className="px-6 py-4">Subject</th>
                          <th className="px-6 py-4">Device</th>
                          <th className="px-6 py-4">Status</th>
                          <th className="px-6 py-4">Priority</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {(robovacTab === "urgent_tickets" ? displayUrgentTickets : displayRobovacTickets).map(ticket => (
                          <tr 
                            key={ticket.id} 
                            className={`cursor-pointer transition-colors relative ${ticket.priority === 'Urgent' ? 'bg-red-50/30 hover:bg-red-50' : 'even:bg-white odd:bg-zinc-50/60 hover:bg-zinc-100/80'}`}
                            onClick={() => navigate(`/tickets/${ticket.id}`)}
                          >
                            <td className={`px-6 py-4 font-mono text-xs hover:underline flex items-center gap-2 ${ticket.priority === 'Urgent' ? 'text-red-600' : 'text-blue-600'}`}>
                              {ticket.priority === 'Urgent' && <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500 " />}
                              <div className="cursor-pointer">
                                #{ticket.number || String(ticket.id).slice(-6).toUpperCase()}
                              </div>
                              {!ticket.isVirtual && (
                                <button
                                  type="button"
                                  onClick={(e) => toggleRobotTag(e, ticket)}
                                  className={`p-1 rounded-md transition-colors ${Array.isArray(ticket.tags) && ticket.tags.includes("Robot Vac") ? 'bg-primary/10 text-primary' : 'bg-transparent text-zinc-300 hover:text-zinc-500 hover:bg-zinc-100'}`}
                                  title="Tag as Robot Vac"
                                >
                                  <Bot className="w-3 h-3" />
                                </button>
                              )}
                            </td>
                            <td className="px-6 py-4 font-semibold text-zinc-900">{ticket.customer_name || ticket.customer_business_then_name || "Unknown"}</td>
                            <td className="px-6 py-4 text-zinc-800 font-medium max-w-[200px] truncate" title={ticket.subject || ticket.problem_type}>{ticket.subject || ticket.problem_type || "-"}</td>
                            <td className="px-6 py-4 text-zinc-600 line-clamp-1">{ticket.device_model || ticket.device || ticket.brand || "-"}</td>
                            <td className="px-6 py-4">
                              <Badge variant="outline" className="bg-white shadow-sm font-bold text-xs uppercase tracking-wider">{ticket.status || "New"}</Badge>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                {ticket.priority === "Urgent" ? (
                                  <Badge className="bg-red-50 text-red-600 border border-red-200 border-none shadow-sm font-bold uppercase tracking-wider text-xs ">Urgent</Badge>
                                ) : (
                                  <Badge className="bg-zinc-100 text-zinc-500 border-none shadow-none font-bold uppercase tracking-wider text-xs">{ticket.priority || "Normal"}</Badge>
                                )}
                                {!ticket.isVirtual && (
                                  <button
                                    type="button"
                                    onClick={(e) => toggleUrgency(e, ticket)}
                                    className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors shadow-sm border text-xs font-medium uppercase tracking-wider ${ticket.priority === "Urgent" ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100' : 'bg-white border-zinc-200 text-zinc-400 hover:bg-red-50 hover:text-red-600 hover:border-red-200'}`}
                                    title={ticket.priority === "Urgent" ? "Remove Urgent Status" : "Mark as Urgent"}
                                  >
                                    <AlertCircle className="w-3 h-3" />
                                    {ticket.priority === "Urgent" ? "Unmark" : "Mark Urgent"}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden w-full h-fit">
                <div className="overflow-x-auto ">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-medium">
                    <tr>
                      <th className="px-6 py-4">ID</th>
                      <th className="px-6 py-4">Customer</th>
                      <th className="px-6 py-4">Subject</th>
                      <th className="px-6 py-4">Device</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Priority</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {filteredTickets.map(ticket => (
                      <tr 
                        key={ticket.id} 
                        className={`cursor-pointer transition-colors relative ${ticket.priority === 'Urgent' ? 'bg-red-50/30 hover:bg-red-50' : 'even:bg-white odd:bg-zinc-50/60 hover:bg-zinc-100/80'}`}
                        onClick={() => {
                            if (ticket.id && String(ticket.id).startsWith("conversations_")) {
                              navigate(`/messages?convId=${ticket.conversation_id}`);
                            } else {
                              navigate(`/tickets/${ticket.id}`);
                            }
                        }}
                      >
                        <td className={`px-6 py-4 font-mono text-xs flex items-center gap-2 hover:underline ${ticket.priority === 'Urgent' ? 'text-red-600' : 'text-blue-600'}`}>
                          {ticket.priority === 'Urgent' && <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500 " />}
                          <div className="cursor-pointer">
                            #{ticket.number || String(ticket.id).slice(-6).toUpperCase()}
                          </div>
                          {!ticket.isVirtual && (
                            <button
                              type="button"
                              onClick={(e) => toggleRobotTag(e, ticket)}
                              className={`p-1 rounded-md transition-colors ${Array.isArray(ticket.tags) && ticket.tags.includes("Robot Vac") ? 'bg-primary/10 text-primary' : 'bg-transparent text-zinc-300 hover:text-zinc-500 hover:bg-zinc-100'}`}
                              title="Tag as Robot Vac"
                            >
                              <Bot className="w-3 h-3" />
                            </button>
                          )}
                        </td>
                        <td className="px-6 py-4 font-semibold text-zinc-900">{ticket.customer_name || ticket.customer_business_then_name || "Unknown"}</td>
                        <td className="px-6 py-4 text-zinc-800 font-medium max-w-[200px] truncate" title={ticket.subject || ticket.problem_type}>{ticket.subject || ticket.problem_type || "-"}</td>
                        <td className="px-6 py-4 text-zinc-600 line-clamp-1">{ticket.device_model || ticket.device || ticket.brand || "-"}</td>
                        <td className="px-6 py-4">
                          <Badge variant="outline" className="bg-white shadow-sm font-bold text-xs uppercase tracking-wider">{ticket.status || "New"}</Badge>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {ticket.priority === "Urgent" ? (
                              <Badge className="bg-red-50 text-red-600 border border-red-200 border-none shadow-sm font-bold uppercase tracking-wider text-xs ">Urgent</Badge>
                            ) : (
                              <Badge className="bg-zinc-100 text-zinc-500 border-none shadow-none font-bold uppercase tracking-wider text-xs">{ticket.priority || "Normal"}</Badge>
                            )}
                            {!ticket.isVirtual && (
                              <button
                                type="button"
                                onClick={(e) => toggleUrgency(e, ticket)}
                                className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors shadow-sm border text-xs font-medium uppercase tracking-wider ${ticket.priority === "Urgent" ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100' : 'bg-white border-zinc-200 text-zinc-400 hover:bg-red-50 hover:text-red-600 hover:border-red-200'}`}
                                title={ticket.priority === "Urgent" ? "Remove Urgent Status" : "Mark as Urgent"}
                              >
                                <AlertCircle className="w-3 h-3" />
                                {ticket.priority === "Urgent" ? "Unmark" : "Mark Urgent"}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            )
          ) : (
            TICKET_PIPELINE.map((stage, idx) => {
              const stageTickets = filteredTickets.filter((t) => {
                const ticketStatus = String(t.status || "New").toLowerCase().trim();
                const matchingStatus = ticketStatus === "open" ? "new" : ticketStatus;
                return (
                  matchingStatus === stage.label.toLowerCase().trim() ||
                  matchingStatus === stage.value.toLowerCase().trim()
                );
              }).sort((a, b) => {
                 const aTagged = a.isVirtual || ryanTicketNumbers.includes(String(a.number || "").trim()) ? -1 : 0;
                 const bTagged = b.isVirtual || ryanTicketNumbers.includes(String(b.number || "").trim()) ? -1 : 0;
                 if (aTagged !== bTagged) return aTagged - bTagged;
                 return 0;
              });
    
              return (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  key={stage.value}
                  className={`w-[85vw] md:w-[280px] snap-center flex flex-col shrink-0 group/column h-[730px] max-h-[730px] rounded-2xl p-3 ${idx % 2 === 0 ? 'bg-zinc-50' : 'bg-zinc-100/80'} border border-zinc-200/60`}
                >
                  <div className="flex items-center justify-between mb-4 px-2 shrink-0">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${stage.color}`} />
                      <span className="font-black text-xs text-zinc-800 uppercase tracking-wide">
                        {stage.label}
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className="bg-white border-zinc-200 text-zinc-500 font-bold text-xs shadow-none rounded-full px-2 shrink-0"
                    >
                      {stageTickets.length}
                    </Badge>
                  </div>
    
                  <div className="flex-1 overflow-y-auto space-y-3 pr-2  pb-8     hover:  ">
                    <AnimatePresence mode="popLayout">
                      {stageTickets.map((t) => (
                        <TicketCard
                          key={t.id}
                          ticket={t}
                          onClick={() => {
                            if (t.id && String(t.id).startsWith("conversations_")) {
                              navigate(`/messages?convId=${t.conversation_id}`);
                            } else {
                              navigate(`/tickets/${t.id}`);
                            }
                          }}
                        />
                      ))}
                    </AnimatePresence>
    
                    {stageTickets.length === 0 && (
                      <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-zinc-200 rounded-2xl bg-zinc-50/50 opacity-50 group-hover/column:opacity-80 transition-opacity">
                        <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center mb-3">
                          <RefreshCw className="w-4 h-4 text-zinc-300" />
                        </div>
                        <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                          Ready
                        </span>
                      </div>
                    )}
                    <div className="h-10" />
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
        )}
      </div>
      </div>
    </div>
  );
}
