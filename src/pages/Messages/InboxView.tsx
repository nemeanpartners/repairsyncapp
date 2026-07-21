import React, { useState, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { MessageSquare, Search, AlertCircle, ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConversationThread } from "./ConversationThread";
import { ErrorBoundary } from "../../components/ErrorBoundary";
import { NewConversationModal } from "../../components/NewConversationModal";
import { useConversationsStore } from "../../stores/conversations";
import { normalizePhone } from "../../services/conversations";

function getTimestampMs(ts: any): number {
  if (!ts) return 0;
  if (ts === "optimistic") return Date.now();
  if (typeof ts.toDate === "function") {
    try {
      return ts.toDate().getTime();
    } catch (e) {
      // ignore
    }
  }
  if (typeof ts.seconds === "number") {
    return ts.seconds * 1000 + Math.floor((ts.nanoseconds || 0) / 1000000);
  }
  if (ts instanceof Date) {
    return ts.getTime();
  }
  if (typeof ts === "string" || typeof ts === "number") {
    const parsed = new Date(ts).getTime();
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

export function InboxView() {
  const { 
    conversations, 
    isLoading, 
    subscribeToConversations, 
    loadMoreConversations,
    isLoadingMore,
    hasMore,
    dismissYourTurnLabel 
  } = useConversationsStore();

  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'urgent' | 'your_turn' | 'ryan'>('all');
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedConversation, setSelectedConversationInternal] = useState<any>(null);
  const [isNewConversationOpen, setIsNewConversationOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const handleTabChange = (tab: 'all' | 'unread' | 'urgent' | 'your_turn' | 'ryan') => {
    setActiveTab(tab);
    const params = new URLSearchParams(location.search);
    params.set("tab", tab);
    navigate({ search: params.toString() }, { replace: true });
  };

  // Sync tab with URL parameter
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get("tab");
    if (tabParam === 'all' || tabParam === 'unread' || tabParam === 'urgent' || tabParam === 'your_turn' || tabParam === 'ryan') {
      if (activeTab !== tabParam) {
        setActiveTab(tabParam as any);
      }
    }
  }, [location.search, activeTab]);

  // Select conversation by query param or state
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const convId = params.get("convId") || location.state?.selectedConversationId;
    const phone = params.get("phone");
    const customerId = params.get("customerId");
    const customerName = params.get("customerName");

    if (convId && conversations.length > 0) {
      const match = conversations.find(c => c.conversationId === convId);
      if (match) {
        setSelectedConversationInternal(match);
      } else if (phone) {
        setSelectedConversationInternal({
          conversationId: convId,
          customerId: customerId || null,
          customerName: customerName || "Unknown Customer",
          phone: phone,
          lastMessagePreview: "",
          labels: [],
        });
      }
    } else if (phone && conversations.length > 0) {
      const normalized = normalizePhone(phone);
      const match = conversations.find(c => c.conversationId === normalized);
      if (match) {
        setSelectedConversationInternal(match);
      } else {
        setSelectedConversationInternal({
          conversationId: normalized,
          customerId: customerId || null,
          customerName: customerName || "Unknown Customer",
          phone: phone,
          lastMessagePreview: "",
          labels: [],
        });
      }
    }
  }, [location.search, location.state, conversations]);

  // Subscribe to real-time conversation updates
  useEffect(() => {
    const unsubscribe = subscribeToConversations();
    return () => unsubscribe();
  }, [subscribeToConversations]);

  // Keep selected conversation updated in-sync with latest metadata from store
  const activeConversation = useMemo(() => {
    if (!selectedConversation) return null;
    const match = conversations.find(
      (c) => c.conversationId === selectedConversation.conversationId
    );
    return match || selectedConversation;
  }, [conversations, selectedConversation]);

  const filteredConversations = useMemo(() => {
    let filtered = conversations.filter(c => !c.isArchived);

    // Tab filtering
    if (activeTab === 'unread') {
      filtered = filtered.filter(c => c.isUnread);
    } else if (activeTab === 'urgent') {
      filtered = filtered.filter(c => c.isUrgent);
    } else if (activeTab === 'your_turn') {
      filtered = filtered.filter(c => c.isYourTurn);
    } else if (activeTab === 'ryan') {
      filtered = filtered.filter(c => 
        Array.isArray(c.labels) && c.labels.some((l: any) => {
          const lbl = String(l.label || "").toLowerCase();
          return lbl.includes("ryan") || lbl.includes("laben") || lbl.includes("ryam");
        })
      );
    }

    // Search query filtering
    if (searchQuery.trim()) {
      const lowerQ = searchQuery.toLowerCase();
      filtered = filtered.filter(c => 
        (String(c.customerName || "")).toLowerCase().includes(lowerQ) ||
        (String(c.phone || "")).toLowerCase().includes(lowerQ) ||
        (String(c.lastMessagePreview || "")).toLowerCase().includes(lowerQ) ||
        (String(c.ticketNumber || "")).toLowerCase().includes(lowerQ)
      );
    }

    // Explicitly sort by lastMessageAt descending so the newest messages are always at the top
    let sorted = [...filtered].sort((a, b) => {
      const timeA = getTimestampMs(a.lastMessageAt);
      const timeB = getTimestampMs(b.lastMessageAt);
      return timeB - timeA;
    });

    // If there is an active virtual/skeleton conversation that is not in the list, prepend it so they can see it in sidebar
    if (activeConversation && !conversations.some(c => c.conversationId === activeConversation.conversationId)) {
      sorted.unshift(activeConversation);
    }

    return sorted;
  }, [conversations, activeTab, searchQuery, activeConversation]);

  // Pre-select first conversation on wider/desktop viewports
  useEffect(() => {
    if (!activeConversation && filteredConversations.length > 0) {
      if (typeof window !== 'undefined' && window.innerWidth >= 768) {
        setSelectedConversationInternal(filteredConversations[0]);
      }
    }
  }, [filteredConversations, activeConversation]);

  const counts = useMemo(() => {
    return {
      unread: conversations.filter(c => c.isUnread && !c.isArchived).length,
      urgent: conversations.filter(c => c.isUrgent && !c.isArchived).length,
      your_turn: conversations.filter(c => c.isYourTurn && !c.isArchived).length,
      ryan: conversations.filter(c => 
        !c.isArchived &&
        Array.isArray(c.labels) && 
        c.labels.some((l: any) => {
          const lbl = String(l.label || "").toLowerCase();
          return lbl.includes("ryan") || lbl.includes("laben") || lbl.includes("ryam");
        })
      ).length,
    };
  }, [conversations]);

  if (isLoading && conversations.length === 0) {
    return (
      <div className="p-8 text-zinc-500 font-sans flex items-center justify-center h-full bg-zinc-50">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
          <span className="text-sm font-medium">Loading Operator Inbox...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-white w-full relative font-sans">
      {/* Sidebar List */}
      <div className={`w-full md:w-[350px] lg:w-[400px] border-r border-zinc-200 bg-zinc-50 flex-col h-full flex-shrink-0 absolute md:relative z-10 w-full ${activeConversation ? 'hidden md:flex' : 'flex'}`}>
        <div className="px-5 py-4 border-b border-zinc-200 bg-white shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold tracking-tight text-zinc-900">Operator Inbox</h2>
            <Button size="sm" onClick={() => setIsNewConversationOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-3 py-1.5 text-xs font-semibold shadow-sm transition-colors cursor-pointer">
              <MessageSquare className="w-3.5 h-3.5 mr-1.5" />
              New Msg
            </Button>
          </div>
          
          {/* Search bar */}
          <div className="mt-4 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..." 
              className="w-full bg-zinc-100 hover:bg-zinc-200/50 border-none rounded-lg pl-9 pr-4 py-2 text-sm outline-none transition-colors font-medium text-zinc-800"
            />
          </div>
          
          {/* Filter Tabs */}
          <div className="flex items-center gap-1 mt-4 overflow-x-auto pb-1 hide-scrollbar">
            <FilterTab 
              label="All" 
              active={activeTab === 'all'} 
              onClick={() => handleTabChange('all')} 
            />
            <FilterTab 
              label="Unread" 
              count={counts.unread} 
              active={activeTab === 'unread'} 
              onClick={() => handleTabChange('unread')} 
            />
            <FilterTab 
              label="Urgent" 
              count={counts.urgent} 
              active={activeTab === 'urgent'} 
              onClick={() => handleTabChange('urgent')} 
              color="text-red-600"
            />
            <FilterTab 
              label="Your Turn" 
              count={counts.your_turn} 
              active={activeTab === 'your_turn'} 
              onClick={() => handleTabChange('your_turn')} 
              color="text-amber-600"
            />
            <FilterTab 
              label="Ryan" 
              count={counts.ryan} 
              active={activeTab === 'ryan'} 
              onClick={() => handleTabChange('ryan')} 
              color="text-blue-600"
            />
          </div>
        </div>
        
        {/* Scrollable Conversation List */}
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.map((c) => {
            const isSelected = activeConversation?.conversationId === c.conversationId;
            return (
              <div 
                key={c.conversationId} 
                onClick={() => {
                  setSelectedConversationInternal(c);
                  const params = new URLSearchParams(location.search);
                  params.set("convId", c.conversationId);
                  navigate({ search: params.toString() }, { replace: true });
                }}
                className={`p-4 border-b border-zinc-200 hover:bg-white cursor-pointer transition-colors relative ${isSelected ? 'bg-blue-50/70 border-r-2 border-r-blue-500' : c.isUnread ? 'bg-blue-50/20' : ''}`}
              >
                
                {/* Status Badges Overlay */}
                <div className="absolute top-4 right-4 flex items-center gap-1.5">
                  {c.isUrgent && (
                    <span className="bg-red-50 text-red-700 text-[9px] font-bold px-1.5 py-0.5 rounded border border-red-100 uppercase flex items-center gap-0.5">
                      <AlertCircle className="w-2.5 h-2.5" /> Urgent
                    </span>
                  )}
                  {c.isYourTurn && (
                    <div className="flex items-center gap-1">
                      <span className="bg-amber-50 text-amber-700 text-[9px] font-bold px-1.5 py-0.5 rounded border border-amber-100 uppercase flex items-center gap-0.5">
                        <ArrowRight className="w-2.5 h-2.5" /> Your Turn
                      </span>
                      {/* Manual Dismiss Button */}
                      <div
                        role="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          dismissYourTurnLabel(c.conversationId);
                        }}
                        className="p-1 rounded-full bg-amber-100 hover:bg-amber-200 text-amber-800 transition-colors shadow-sm"
                        title="Dismiss 'Your Turn'"
                      >
                        <X className="w-2.5 h-2.5" />
                      </div>
                    </div>
                  )}
                  {c.isUnread && <span className="w-2 h-2 rounded-full bg-blue-500 shadow-sm ml-1 animate-pulse" />}
                </div>

                <div className="flex justify-between items-start mb-1.5">
                  <p className={`text-sm truncate pr-24 ${c.isUnread ? 'text-zinc-900 font-bold' : 'text-zinc-700 font-semibold'}`}>
                    {c.customerName || c.phone || "Unknown Customer"}
                  </p>
                </div>
                <p className={`text-xs line-clamp-2 w-full pr-2 leading-relaxed ${c.isUnread ? 'text-zinc-800 font-medium' : 'text-zinc-500'}`}>
                  {c.lastMessagePreview || "No message content"}
                </p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="text-xs text-zinc-400 font-semibold">
                    {c.lastMessageAt && c.lastMessageAt !== "optimistic"
                      ? (c.lastMessageAt.toDate ? c.lastMessageAt.toDate() : new Date(c.lastMessageAt)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : 'Just now'}
                  </span>
                  {c.ticketNumber && (
                    <span className="bg-zinc-200/50 px-1.5 py-0.5 rounded text-zinc-600 font-mono text-[9px] font-bold">
                      #{c.ticketNumber}
                    </span>
                  )}
                  {(c.labels || [])
                    .filter((l: any) => !l.dismissed && l.label !== "your_turn" && l.label !== "urgent")
                    .map((l: any) => (
                      <span key={l.label} className="bg-zinc-100 border border-zinc-200 px-1 py-0.5 rounded text-zinc-650 font-bold text-[8.5px] uppercase tracking-wide">
                        {l.label.replace("_", " ")}
                      </span>
                    ))}
                </div>
              </div>
            );
          })}
          
          {hasMore && filteredConversations.length > 0 && !searchQuery && activeTab === 'all' && (
            <div className="p-4 flex justify-center">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={loadMoreConversations} 
                disabled={isLoadingMore}
                className="w-full text-xs font-semibold"
              >
                {isLoadingMore ? "Loading..." : "Load More"}
              </Button>
            </div>
          )}

          {filteredConversations.length === 0 && (
            <div className="p-10 text-center flex flex-col items-center justify-center text-zinc-400 h-64">
              <MessageSquare className="w-8 h-8 mb-3 opacity-20" />
              <p className="text-sm font-semibold">No active threads found.</p>
              <p className="text-xs text-zinc-400 mt-1">Try expanding your filters or search.</p>
            </div>
          )}
        </div>
      </div>
      
      {/* Detail Panel */}
      <div className={`flex-1 flex flex-col h-full bg-white absolute md:relative inset-0 z-20 md:z-0 w-full ${!activeConversation ? 'hidden md:flex' : 'flex'}`}>
        {activeConversation ? (
          <ErrorBoundary>
            <ConversationThread 
              conversation={activeConversation} 
              onBack={() => setSelectedConversationInternal(null)} 
            />
          </ErrorBoundary>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-zinc-50 text-zinc-400">
            <div className="w-16 h-16 bg-blue-50 text-blue-500 flex items-center justify-center rounded-2xl mb-4 shadow-sm border border-blue-100">
              <MessageSquare className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="text-md font-bold text-zinc-800 mb-1">Select a Conversation</h3>
            <p className="text-xs text-zinc-500 max-w-xs text-center leading-relaxed">
              Open a thread to sync message histories, launch rich template actions, and reply.
            </p>
          </div>
        )}
      </div>
      <NewConversationModal isOpen={isNewConversationOpen} onClose={() => setIsNewConversationOpen(false)} />
    </div>
  );
}

function FilterTab({ label, count, active, onClick, color }: { label: string, count?: number, active: boolean, onClick: () => void, color?: string }) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all outline-none cursor-pointer ${active ? 'bg-zinc-900 text-white shadow-sm' : 'bg-transparent text-zinc-500 hover:bg-zinc-200/50 hover:text-zinc-900'}`}
    >
      {label}
      {count !== undefined && count > 0 && (
        <span className={`px-1.5 py-0.5 rounded-full text-[9px] ${active ? 'bg-white/20 text-white font-extrabold' : color ? `${color} bg-zinc-200` : 'bg-zinc-200 text-zinc-700'}`}>
          {count}
        </span>
      )}
    </button>
  );
}
