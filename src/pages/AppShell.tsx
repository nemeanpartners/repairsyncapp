import { EndOfDayPage } from "./EndOfDay/EndOfDayPage";
import React, { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import {
  Routes,
  Route,
  useNavigate,
  useLocation,
  Navigate,
  useParams,
} from "react-router-dom";
import {
  LayoutDashboard,
  Ticket,
  Users,
  Settings,
  Wrench,
  Package,
  MessageSquare,
  DollarSign,
  LogOut,
  FileText,
  Mail,
  BarChart3,
  Plus,
  UserPlus,
  Menu,
  X,
  ListTodo,
  Disc,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  CheckSquare,
} from "lucide-react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { useAuth } from "../providers/AuthProvider";
import { useShop } from "../providers/ShopProvider";
import { PublicQuoteForm } from "./Quotes/PublicQuoteForm";
import { PrivacyPolicyView } from "./PrivacyPolicyView";
import { PaymentsPage } from "./PaymentsPage";
import { PaymentSuccessPage } from "./PaymentSuccessPage";

// For this migration, we are making AppShell the single entrypoint
import { TicketDetails } from "./Tickets/TicketDetails";
import { TicketKanbanView } from "./Tickets/TicketKanbanView";
import { CustomerListView } from "./Customers/CustomerListView";
import { CustomerProfilePage } from "../features/customers/pages/CustomerProfilePage";
import { InventoryView } from "./Inventory/InventoryView";
import { InboxView } from "./Messages/InboxView";
import { SettingsView } from "./Settings/SettingsView";
import { RepairsAnalyticsView } from "./Repairs/RepairsAnalyticsView";
import { InvoiceView } from "./Invoice/InvoiceView";
import { EstimateView } from "./Estimate/EstimateView";
import { QuotesView } from "./Quotes/QuotesView";
import { TicketQuotesView } from "./Quotes/TicketQuotesView";
import { CustomerPortalView } from "./CustomerPortalView";
import { SlaDashboardPage } from "../features/tickets/pages/SlaDashboardPage";
import { TasksPage } from "./Tasks/TasksPage";
import { ChecklistsPage } from "./Checklists/ChecklistsPage";
import { AdminDeletionRequestsPage } from "./Admin/AdminDeletionRequestsPage";
import { BottomNav } from "../components/BottomNav";
import { useWorkflowStore } from "../store/workflowStore";
import { PartsOrdersPage } from "./PartsOrdersPage";
import { SearchIndexService } from "../services/search/SearchIndexService";
import { db } from "../firebase";

import { AuthGuard } from "../components/AuthGuard";
import { GlobalSearch } from "../components/GlobalSearch";
import { InvoicesView } from "../components/InvoicesView";
import { FinancialReportsView } from "../components/FinancialReportsView";
import { CommandPalette } from "../features/command-palette/components/CommandPalette";
import { DemoModeBanner } from "../components/DemoModeBanner";
import { GuestRouteGuard } from "../components/GuestRouteGuard";
import { AdminRouteGuard } from "../components/AdminRouteGuard";

import { DashboardView } from "../features/dashboard/pages/DashboardPage";
import { TodayStatsWidget } from "../components/TodayStatsWidget";
import { Toaster, toast } from "sonner";
import { useNotifications } from "../hooks/useNotifications";

const INITIAL_NAV_GROUPS = [
  {
    title: "Operations",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", href: "/" },
      { icon: DollarSign, label: "End of Day", href: "/end-of-day" },
      { icon: ListTodo, label: "Tasks", href: "/tasks" },
      { icon: MessageSquare,
label: "Messages", href: "/messages" },
      { icon: Users, label: "Customers", href: "/customers" },
      { icon: CheckSquare, label: "Checklists", href: "/checklists" },
      { icon: BarChart3, label: "Reports", href: "/repairs" },
      { icon: Settings, label: "Settings", href: "/settings" },
    ]
  },
  {
    title: "Repairs",
    items: [
      { icon: Ticket, label: "Tickets", href: "/tickets" },
      { icon: Package, label: "Parts Orders", href: "/parts-orders" },
      { icon: Disc, label: "Robot Vacs", href: "/robot-vacs" },
      { icon: ClipboardCheck, label: "In-Ticket Quotes", href: "/ticket-quotes" },
      { icon: Wrench, label: "SLA Tracker", href: "/sla" },
      { icon: Package, label: "Inventory", href: "/inventory" },
    ]
  },
  {
    title: "Accounting",
    items: [
      { icon: FileText, label: "Invoices", href: "/invoices" },
      { icon: Mail, label: "Quotes", href: "/quotes" },
      { icon: BarChart3, label: "Financial Reports", href: "/financial-reports" },
    ]
  }
];

