import React, { useState, useEffect } from "react";
import { collection, query, onSnapshot, doc, getDoc, orderBy, limit } from "firebase/firestore";
import { db } from "../../firebase";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import {
  FileText,
  CheckCircle2,
  Clock,
  XCircle,
  ExternalLink,
  Search,
  Filter,
  Eye,
  TrendingUp,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

interface LineItem {
  id?: string;
  name?: string;
  description?: string;
  unit_price?: number;
  unit_amount?: number;
  price?: number;
  quantity?: number;
}

interface Estimate {
  id: string;
  customer_id?: string;
  ticket_id?: string;
  estimate_number?: string;
  status: string;
  total: number;
  subtotal?: number;
  line_items?: LineItem[];
  created_at?: string;
  updated_at?: string;
}

export function TicketQuotesView() {
  const navigate = useNavigate();
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [customersMap, setCustomersMap] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "pending" | "approved" | "draft" | "declined">("all");

  useEffect(() => {
    // Listen to estimates
    const estimatesQuery = query(collection(db, "estimates"), orderBy("createdAt", "desc"), limit(1000));
    const unsubscribeEstimates = onSnapshot(
      estimatesQuery,
      (snapshot) => {
        const estList = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Estimate[];
        setEstimates(estList);
        setIsLoading(false);
      },
      (error) => {
        console.error("Error listening to estimates:", error);
        toast.error("Failed to load in-ticket quotes.");
        setIsLoading(false);
      }
    );

    // Listen to customers to resolve customer names
    const customersQuery = query(collection(db, "crm_customers"), limit(2000));
    const unsubscribeCustomers = onSnapshot(
      customersQuery,
      (snapshot) => {
        const custMap: Record<string, any> = {};
        snapshot.docs.forEach((doc) => {
          custMap[doc.id] = doc.data();
        });
        setCustomersMap(custMap);
      },
      (error) => {
        console.error("Error listening to crm_customers in TicketQuotesView:", error);
      }
    );

    return () => {
      unsubscribeEstimates();
      unsubscribeCustomers();
    };
  }, []);

  const getNormalizedStatus = (statusStr: string): "pending" | "approved" | "draft" | "declined" => {
    const s = (statusStr || "").toLowerCase().trim();
    if (s === "approved" || s === "accepted") return "approved";
    if (s === "declined" || s === "rejected") return "declined";
    if (s === "draft") return "draft";
    return "pending"; // default to pending for estimate quotes sent/pending
  };

  const getStatusBadge = (statusStr: string) => {
    const norm = getNormalizedStatus(statusStr);
    switch (norm) {
      case "approved":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 border border-emerald-200 text-emerald-700">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Approved
          </span>
        );
      case "declined":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 border border-rose-200 text-rose-700">
            <XCircle className="w-3.5 h-3.5" />
            Declined
          </span>
        );
      case "draft":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-zinc-100 border border-zinc-300 text-zinc-600">
            <FileText className="w-3.5 h-3.5" />
            Draft
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 border border-amber-200 text-amber-700 animate-pulse">
            <Clock className="w-3.5 h-3.5" />
            Pending Approval
          </span>
        );
    }
  };

  // Filter estimates
  const filteredEstimates = estimates.filter((est) => {
    const normStatus = getNormalizedStatus(est.status);
    
    // Tab filtering
    if (activeTab !== "all" && normStatus !== activeTab) {
      return false;
    }

    // Search filtering
    if (searchTerm.trim() !== "") {
      const term = searchTerm.toLowerCase();
      const estNum = (est.estimate_number || est.id || "").toLowerCase();
      const ticketId = (est.ticket_id || "").toLowerCase();
      
      // Resolve customer details
      const customer = est.customer_id ? customersMap[est.customer_id] : null;
      const custName = customer
        ? `${customer.firstname || ""} ${customer.lastname || ""} ${customer.fullname || ""} ${customer.business_name || ""}`.toLowerCase()
        : "";

      return estNum.includes(term) || ticketId.includes(term) || custName.includes(term);
    }

    return true;
  });

  // Calculate stats
  const totalInvoiced = estimates.reduce((acc, est) => acc + (Number(est.total) || 0), 0);
  
  const pendingList = estimates.filter((e) => getNormalizedStatus(e.status) === "pending");
  const pendingTotal = pendingList.reduce((acc, est) => acc + (Number(est.total) || 0), 0);

  const approvedList = estimates.filter((e) => getNormalizedStatus(e.status) === "approved");
  const approvedTotal = approvedList.reduce((acc, est) => acc + (Number(est.total) || 0), 0);

  const draftList = estimates.filter((e) => getNormalizedStatus(e.status) === "draft");
  const draftTotal = draftList.reduce((acc, est) => acc + (Number(est.total) || 0), 0);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(val);
  };

  return (
    <div className="flex flex-col h-full w-full bg-zinc-50/50">
      {/* Header */}
      <div className="px-4 md:px-8 py-5 border-b border-zinc-200 bg-white shrink-0 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-zinc-900">In-Ticket Quotes</h1>
          <p className="text-zinc-500 text-sm mt-1">Track and manage repair estimates and quotes pending customer approval</p>
        </div>
      </div>

      <div className="p-4 md:p-8 flex-1 overflow-auto space-y-6 max-w-7xl mx-auto w-full">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Pending Quotes</p>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl font-black text-amber-600">{pendingList.length}</span>
              <span className="text-xs text-zinc-400 font-medium">({formatCurrency(pendingTotal)})</span>
            </div>
            <p className="text-xs text-zinc-400 mt-1">Awaiting customer response</p>
          </div>

          <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Approved Quotes</p>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl font-black text-emerald-600">{approvedList.length}</span>
              <span className="text-xs text-zinc-400 font-medium">({formatCurrency(approvedTotal)})</span>
            </div>
            <p className="text-xs text-zinc-400 mt-1">Ready for technician action</p>
          </div>

          <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Draft Quotes</p>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl font-black text-zinc-600">{draftList.length}</span>
              <span className="text-xs text-zinc-400 font-medium">({formatCurrency(draftTotal)})</span>
            </div>
            <p className="text-xs text-zinc-400 mt-1">Unsent / Under review</p>
          </div>

          <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Total Est. Pipeline</p>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl font-black text-zinc-900">{estimates.length}</span>
              <span className="text-xs text-zinc-400 font-medium">({formatCurrency(totalInvoiced)})</span>
            </div>
            <p className="text-xs text-zinc-400 mt-1">Total in-ticket quotes generated</p>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white p-4 border border-zinc-200 rounded-2xl shadow-sm">
          {/* Tabs */}
          <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-xl w-fit shrink-0 overflow-x-auto">
            {(["all", "pending", "approved", "draft", "declined"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-xs font-bold capitalize rounded-lg transition-all ${
                  activeTab === tab
                    ? "bg-white text-zinc-900 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Search estimate #, ticket ID, or customer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-zinc-200 focus:border-zinc-400 rounded-xl text-sm font-medium focus:outline-none bg-zinc-50 focus:bg-white transition-all placeholder-zinc-400 text-zinc-800"
            />
          </div>
        </div>

        {/* Main Content Card */}
        <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="flex justify-center items-center py-20 text-zinc-400 text-sm font-medium gap-2">
              <div className="w-5 h-5 border-2 border-zinc-300 border-t-zinc-800 rounded-full animate-spin" />
              Loading quotes & estimates...
            </div>
          ) : filteredEstimates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
              <FileText className="w-12 h-12 text-zinc-300 mb-3" />
              <p className="font-bold text-zinc-700 text-base">No in-ticket quotes found</p>
              <p className="text-zinc-500 text-sm mt-1 max-w-sm">
                No quotes match the current filters. Create an estimate directly inside a ticket's workflow panel.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-zinc-50 text-zinc-500 border-b border-zinc-200">
                  <tr className="font-bold uppercase tracking-wider text-xs">
                    <th className="px-6 py-4">Quote / Est #</th>
                    <th className="px-6 py-4">Linked Ticket</th>
                    <th className="px-6 py-4">Customer</th>
                    <th className="px-6 py-4">Amount</th>
                    <th className="px-6 py-4">Line Items Summary</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filteredEstimates.map((est) => {
                    const customer = est.customer_id ? customersMap[est.customer_id] : null;
                    const custName = customer
                      ? customer.fullname || `${customer.firstname || ""} ${customer.lastname || ""}`.trim() || "Unknown Customer"
                      : "Resolving...";
                    const custPhone = customer?.phone || "";

                    const formattedDate = est.created_at
                      ? format(new Date(est.created_at), "MMM d, yyyy")
                      : "No Date";

                    // Summarize line items
                    const items = est.line_items || [];
                    const itemNames = items.map((i) => i.name || i.description).filter(Boolean).join(", ");

                    return (
                      <tr key={est.id} className="hover:bg-zinc-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-bold text-zinc-900 font-mono text-xs">{est.estimate_number || est.id.substring(0, 8).toUpperCase()}</p>
                          <p className="text-xs text-zinc-400 font-medium mt-0.5">{formattedDate}</p>
                        </td>

                        <td className="px-6 py-4">
                          {est.ticket_id ? (
                            <button
                              onClick={() => navigate(`/tickets/${est.ticket_id}`)}
                              className="inline-flex items-center gap-1.5 px-3 py-1 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 rounded-lg text-xs font-semibold text-zinc-700 transition-all hover:text-zinc-900"
                            >
                              Ticket #{est.ticket_id.substring(0, 8).toUpperCase()}
                              <ArrowRight className="w-3.5 h-3.5 text-zinc-400" />
                            </button>
                          ) : (
                            <span className="text-zinc-400 italic text-xs">Unlinked</span>
                          )}
                        </td>

                        <td className="px-6 py-4">
                          <p className="font-semibold text-zinc-900 text-xs">{custName}</p>
                          {custPhone && <p className="text-xs text-zinc-500 mt-0.5 font-mono">{custPhone}</p>}
                        </td>

                        <td className="px-6 py-4 font-black text-zinc-900 font-mono text-xs">
                          {formatCurrency(est.total)}
                        </td>

                        <td className="px-6 py-4 max-w-[200px] truncate text-zinc-500 font-medium text-xs">
                          {itemNames || <span className="italic text-zinc-400">No details</span>}
                        </td>

                        <td className="px-6 py-4">
                          {getStatusBadge(est.status)}
                        </td>

                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {getNormalizedStatus(est.status) === 'approved' && est.ticket_id && (
                              <button
                                onClick={() => navigate(`/tickets/${est.ticket_id}?openEstimate=${est.id}`)}
                                title="Proceed to Repair"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg border border-emerald-700 shadow-sm transition-all text-xs font-bold whitespace-nowrap"
                              >
                                Proceed to Repair
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {est.ticket_id && (
                              <button
                                onClick={() => navigate(`/tickets/${est.ticket_id}`)}
                                title="Go to Ticket Details"
                                className="p-1.5 hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900 rounded-lg border border-zinc-100 shadow-sm transition-all bg-white"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => navigate(`/app/estimate/${est.id}`)}
                              title="Open Customer Approval Portal"
                              className="p-1.5 hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900 rounded-lg border border-zinc-100 shadow-sm transition-all bg-white"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
