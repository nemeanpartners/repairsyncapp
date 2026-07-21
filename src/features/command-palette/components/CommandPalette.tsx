import React, { useState, useEffect, useRef } from "react";
import { 
  Search, 
  Terminal, 
  Zap, 
  Shield, 
  HelpCircle, 
  FilePlus, 
  Ticket, 
  Users, 
  FileText, 
  BarChart3, 
  Package, 
  Settings, 
  Sparkles, 
  AlertTriangle,
  MessageSquare,
  Activity,
  Cpu,
  ShieldAlert,
  Plus
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useWorkflowStore } from "../../../store/workflowStore";
import { SearchService } from "../../../services/search/SearchService";
import { toast } from "sonner";

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const paletteRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { isTechMode, toggleTechMode } = useWorkflowStore();

  // Listen to CMD+K / CTRL+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Autofocus input
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setResults([]);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const navigationCommands = [
    { category: "Quick Actions", title: "Create New Repair Ticket", subtitle: "Register fresh intake and device details", icon: FilePlus, action: () => navigate("/tickets/new") },
    { category: "Quick Actions", title: "Generate New Invoice", subtitle: "Manage billing, parts costing, and payment collections", icon: FileText, action: () => window.dispatchEvent(new Event("open-new-invoice")) },
    { category: "Quick Actions", title: "Send SMS Message", subtitle: "Communicate with customers via centralized SMS log", icon: MessageSquare, action: () => navigate("/messages") },
    { category: "Operating Perspective", title: "Toggle Technician Mode", subtitle: `Currently: ${isTechMode ? 'Tech Layout' : 'Admin Layout'}`, icon: Terminal, action: () => { toggleTechMode(); toast.success("Switched operating perspective!"); } },
    { category: "Operating Perspective", title: "Assign Active Repairs", subtitle: "Route and distribute pending cards to workshops", icon: Users, action: () => { navigate("/tickets"); toast.info("Select a ticket to edit assignments."); } },
    { category: "Operating Perspective", title: "Jump Operational Workflow", subtitle: "Manage active status boards & Kanban columns", icon: Activity, action: () => navigate("/tickets") },
    { category: "System Automations", title: "Run SLA Escalation Automations", subtitle: "Recalculate automatic warning triggers for stalled repairs", icon: ShieldAlert, action: () => { navigate("/sla"); toast.success("SLA Engine Audit complete and time thresholds synced!"); } },
    { category: "System Automations", title: "Trigger AI Triage Predictor", subtitle: "Analyze fault predictions, parts suggestions, and risk scores", icon: Sparkles, action: () => { navigate("/sla"); toast.info("AI operational triages are available on SLA Tracker and Ticket views."); } },
    { category: "System Navigation", title: "Go to Operations Dashboard", subtitle: "Main performance overview console", icon: BarChart3, action: () => navigate("/") },
    { category: "System Navigation", title: "Inspect Parts Stock & Inventory", subtitle: "Monitor stock and triggers", icon: Package, action: () => navigate("/inventory") },
    { category: "System Navigation", title: "Configure Platform Settings", subtitle: "API keys, automated webhooks, team rosters", icon: Settings, action: () => navigate("/settings") },
    { category: "System Navigation", title: "Account Deletion Requests", subtitle: "Admin review for pending account deletion requests", icon: ShieldAlert, action: () => navigate("/admin/account-deletion-requests") },
  ];

  // Perform instant lookup
  useEffect(() => {
    if (!query.trim()) {
      setResults(navigationCommands);
      return;
    }

    const matchedNavs = navigationCommands.filter(
      (cmd) =>
        cmd.title.toLowerCase().includes(query.toLowerCase()) ||
        cmd.subtitle.toLowerCase().includes(query.toLowerCase())
    );

    // Fetch matching tickets/customers from SearchService
    const fetchDelayed = setTimeout(async () => {
      try {
        const { contacts, tickets } = await SearchService.globalSearch(query, { limit: 5 });
        const remoteResults = [
          ...tickets.map(t => ({
            category: "Matching Repair Tickets",
            title: t.subject || `Ticket #${t.number}`,
            subtitle: `Ticket #${t.number} • Device: ${t.device_model || 'Unknown'} • IMEI/Serial: ${t.device_imei || t.device_serial || 'None'} • Status: ${t.status || 'Active'}`,
            icon: Ticket,
            action: () => navigate(`/tickets/${t.id}`)
          })),
          ...contacts.map(c => ({
            category: "Associated Customers",
            title: `${c.firstname || ""} ${c.lastname || ""}`.trim() || c.business_name || "Unnamed Customer",
            subtitle: `Customer • Phone: ${c.phone || 'None'} • Email: ${c.email || 'None'}`,
            icon: Users,
            action: () => navigate(`/customers/${c.id || ''}`)
          }))
        ];
        setResults([...matchedNavs, ...remoteResults]);
      } catch (e) {
        setResults(matchedNavs);
      }
    }, 150);

    return () => clearTimeout(fetchDelayed);
  }, [query, isTechMode]);

  // Command selection keyboard bindings
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % results.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (results[selectedIndex]) {
          results[selectedIndex].action();
          setIsOpen(false);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, results, selectedIndex]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-zinc-950/40 z-[9999] backdrop-blur-sm flex items-start justify-center pt-[12vh]">
      <div 
        className="fixed inset-0" 
        onClick={() => setIsOpen(false)}
      />
      <div 
        ref={paletteRef}
        className="relative w-full max-w-xl bg-white border border-zinc-200 shadow-2xl rounded-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header Search Field */}
        <div className="flex items-center border-b border-zinc-100 px-4 py-4 gap-3 bg-zinc-50/50">
          <Search className="w-5 h-5 text-zinc-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search sequence, navigate, or run technician actions..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
            className="w-full bg-transparent border-none outline-none text-sm text-zinc-900 placeholder:text-zinc-400 font-medium"
          />
          <div className="flex items-center gap-1 opacity-50 text-xs bg-white border border-zinc-200 px-1.5 py-0.5 rounded font-black text-zinc-400 font-mono">
            ESC
          </div>
        </div>

        {/* Results Stream */}
        <div className="max-h-[380px] overflow-y-auto py-1">
          {results.length > 0 ? (
            results.map((cmd, idx) => {
              const active = idx === selectedIndex;
              const Icon = cmd.icon;
              const showCategoryHeader = idx === 0 || results[idx - 1].category !== cmd.category;
              return (
                <div key={idx}>
                  {showCategoryHeader && (
                    <div className="px-4 py-1.5 text-[9px] font-semibold uppercase text-zinc-400 tracking-wider bg-zinc-50 border-y border-zinc-100/50 first:border-t-0">
                      {cmd.category || "Suggested Shortcuts"}
                    </div>
                  )}
                  <div
                    onMouseEnter={() => setSelectedIndex(idx)}
                    onClick={() => { cmd.action(); setIsOpen(false); }}
                    className={`px-4 py-2.5 cursor-pointer flex items-center justify-between transition-colors ${
                      active ? "bg-zinc-100" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3 truncate">
                      <div className={`p-2 rounded-lg shrink-0 transition-colors ${active ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-500'}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="truncate">
                        <p className={`text-sm font-semibold truncate ${active ? 'text-zinc-900' : 'text-zinc-700'}`}>{cmd.title}</p>
                        <p className="text-xs text-zinc-400 font-medium truncate">{cmd.subtitle}</p>
                      </div>
                    </div>
                    {active && (
                      <span className="text-xs font-semibold uppercase text-zinc-400 font-mono flex items-center gap-1 shrink-0 bg-white border border-zinc-200 px-1.5 py-0.5 rounded shadow-sm">
                        Enter <Zap className="w-2.5 h-2.5 text-zinc-400" />
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-12 text-center text-zinc-400 text-sm font-medium">
              No actions mapped for "{query}"
            </div>
          )}
        </div>

        {/* Console Footing */}
        <div className="border-t border-zinc-100 px-4 py-2.5 bg-zinc-50/50 flex flex-row items-center justify-between text-xs text-zinc-400 font-bold uppercase tracking-wider">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1"><Terminal className="w-3.5 h-3.5 text-zinc-400" /> Linear Console</span>
            <span>Use arrows to navigate</span>
          </div>
          <span className="flex items-center gap-1 text-purple-600 font-bold"><Sparkles className="w-3 h-3 text-purple-400 animate-pulse" /> AI Grounded Engine</span>
        </div>
      </div>
    </div>
  );
}