import { NewTicketPage } from "../features/tickets/pages/NewTicketPage";
import { NewInvoiceModal } from "../components/NewInvoiceModal";
import { NewCustomerModal } from "../features/customers/components/NewCustomerModal";
import { Button } from "../components/ui/button";

export function AppShell() {
  useNotifications();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { unreadCount } = useShop();
  const { isTechMode, toggleTechMode } = useWorkflowStore();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("sidebarCollapsed") === "true";
    }
    return false;
  });

  useEffect(() => {
    localStorage.setItem("sidebarCollapsed", isDesktopCollapsed.toString());
  }, [isDesktopCollapsed]);

  const [navGroups, setNavGroups] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("navGroups");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          const merged = parsed.map((group: any) => {
             const items = group.items.map((item: any) => {
                 let origItem = null;
                 for (const g of INITIAL_NAV_GROUPS) {
                    const found = g.items.find((i: any) => i.label === item.label);
                    if (found) { origItem = found; break; }
                 }
                 return origItem || item;
             }).filter(Boolean);
             const initialGroup = INITIAL_NAV_GROUPS.find(g => g.title === group.title);
             if (initialGroup) {
               for (const initialItem of initialGroup.items) {
                 if (!items.find((i: any) => i.label === initialItem.label)) {
                   items.push(initialItem);
                 }
               }
             }
             return { ...group, items };
          });
          return merged;
        } catch (e) {
          console.error(e);
        }
      }
    }
    return INITIAL_NAV_GROUPS;
  });

  useEffect(() => {
    const serialized = navGroups.map(g => ({
       title: g.title,
       items: g.items.map(i => ({ label: i.label, href: i.href }))
    }));
    localStorage.setItem("navGroups", JSON.stringify(serialized));
  }, [navGroups]);

  const onDragEnd = (result: DropResult) => {
    const { source, destination } = result;
    if (!destination) return;

    const sourceGroupIndex = navGroups.findIndex(g => g.title === source.droppableId);
    const destGroupIndex = navGroups.findIndex(g => g.title === destination.droppableId);

    if (sourceGroupIndex === -1 || destGroupIndex === -1) return;

    const sourceGroup = navGroups[sourceGroupIndex];
    const destGroup = navGroups[destGroupIndex];

    const sourceItems = [...sourceGroup.items];
    const destItems = source.droppableId === destination.droppableId ? sourceItems : [...destGroup.items];

    const [removed] = sourceItems.splice(source.index, 1);
    destItems.splice(destination.index, 0, removed);

    const newGroups = [...navGroups];
    newGroups[sourceGroupIndex] = { ...sourceGroup, items: sourceItems };
    if (source.droppableId !== destination.droppableId) {
      newGroups[destGroupIndex] = { ...destGroup, items: destItems };
    }

    setNavGroups(newGroups);
  };

  // Warm search index on startup
  useEffect(() => {
    if (user) {
      SearchIndexService.warmGlobalSearchIndexes(db);
    }
  }, [user]);

  const [approvedWaitingCount, setApprovedWaitingCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "crm_tickets"),
      where("status", "in", ["Waiting for Parts", "Waiting on Parts", "waiting for parts", "waiting on parts"])
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setApprovedWaitingCount(snapshot.size);
    }, (err) => {
      console.error("Error listening to approved tickets in AppShell:", err);
    });
    return () => unsubscribe();
  }, [user]);

  // Global modals and data
  const [isNewTicketOpen, setIsNewTicketOpen] = useState(false);
  const [isNewInvoiceOpen, setIsNewInvoiceOpen] = useState(false);
  const [isNewCustomerModalOpen, setIsNewCustomerModalOpen] = useState(false);
  const [currentHash, setCurrentHash] = useState(() =>
    typeof window !== "undefined" ? window.location.hash : "",
  );

  useEffect(() => {
    const handleHashChange = () => {
      setCurrentHash(window.location.hash);
    };
    window.addEventListener("hashchange", handleHashChange);
    handleHashChange();
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleOpenNewTicket = () => navigate("/tickets/new");
    const handleOpenNewInvoice = () => setIsNewInvoiceOpen(true);

    window.addEventListener("open-new-ticket", handleOpenNewTicket);
    window.addEventListener("open-new-invoice", handleOpenNewInvoice);

    return () => {
      window.removeEventListener("open-new-ticket", handleOpenNewTicket);
      window.removeEventListener("open-new-invoice", handleOpenNewInvoice);
    };
  }, []);

  if (location.pathname === "/quote-form") {
    return <PublicQuoteForm />;
  }

  if (location.pathname === "/payments" || location.pathname === "/payments/success") {
    return (
      <Routes>
        <Route path="/payments" element={<PaymentsPage />} />
        <Route path="/payments/success" element={<PaymentSuccessPage />} />
      </Routes>
    );
  }

  const isStandaloneInvoice = location.pathname.startsWith("/invoice/");
  const isStatusPortal = location.pathname.startsWith("/status/") || location.pathname.startsWith("/s/");
  const isEstimate = location.pathname.startsWith("/estimate/");
  if (isStatusPortal || isEstimate) {
    return (
      <Routes>
        <Route path="/status/:ticketId" element={<CustomerPortalView />} />
        <Route path="/s/:ticketId" element={<CustomerPortalView />} />
        <Route
          path="/estimate/:estimateId"
          element={
            <div className="h-screen w-screen overflow-hidden bg-zinc-50 relative flex flex-col">
              <EstimateView />
            </div>
          }
        />
      </Routes>
    );
  }

  if (currentHash === "#privacy-policy" || currentHash === "#/privacy-policy") {
    return (
      <PrivacyPolicyView
        onClose={() => {
          window.location.hash = "";
          setCurrentHash("");
          if (typeof window !== "undefined" && window.history) {
            window.history.replaceState(
              "",
              document.title,
              window.location.pathname + window.location.search,
            );
          }
          navigate("/");
        }}
      />
    );
  }

  if (!user) {
    return (
      <AuthGuard>
        <Routes>
          <Route path="/*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthGuard>
    );
  }

  if (isTechMode) {
    return (
      <AuthGuard>
        <Routes>
          <Route path="/*" element={<DashboardView />} />
        </Routes>
      </AuthGuard>
    );
  }

  const handleSignOut = () => {
    signOut().then(() => {
      window.location.reload();
    });
  };

  return (
    <div className="flex h-screen w-full bg-zinc-50 overflow-hidden font-sans text-zinc-900 selection:bg-zinc-200">
      <Toaster position="top-right" richColors />
      <CommandPalette />
      {/* Mobile Backdrop */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Left Sidebar */}
      <aside
        className={`
        fixed inset-y-0 left-0 z-50 bg-white border-r border-zinc-200 flex flex-col transition-[width,transform] duration-300 ease-in-out print:hidden
        md:relative md:translate-x-0 shrink-0
        ${isDesktopCollapsed ? "w-[240px] md:w-[68px]" : "w-max min-w-[240px] md:min-w-[280px]"}
        ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}
      `}
      >
        <div
          className={`p-4 h-15 flex items-center border-b border-zinc-100 flex-shrink-0 relative overflow-hidden transition-all duration-300 ${isDesktopCollapsed ? "md:justify-center justify-start" : "justify-start"}`}
        >
          <div
            className={`bg-zinc-900 rounded-lg shrink-0 flex items-center justify-center text-white font-bold shadow-sm transition-all duration-300 ${isDesktopCollapsed ? "w-8 h-8 md:mr-0 mr-3" : "w-8 h-8 mr-3"}`}
          >
            R
          </div>
          <div
            className={`font-bold whitespace-nowrap text-lg text-zinc-900 tracking-tight transition-all duration-300 ${isDesktopCollapsed ? "md:w-0 md:opacity-0 md:hidden opacity-100 w-auto text-left flex-1" : "opacity-100 w-auto flex-1"}`}
          >
            RepairSync
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="p-1 text-zinc-500 hover:bg-zinc-100 rounded-lg md:hidden shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <DragDropContext onDragEnd={onDragEnd}>
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-2 space-y-6">
          {navGroups.map((group) => {
            return (
              <div key={group.title} className="space-y-1">
                {!isDesktopCollapsed && (
                  <h3 className="px-3 text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2">
                    {group.title}
                  </h3>
                )}
                {group.title === "Repairs" && approvedWaitingCount > 0 && (
                  <button
                    onClick={() => navigate("/tickets?status=Waiting for Parts")}
                    title="Approved: Order Parts"
                    className={`w-full flex items-center px-3 py-2.5 text-sm rounded-xl transition-all outline-none relative ${
                      isDesktopCollapsed
                        ? "md:justify-center justify-start gap-3 md:gap-0"
                        : "justify-start gap-3"
                    } text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 font-medium`}
                  >
                    <ClipboardCheck className={`w-5 h-5 shrink-0 text-zinc-400`} />
                    <span className={`tracking-wide whitespace-nowrap text-left transition-all duration-300 ${isDesktopCollapsed ? "md:w-0 md:opacity-0 md:hidden opacity-100" : "flex-1 opacity-100 block"}`}>
                      Approved: Order Parts
                    </span>
                    <span className={`ml-auto shrink-0 bg-amber-500 text-white text-xs font-medium px-2 py-0.5 rounded-full shadow-sm transition-all duration-300 ${isDesktopCollapsed ? "md:hidden" : "block"}`}>
                      {approvedWaitingCount}
                    </span>
                  </button>
                )}
                <Droppable droppableId={group.title}>
                  {(provided) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className="space-y-1 min-h-[10px]"
                    >
                      {group.items.map((item: any, index: number) => {
                        let active = false;
                        if (item.href.includes("?")) {
                          const [basePath, searchStr] = item.href.split("?");
                          const itemParams = new URLSearchParams(searchStr);
                          const locParams = new URLSearchParams(location.search);
                          
                          const pathMatch = location.pathname === basePath;
                          let paramsMatch = true;
                          itemParams.forEach((val, key) => {
                            if (locParams.get(key) !== val) {
                              paramsMatch = false;
                            }
                          });
                          active = pathMatch && paramsMatch;
                        } else {
                          const isApprovedView = location.pathname === "/tickets" && new URLSearchParams(location.search).get("status") === "Approved";
                          if (isApprovedView && item.href === "/tickets") {
                            active = false;
                          } else {
                            active =
                              location.pathname === item.href ||
                              (location.pathname.startsWith(item.href) && item.href !== "/");
                          }
                        }

                        return (
                          <Draggable key={item.label} draggableId={item.label} index={index}>
                            {(provided, snapshot) => (
                              <button
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                onClick={() => navigate(item.href)}
                                title={item.label}
                                className={`w-full flex items-center px-3 py-2.5 text-sm rounded-xl transition-all outline-none relative ${
                                  isDesktopCollapsed
                                    ? "md:justify-center justify-start gap-3 md:gap-0"
                                    : "justify-start gap-3"
                                } ${
                                  active
                                    ? "bg-zinc-100 text-zinc-900 font-semibold shadow-sm"
                                    : snapshot.isDragging 
                                      ? "bg-white shadow-md z-50 ring-1 ring-zinc-200"
                                      : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 font-medium"
                                }`}
                              >
                                <item.icon
                                  className={`w-5 h-5 shrink-0 ${active ? "text-zinc-900" : "text-zinc-400"}`}
                                />
                                <span
                                  className={`tracking-wide whitespace-nowrap text-left transition-all duration-300 ${isDesktopCollapsed ? "md:w-0 md:opacity-0 md:hidden opacity-100" : "flex-1 opacity-100 block"}`}
                                >
                                  {item.label}
                                </span>

                                {item.label === "Messages" && unreadCount > 0 && (
                                  <>
                                    <span
                                      className={`ml-auto shrink-0 bg-red-50 text-red-600 border border-red-200 text-xs font-medium px-2 py-0.5 rounded-full shadow-sm transition-all duration-300 ${isDesktopCollapsed ? "md:hidden" : "block"}`}
                                    >
                                      {unreadCount > 99 ? "99+" : unreadCount}
                                    </span>
                                    <span
                                      className={`absolute right-1 top-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white block transition-all duration-300 ${isDesktopCollapsed ? "md:block hidden" : "hidden"}`}
                                    />
                                  </>
                                )}
                              </button>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </nav>
        </DragDropContext>

        {/* Expand/Collapse Toggle */}
        <div
          className={`px-2 py-2 hidden md:flex items-center border-t border-zinc-100 transition-all duration-300 ${isDesktopCollapsed ? "justify-center" : "justify-end"}`}
        >
          <button
            onClick={() => setIsDesktopCollapsed(!isDesktopCollapsed)}
            className="w-full flex items-center justify-center p-1 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
          >
            {isDesktopCollapsed ? (
              <ChevronRight className="w-5 h-5" />
            ) : (
              <ChevronLeft className="w-5 h-5 ml-auto" />
            )}
          </button>
        </div>

        {/* User Profile */}
        <div className="hidden md:block p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] border-t border-zinc-100 flex-shrink-0 bg-white">
          {user ? (
            <div
              className={`flex items-center p-2 rounded-xl hover:bg-zinc-50 transition-colors group cursor-pointer ${isDesktopCollapsed ? "md:flex-col md:justify-center justify-between" : "justify-between"}`}
            >
              <div
                className={`flex items-center min-w-0 ${isDesktopCollapsed ? "md:w-auto w-full md:justify-center" : "flex-1 block"}`}
              >
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs shrink-0">
                  {user.email?.charAt(0).toUpperCase() || "U"}
                </div>
                <div
                  className={`ml-3 overflow-hidden text-left transition-all duration-300 block flex-1 ${isDesktopCollapsed ? "md:hidden" : "block"}`}
                >
                  <p className="text-sm font-semibold truncate text-zinc-900 bg-white">
                    {user.displayName || "Technician"}
                  </p>
                  <p className="text-xs text-zinc-500 truncate">
                    {user.email}
                  </p>
                </div>
              </div>
              <div
                className={`ml-2 group/toggle transition-all duration-300 shrink-0 ${isDesktopCollapsed ? "md:hidden" : "block"}`}
              >
                <button
                  onClick={toggleTechMode}
                  className={`w-8 h-5 rounded-full relative transition-colors ${isTechMode ? "bg-emerald-500" : "bg-zinc-200"}`}
                  title={
                    isTechMode
                      ? "Exit Technician Mode"
                      : "Enter Technician Mode"
                  }
                >
                  <div
                    className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${isTechMode ? "left-4" : "left-1"}`}
                  />
                </button>
                <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-tighter mt-0.5 text-center">
                  Tech
                </p>
              </div>
              <button
                onClick={handleSignOut}
                title="Sign Out"
                className={`shrink-0 w-8 h-8 items-center justify-center text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors outline-none ml-auto ${isDesktopCollapsed ? "flex md:hidden" : "flex"}`}
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="h-12 border border-dashed border-zinc-200 rounded-xl flex items-center justify-center">
              <span
                className={`text-xs text-zinc-400 font-medium ${isDesktopCollapsed ? "md:hidden" : "block"}`}
              >
                Not signed in
              </span>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative bg-white">
        {user?.isAnonymous && <DemoModeBanner onSignUp={handleSignOut} />}
        <header className="relative h-[calc(4rem+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] md:h-16 md:pt-0 flex-shrink-0 border-b border-zinc-200 bg-white px-4 md:px-8 flex items-center justify-between z-50 print:hidden gap-4">
          <div className="flex items-center gap-2 md:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 -ml-2 text-zinc-600 hover:bg-zinc-100 rounded-lg outline-none"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
          <div className="w-full max-w-2xl flex-1">
            <GlobalSearch />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              onClick={() => navigate("/tickets/new")}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm text-sm font-semibold h-9 w-9 p-0 md:w-auto md:px-4 flex items-center justify-center gap-2"
            >
              <Ticket className="w-4 h-4 md:w-4 md:h-4" />
              <span className="hidden md:block">New Ticket</span>
            </Button>
            <Button
              onClick={() => setIsNewInvoiceOpen(true)}
              variant="outline"
              className="rounded-xl shadow-sm text-sm font-semibold h-9 px-4 hidden md:flex items-center gap-2 border-zinc-200"
            >
              <FileText className="w-4 h-4" />
              New Invoice
            </Button>
            <Button
              onClick={() => setIsNewCustomerModalOpen(true)}
              variant="outline"
              className="rounded-xl shadow-sm text-sm font-semibold h-9 px-4 hidden md:flex items-center justify-center gap-2 border-zinc-200"
            >
              <UserPlus className="w-4 h-4 text-zinc-600" />
              <span className="hidden md:block">New Customer</span>
            </Button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto overflow-x-hidden relative  bg-white">
          <AuthGuard>
            <Routes>
              <Route path="/" element={<DashboardView />} />
              <Route path="/tasks" element={<TasksPage />} />
              <Route path="/end-of-day" element={<EndOfDayPage />} />
              <Route path="/checklists" element={<ChecklistsPage />} />
              <Route
                path="/tickets"
                element={
                  <div className="flex flex-col h-full w-full bg-white">
                    <div className="px-4 md:px-8 py-4 md:py-5 border-b border-zinc-200 shrink-0 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                      <div>
                        <h1 className="text-xl md:text-2xl font-bold tracking-tight text-zinc-900">
                          Tickets Pipeline
                        </h1>
                        <p className="text-zinc-500 text-sm mt-1">
                          Manage and track your repair queue
                        </p>
                      </div>
                      <TodayStatsWidget />
                    </div>
                    <div className="flex-1 min-h-0">
                      <TicketKanbanView />
                    </div>
                  </div>
                }
              />
              <Route
                path="/robot-vacs"
                element={
                  <div className="flex flex-col h-full w-full bg-white">
                    <div className="flex-1 min-h-0">
                      <TicketKanbanView
                        filterCategories={[
                          "robovac repair",
                          "vacuum",
                          "vaccuum",
                        ]}
                      />
                    </div>
                  </div>
                }
              />
              <Route path="/tickets/new" element={<NewTicketPage />} />
              <Route path="/tickets/:id" element={<TicketDetailsWrapper />} />
              <Route path="/parts-orders" element={<PartsOrdersPage />} />
              <Route path="/customers" element={<CustomerListView />} />
              <Route path="/customers/:id" element={<CustomerProfilePage />} />
              <Route path="/invoices" element={<InvoicesView />} />
              <Route path="/financial-reports" element={<FinancialReportsView />} />
              <Route path="/quotes" element={<QuotesView />} />
              <Route path="/ticket-quotes" element={<TicketQuotesView />} />
              <Route path="/repairs" element={<RepairsAnalyticsView />} />
              <Route path="/sla" element={<SlaDashboardPage />} />
              <Route path="/invoice/:invoiceId" element={<InvoiceView />} />
              <Route
                path="/app/estimate/:estimateId"
                element={<EstimateView />}
              />
              <Route path="/inventory" element={<InventoryView />} />
              <Route path="/messages" element={<InboxView />} />
              <Route
                path="/settings"
                element={
                  <GuestRouteGuard>
                    <SettingsView />
                  </GuestRouteGuard>
                }
              />
              <Route
                path="/admin/account-deletion-requests"
                element={
                  <AdminRouteGuard>
                    <AdminDeletionRequestsPage />
                  </AdminRouteGuard>
                }
              />
            </Routes>
          </AuthGuard>
        </div>

        {isNewInvoiceOpen && (
          <NewInvoiceModal
            isOpen={isNewInvoiceOpen}
            onClose={() => setIsNewInvoiceOpen(false)}
          />
        )}

        {isNewCustomerModalOpen && (
          <NewCustomerModal
            isOpen={isNewCustomerModalOpen}
            onOpenChange={setIsNewCustomerModalOpen}
          />
        )}

        <BottomNav unreadCount={unreadCount} />
      </main>
    </div>
  );
}

function TicketDetailsWrapper() {
  const { id } = useParams();
  const navigate = useNavigate();
  return (
    <TicketDetails ticketId={id || ""} onBack={() => navigate("/tickets")} />
  );
}
