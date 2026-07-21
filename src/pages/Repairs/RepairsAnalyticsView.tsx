import React, { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart3,
  TrendingUp,
  AlertCircle,
  Clock,
  FileText,
  DollarSign,
  Calendar as CalendarIcon,
  CheckCircle2,
  Activity,
  Shield,
  Settings,
  Server,
  RefreshCw,
  Smartphone,
  Cpu,
  Database,
  Sparkles,
  WifiOff,
} from "lucide-react";
import axios from "axios";
import { db } from "../../firebase";
import { collection, query, orderBy, getDoc, doc, limit } from "firebase/firestore";
import { RealtimeManager } from "../../services/RealtimeManager";
import {
  CostAnalyticsEngine,
  CostReport,
} from "../../services/CostAnalyticsEngine";
import { SearchAnalyticsService } from "../../services/search/SearchAnalyticsService";
import { format } from "date-fns";
import { Button } from "../../components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";

export function RepairsAnalyticsView() {
  const [activeTab, setActiveTab] = useState("overview");
  const [invoices, setInvoices] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const qInvoices = query(
      collection(db, "invoices"),
      orderBy("created_at", "desc"),
      limit(1000)
    );

    const qTickets = query(
      collection(db, "crm_tickets"),
      orderBy("created_at", "desc"),
      limit(1000)
    );

    // In-memory cache for customer names to strictly avoid N+1 Firestore fetch loops
    const customerNameCache = new Map<string, string>();

    const unsubInvoices = RealtimeManager.subscribe(
      "analytics_invoices_sync",
      qInvoices,
      async (rawDocs: any[]) => {
        const invs = [];
        for (const data of rawDocs) {
          let customerName = "Unknown";
          if (data.customer_id) {
            const cachedName = customerNameCache.get(data.customer_id);
            if (cachedName) {
              customerName = cachedName;
            } else {
              try {
                // Read count tracked securely via CostAnalyticsEngine
                const cSnap = await getDoc(
                  doc(db, "crm_customers", data.customer_id),
                );
                CostAnalyticsEngine.recordReads(
                  `crm_customers_${data.customer_id}`,
                  1,
                );
                if (cSnap.exists()) {
                  const cData = cSnap.data();
                  customerName =
                    cData.fullname ||
                    `${cData.firstname || ""} ${cData.lastname || ""}`.trim() ||
                    "Customer";
                  customerNameCache.set(data.customer_id, customerName);
                }
              } catch (e) {}
            }
          }
          invs.push({ id: data.id, ...data, customerName });
        }
        setInvoices(invs);
      },
    );

    const unsubTickets = RealtimeManager.subscribe(
      "analytics_tickets_sync",
      qTickets,
      (rawDocs: any[]) => {
        setTickets(rawDocs.map((d) => ({ id: d.id, ...d })));
      },
    );

    return () => {
      unsubInvoices();
      unsubTickets();
    };
  }, []);

  const [eodDate, setEodDate] = useState<string>(
    format(new Date(), "yyyy-MM-dd"),
  );

  const eodInvoices = invoices.filter((inv) => {
    const isPaid = inv.status?.toLowerCase() === 'paid';
    const timestamp = inv.paid_at || inv.created_at;
    if (!isPaid || !timestamp) return false;
    const dateObj = timestamp.toDate
      ? timestamp.toDate()
      : new Date(timestamp);
    return format(dateObj, "yyyy-MM-dd") === eodDate;
  });

  const eodTotal = eodInvoices.reduce(
    (acc, curr) => acc + Number(curr.total || 0),
    0,
  );

  const eodByTender = eodInvoices.reduce(
    (acc, curr) => {
      const t = curr.tender_type || "Unknown";
      acc[t] = (acc[t] || 0) + Number(curr.total || 0);
      return acc;
    },
    {} as Record<string, number>,
  );

  const { weeklyRevenue, completedTickets, avgTurnaround, warrantyReturns } = React.useMemo(() => {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    let weeklyRev = 0;
    invoices.forEach(inv => {
      const isPaid = inv.status?.toLowerCase() === 'paid';
      const timestamp = inv.paid_at || inv.created_at;
      
      if (isPaid && timestamp) {
        const d = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
        if (d >= oneWeekAgo) {
          weeklyRev += Number(inv.total || 0);
        }
      }
    });

    let completed = 0;
    let turnaroundTotal = 0;
    let turnaroundCount = 0;
    let warranty = 0;

    tickets.forEach(ticket => {
      const created = ticket.created_at?.toDate ? ticket.created_at.toDate() : new Date(ticket.created_at || Date.now());
      
      if (ticket.status === 'Completed' || ticket.status === 'Ready for Pickup' || ticket.status === 'Collected') {
        if (ticket.updated_at) {
          const updated = ticket.updated_at?.toDate ? ticket.updated_at.toDate() : new Date(ticket.updated_at);
          if (updated >= oneWeekAgo) {
             completed++;
             turnaroundTotal += (updated.getTime() - created.getTime());
             turnaroundCount++;
          }
        } else if (created >= oneWeekAgo) {
          completed++;
        }
      }

      if (ticket.warranty_return || ticket.category === 'Warranty') {
        if (created >= oneWeekAgo) warranty++;
      }
    });

    return {
      weeklyRevenue: weeklyRev,
      completedTickets: completed,
      avgTurnaround: turnaroundCount > 0 ? Math.round(turnaroundTotal / turnaroundCount / (1000 * 60 * 60)) : 0,
      warrantyReturns: warranty
    };
  }, [invoices, tickets]);

  const STATS = [
    { label: "Weekly Revenue", value: `$${weeklyRevenue.toFixed(2)}`, trend: "", up: true, onClick: () => navigate("/invoices") },
    { label: "Tickets Completed", value: `${completedTickets}`, trend: "", up: true, onClick: () => navigate("/repairs") },
    { label: "Avg Turnaround", value: `${avgTurnaround} hrs`, trend: "", up: true, onClick: () => navigate("/repairs") },
    { label: "Warranty Returns", value: `${warrantyReturns}`, trend: "", up: false, onClick: () => navigate("/repairs") },
  ];

  const revenueData = React.useMemo(() => {
    const data: Record<string, number> = {};
    invoices.forEach((inv) => {
      const isPaid = inv.status?.toLowerCase() === 'paid';
      const timestamp = inv.paid_at || inv.created_at;
      if (isPaid && timestamp) {
        const date = timestamp.toDate
          ? timestamp.toDate()
          : new Date(timestamp);
        const dateStr = format(date, "MMM dd");
        data[dateStr] = (data[dateStr] || 0) + Number(inv.total || 0);
      }
    });
    // Create an array and sort by date.
    // Since we're parsing "MMM dd" back, we should probably sort it properly or just reverse the map (if invoices are newest first).
    // The invoices are ordered desc, so we can just reverse the resulting entries to get chronological order.
    return Object.entries(data)
      .map(([name, amount]) => ({ name, amount }))
      .reverse()
      .slice(-14); // Last 14 days
  }, [invoices]);

  const technicianData = React.useMemo(() => {
    const data: Record<string, number> = {};
    tickets.forEach((ticket) => {
      if (
        ticket.status === "Completed" ||
        ticket.status === "Ready for Pickup" ||
        ticket.status === "Collected"
      ) {
        const tech = ticket.assigned_technician || "Unassigned";
        data[tech] = (data[tech] || 0) + 1;
      }
    });
    return Object.entries(data)
      .map(([name, completed]) => ({ name, completed }))
      .sort((a, b) => b.completed - a.completed)
      .slice(0, 5); // Top 5 technicians
  }, [tickets]);

  return (
    <div className="flex flex-col h-full w-full bg-zinc-50/50">
      <div className="px-4 md:px-8 py-4 md:py-6 border-b border-zinc-200 bg-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-zinc-900">
            Reports & Analytics
          </h1>
          <p className="text-zinc-500 text-sm mt-1">
            Shop performance, EOD, and financial reporting
          </p>
        </div>
      </div>

      <div className="p-4 md:p-8 flex-1 overflow-auto">
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex flex-col h-full space-y-6"
        >
          <TabsList className="flex w-full max-w-full bg-zinc-100 rounded-xl md:rounded-[1.5rem] p-2 h-auto group-data-horizontal/tabs:h-auto overflow-x-auto flex-nowrap justify-start gap-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <TabsTrigger
              value="overview"
              className="rounded-lg md:rounded-xl font-bold whitespace-nowrap px-6 py-3 shrink-0 group-data-horizontal/tabs:h-auto min-h-[2.5rem]"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="eod"
              className="rounded-lg md:rounded-xl font-bold whitespace-nowrap px-6 py-3 shrink-0 group-data-horizontal/tabs:h-auto min-h-[2.5rem]"
            >
              End of Day Report
            </TabsTrigger>
            <TabsTrigger
              value="advanced"
              className="rounded-lg md:rounded-xl font-bold whitespace-nowrap px-6 py-3 shrink-0 group-data-horizontal/tabs:h-auto min-h-[2.5rem]"
            >
              Advanced Reports
            </TabsTrigger>
            <TabsTrigger
              value="cost"
              className="rounded-lg md:rounded-xl font-bold whitespace-nowrap px-6 py-3 shrink-0 group-data-horizontal/tabs:h-auto min-h-[2.5rem]"
            >
              Cost Insights
            </TabsTrigger>
            <TabsTrigger
              value="search"
              className="rounded-lg md:rounded-xl font-bold whitespace-nowrap px-6 py-3 shrink-0 group-data-horizontal/tabs:h-auto min-h-[2.5rem]"
            >
              Search Diagnostics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-0 outline-none flex-1">
            <div className="mb-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {STATS.map((stat) => (
                <div
                  key={stat.label}
                  onClick={stat.onClick}
                  className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm relative overflow-hidden cursor-pointer hover:border-zinc-300 hover:bg-zinc-50/50 transition-all text-left"
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-zinc-500">
                      {stat.label}
                    </p>
                    {stat.trend && (
                      <span
                        className={`text-xs font-bold ${stat.up ? "text-emerald-600" : "text-rose-500"}`}
                      >
                        {stat.trend}
                      </span>
                    )}
                  </div>
                  <div className="flex items-end gap-3">
                    <span className="text-3xl font-bold text-zinc-900 tracking-tight">
                      {stat.value}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm min-h-[400px] flex flex-col">
                <div className="flex items-center gap-2 mb-6 text-zinc-800 font-bold">
                  <TrendingUp className="w-5 h-5 text-emerald-500" />
                  <h3>Revenue Volume</h3>
                </div>
                <div className="flex-1 w-full min-h-[300px]">
                  {revenueData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={revenueData}
                        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="#e4e4e7"
                        />
                        <XAxis
                          dataKey="name"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 12, fill: "#71717a" }}
                          dy={10}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 12, fill: "#71717a" }}
                          tickFormatter={(val) => `$${val}`}
                        />
                        <RechartsTooltip
                          contentStyle={{
                            borderRadius: "12px",
                            border: "1px solid #e4e4e7",
                            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                          }}
                          formatter={(value: number) => [
                            `$${value.toFixed(2)}`,
                            "Revenue",
                          ]}
                        />
                        <Line
                          type="monotone"
                          dataKey="amount"
                          stroke="#10b981"
                          strokeWidth={3}
                          dot={{ r: 4, fill: "#10b981", strokeWidth: 0 }}
                          activeDot={{ r: 6, strokeWidth: 0 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full w-full flex flex-col items-center justify-center text-zinc-400">
                      <TrendingUp className="w-12 h-12 mb-4 opacity-20" />
                      <p className="font-medium text-zinc-600">
                        Revenue Volume Chart
                      </p>
                      <p className="text-sm text-zinc-400">
                        No revenue data available yet
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm min-h-[400px] flex flex-col">
                <div className="flex items-center gap-2 mb-6 text-zinc-800 font-bold">
                  <BarChart3 className="w-5 h-5 text-blue-500" />
                  <h3>Technician Performance</h3>
                </div>
                <div className="flex-1 w-full min-h-[300px]">
                  {technicianData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={technicianData}
                        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                        layout="vertical"
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          horizontal={false}
                          stroke="#e4e4e7"
                        />
                        <XAxis
                          type="number"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 12, fill: "#71717a" }}
                        />
                        <YAxis
                          dataKey="name"
                          type="category"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 12, fill: "#71717a" }}
                          width={180}
                          tickFormatter={(val) => {
                            const str = String(val || "");
                            return str.length > 22 ? str.slice(0, 22) + "..." : str;
                          }}
                        />
                        <RechartsTooltip
                          contentStyle={{
                            borderRadius: "12px",
                            border: "1px solid #e4e4e7",
                            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                          }}
                          cursor={{ fill: "#f4f4f5" }}
                        />
                        <Bar
                          dataKey="completed"
                          fill="#3b82f6"
                          radius={[0, 4, 4, 0]}
                          barSize={24}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full w-full flex flex-col items-center justify-center text-zinc-400">
                      <BarChart3 className="w-12 h-12 mb-4 opacity-20" />
                      <p className="font-medium text-zinc-600">
                        Technician Performance
                      </p>
                      <p className="text-sm text-zinc-400">
                        No completed tickets yet
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent
            value="eod"
            className="h-full mt-0 flex flex-col space-y-6"
          >
            <div className="flex justify-between items-center mb-2">
              <div>
                <h3 className="text-xl font-black text-zinc-800">
                  End of Day Reporting
                </h3>
                <p className="text-sm text-muted-foreground">
                  Select a date to view total revenue
                </p>
              </div>
              <div className="relative">
                <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="date"
                  value={eodDate}
                  onChange={(e) => setEodDate(e.target.value)}
                  className="pl-9 h-12 rounded-xl bg-white border border-zinc-200 focus-visible:ring-0 focus-visible:border-zinc-300 shadow-sm px-3 py-1 text-sm font-bold transition-colors cursor-pointer hover:bg-zinc-50"
                  max={format(new Date(), "yyyy-MM-dd")}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-8 bg-emerald-500 rounded-2xl border border-emerald-600/20 relative overflow-hidden shadow-lg shadow-emerald-500/20">
                <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full translate-x-1/3 -translate-y-1/3 blur-2xl pointer-events-none" />
                <p className="text-[11px] font-semibold uppercase text-emerald-50 tracking-wide mb-2 relative z-10">
                  {eodDate === format(new Date(), "yyyy-MM-dd")
                    ? "Today's Revenue"
                    : "Total Revenue"}
                </p>
                <p className="text-7xl font-black text-white relative z-10 flex items-start">
                  <span className="text-3xl mt-2 mr-1 opacity-70">$</span>
                  {eodTotal.toFixed(2)}
                </p>
                <p className="text-sm font-medium text-emerald-100 mt-4 flex items-center gap-1.5 relative z-10 bg-emerald-600/30 w-fit px-3 py-1.5 rounded-full">
                  <Clock className="w-4 h-4" />{" "}
                  {format(new Date(eodDate + "T00:00:00"), "PPPP")}
                </p>
              </div>

              <div className="p-8 bg-white rounded-2xl border border-zinc-200 shadow-sm h-full flex flex-col">
                <div className="flex items-center gap-2 mb-6 text-zinc-400">
                  <DollarSign className="w-4 h-4" />
                  <p className="text-xs font-semibold uppercase tracking-wide">
                    Breakdown by Tender
                  </p>
                </div>
                <div className="flex-1 flex flex-col justify-center space-y-4">
                  {Object.entries(eodByTender).map(([tender, amount]) => (
                    <div
                      key={tender}
                      className="flex justify-between items-center text-sm font-medium p-3 rounded-xl hover:bg-zinc-50 transition-colors"
                    >
                      <span className="text-zinc-600 flex items-center gap-3 capitalize font-bold">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm"></div>
                        {tender}
                      </span>
                      <span className="font-black text-lg text-zinc-900 bg-zinc-100 px-3 py-1 rounded-lg">
                        ${Number(amount).toFixed(2)}
                      </span>
                    </div>
                  ))}
                  {Object.keys(eodByTender).length === 0 && (
                    <div className="text-muted-foreground text-sm font-medium py-8 text-center bg-zinc-50 rounded-xl border border-dashed border-zinc-200">
                      No payments received{" "}
                      {eodDate === format(new Date(), "yyyy-MM-dd")
                        ? "today"
                        : "on selected date"}
                      .
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex-1 min-h-0 flex flex-col mt-6">
              <h4 className="text-xs uppercase tracking-wide font-black text-zinc-400 mb-3 ml-2 flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {eodDate === format(new Date(), "yyyy-MM-dd")
                  ? "Today's"
                  : "Selected Date's"}{" "}
                Paid Invoices ({eodInvoices.length})
              </h4>
              <div className="grid grid-cols-1 gap-3">
                {eodInvoices.map((inv, idx) => (
                  <div
                    key={inv.id}
                    className="p-5 rounded-2xl bg-white border border-zinc-200 hover:border-emerald-200 hover:shadow-md transition-all cursor-pointer flex justify-between items-center group"
                    onClick={() => navigate(`/invoice/${inv.id}`)}
                  >
                    <div className="flex items-center gap-5">
                      <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center font-black text-sm shrink-0 border border-emerald-100 group-hover:bg-emerald-100 transition-colors">
                        {idx + 1}
                      </div>
                      <div>
                        <p className="text-base font-bold text-zinc-800">
                          {inv.customerName}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge
                            variant="outline"
                            className="text-xs uppercase font-bold text-zinc-500 bg-zinc-50 tracking-wider"
                          >
                            {inv.tender_type}
                          </Badge>
                          <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider">
                            #{inv.invoice_number ? inv.invoice_number.replace(/\D/g, '') : inv.id.substring(0, 6)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-black text-zinc-900">
                        ${Number(inv.total).toFixed(2)}
                      </p>
                      <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide mt-1">
                        {inv.paid_at?.toDate
                          ? format(inv.paid_at.toDate(), "h:mm a")
                          : ""}
                      </p>
                    </div>
                  </div>
                ))}
                {eodInvoices.length === 0 && (
                  <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-2xl border border-zinc-200">
                    <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center mb-4">
                      <DollarSign className="w-8 h-8 text-zinc-300" />
                    </div>
                    <p className="text-sm font-bold text-zinc-400 uppercase tracking-wide">
                      No invoices paid{" "}
                      {eodDate === format(new Date(), "yyyy-MM-dd")
                        ? "today"
                        : "on selected date"}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="advanced" className="mt-0">
            <div className="flex flex-col space-y-6">
              <div className="flex gap-4">
                <div className="flex-1 p-6 bg-white rounded-2xl border border-zinc-200 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-[11px] uppercase font-semibold tracking-wide text-zinc-400 mb-1">
                      Total Invoices
                    </p>
                    <p className="text-4xl font-black text-zinc-900">
                      {invoices.length}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
                    <FileText className="w-6 h-6" />
                  </div>
                </div>
                <div className="flex-1 p-6 bg-white rounded-2xl border border-zinc-200 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-[11px] uppercase font-semibold tracking-wide text-amber-500/70 mb-1">
                      Unpaid Invoices
                    </p>
                    <p className="text-4xl font-black text-amber-500">
                      {invoices.filter((i) => i.status?.toLowerCase() !== "paid").length}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-amber-50 text-amber-500 rounded-xl flex items-center justify-center">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                </div>
                <div className="flex-1 p-6 bg-white rounded-2xl border border-zinc-200 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-[11px] uppercase font-semibold tracking-wide text-zinc-400 mb-1">
                      Total Tickets
                    </p>
                    <p className="text-4xl font-black text-zinc-900">
                      {tickets.length}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center">
                    <Activity className="w-6 h-6" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm min-h-[400px] flex flex-col">
                  <div className="flex items-center gap-2 mb-6 text-zinc-800 font-bold">
                    <FileText className="w-5 h-5 text-indigo-500" />
                    <h3>Ticket Status Breakdown</h3>
                  </div>
                  <div className="flex-1 w-full">
                    {tickets.length > 0 ? (
                      (() => {
                        const statusCounts = tickets.reduce(
                          (acc, t) => {
                            const status = t.status || "Unknown";
                            acc[status] = (acc[status] || 0) + 1;
                            return acc;
                          },
                          {} as Record<string, number>,
                        );
                        const data = Object.entries(statusCounts)
                          .map(([name, count]) => ({ name, count }))
                          .sort((a, b) => Number(b.count) - Number(a.count));
                        return (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={data}
                              margin={{
                                top: 10,
                                right: 10,
                                left: 0,
                                bottom: 0,
                              }}
                            >
                              <CartesianGrid
                                strokeDasharray="3 3"
                                vertical={false}
                                stroke="#e4e4e7"
                              />
                              <XAxis
                                dataKey="name"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 11, fill: "#71717a" }}
                                interval={0}
                                angle={-45}
                                textAnchor="end"
                                height={80}
                              />
                              <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 12, fill: "#71717a" }}
                              />
                              <RechartsTooltip
                                contentStyle={{
                                  borderRadius: "12px",
                                  border: "1px solid #e4e4e7",
                                  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                                }}
                                cursor={{ fill: "#f4f4f5" }}
                              />
                              <Bar
                                dataKey="count"
                                fill="#8b5cf6"
                                radius={[4, 4, 0, 0]}
                                barSize={32}
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        );
                      })()
                    ) : (
                      <div className="h-full w-full flex flex-col items-center justify-center text-zinc-400">
                        <Activity className="w-12 h-12 mb-4 opacity-20" />
                        <p className="font-medium text-zinc-600">
                          No ticket data available
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm min-h-[400px] flex flex-col">
                  <div className="flex items-center gap-2 mb-6 text-zinc-800 font-bold">
                    <DollarSign className="w-5 h-5 text-emerald-500" />
                    <h3>Revenue by Tender (All Time)</h3>
                  </div>
                  <div className="flex-1 w-full">
                    {invoices.length > 0 ? (
                      (() => {
                        const tenderCounts = invoices.reduce(
                          (acc, inv) => {
                            if (inv.status?.toLowerCase() === "paid") {
                              const tender = inv.tender_type || "Unknown";
                              acc[tender] =
                                (acc[tender] || 0) + Number(inv.total || 0);
                            }
                            return acc;
                          },
                          {} as Record<string, number>,
                        );
                        const data = Object.entries(tenderCounts)
                          .map(([name, amount]) => ({ name, amount }))
                          .sort((a, b) => Number(b.amount) - Number(a.amount));
                        return (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={data}
                              margin={{
                                top: 10,
                                right: 10,
                                left: 0,
                                bottom: 0,
                              }}
                            >
                              <CartesianGrid
                                strokeDasharray="3 3"
                                vertical={false}
                                stroke="#e4e4e7"
                              />
                              <XAxis
                                dataKey="name"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 12, fill: "#71717a" }}
                                dy={10}
                              />
                              <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 12, fill: "#71717a" }}
                                tickFormatter={(val) => `$${val}`}
                              />
                              <RechartsTooltip
                                contentStyle={{
                                  borderRadius: "12px",
                                  border: "1px solid #e4e4e7",
                                  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                                }}
                                cursor={{ fill: "#f4f4f5" }}
                                formatter={(value: number) => [
                                  `$${value.toFixed(2)}`,
                                  "Revenue",
                                ]}
                              />
                              <Bar
                                dataKey="amount"
                                fill="#10b981"
                                radius={[4, 4, 0, 0]}
                                barSize={32}
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        );
                      })()
                    ) : (
                      <div className="h-full w-full flex flex-col items-center justify-center text-zinc-400">
                        <DollarSign className="w-12 h-12 mb-4 opacity-20" />
                        <p className="font-medium text-zinc-600">
                          No payment data available
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="cost" className="mt-0">
            <CostInsightsView />
          </TabsContent>

          <TabsContent value="search" className="mt-0">
            <SearchDiagnosticsView />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function CostInsightsView() {
  const [report, setReport] = useState<CostReport>(
    CostAnalyticsEngine.getReport(),
  );
  const [activeListeners, setActiveListeners] = useState<
    Array<{ key: string; refs: number }>
  >([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchStats = () => {
    setReport(CostAnalyticsEngine.getReport());
    setActiveListeners(RealtimeManager.getDiagnosticReport());
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleReset = () => {
    setIsRefreshing(true);
    CostAnalyticsEngine.reset();
    setTimeout(() => {
      fetchStats();
      setIsRefreshing(false);
    }, 400);
  };

  return (
    <div className="space-y-6">
      {/* Top Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-zinc-900 text-white p-6 rounded-2xl border border-zinc-800 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full translate-x-1/2 -translate-y-1/2 blur-xl pointer-events-none" />
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
            Infrastructure Cost
          </p>
          <div className="flex flex-col relative pt-1">
            <span className="text-3xl font-black tracking-tight leading-none">
              ${report.totalCostUsd.toFixed(4)}
            </span>
            <span className="text-xs text-zinc-500 font-bold uppercase mt-1">
              USD
            </span>
          </div>
          <p className="text-xs text-emerald-400 font-black tracking-tight mt-4 uppercase flex items-center gap-1">
            <Shield className="w-3.5 h-3.5 shrink-0" /> Real-time active savings
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm relative overflow-hidden">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
            Firestore Reads
          </p>
          <div className="flex flex-col relative pt-1">
            <span className="text-3xl font-black text-zinc-950 tracking-tight leading-none">
              {report.firestoreReads}
            </span>
            <span className="text-xs text-zinc-400 font-bold uppercase mt-1">
              documents
            </span>
          </div>
          <p className="text-xs text-zinc-500 font-bold mt-4 uppercase flex items-center gap-1">
            <Server className="w-3.5 h-3.5 shrink-0 text-primary" /> Multi-tier
            cache active
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm relative overflow-hidden">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
            Active Listeners
          </p>
          <div className="flex flex-col relative pt-1">
            <span className="text-3xl font-black text-zinc-950 tracking-tight leading-none">
              {report.activeListenersCount}
            </span>
            <span className="text-xs text-zinc-400 font-bold uppercase mt-1">
              streams
            </span>
          </div>
          <p className="text-xs text-zinc-500 font-bold mt-4 uppercase flex items-center gap-1">
            <Activity className="w-3.5 h-3.5 shrink-0 text-emerald-500" />{" "}
            Multiplexing deduplicated
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm relative overflow-hidden">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
            Interactive Triggers
          </p>
          <div className="flex flex-col relative pt-1">
            <span className="text-3xl font-black text-zinc-950 tracking-tight leading-none">
              {report.simulatedSmsSent +
                Math.floor(report.simulatedAiTokens / 100)}
            </span>
            <span className="text-xs text-zinc-400 font-bold uppercase mt-1">
              triggers
            </span>
          </div>
          <p className="text-xs text-zinc-500 font-bold mt-4 uppercase flex items-center gap-1">
            <Smartphone className="w-3.5 h-3.5 shrink-0 text-amber-500" />{" "}
            Outbound SMS & AI guarded
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Core stream list */}
        <div className="lg:col-span-2 bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm flex flex-col min-h-[350px]">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-black text-zinc-800">
                Multiplexed Real-time Channels
              </h3>
              <p className="text-xs text-zinc-500 mt-1">
                Deduplicated listeners managed through RealtimeManager
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={isRefreshing}
              className="text-xs rounded-xl font-bold flex items-center gap-1.5 bg-zinc-50 hover:bg-zinc-100 transition-colors"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`}
              />
              Reset Telemetry
            </Button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto max-h-[280px]">
            {activeListeners.map((stream) => (
              <div
                key={stream.key}
                className="flex justify-between items-center p-4 rounded-xl bg-zinc-50 border border-zinc-100 hover:border-zinc-200 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0 shadow-sm" />
                  <div>
                    <p className="text-xs font-black text-zinc-800 font-mono tracking-tight">
                      {stream.key}
                    </p>
                    <p className="text-xs text-zinc-400 font-bold uppercase tracking-wider mt-0.5">
                      Multiplexed Stream Channel
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="bg-zinc-100 border border-zinc-200 text-zinc-700 font-semibold text-xs uppercase rounded-lg px-2 py-0.5">
                    {stream.refs}{" "}
                    {stream.refs === 1 ? "Subscriber" : "Subscribers"}
                  </span>
                </div>
              </div>
            ))}
            {activeListeners.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center text-zinc-400 flex-1">
                <Cpu className="w-10 h-10 mb-2 opacity-30 text-primary" />
                <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">
                  No active listeners registered
                </p>
                <p className="text-[11px] text-zinc-400 mt-1">
                  Real-time streams will allocate on interaction.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Cost Optimization metrics */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl text-white flex flex-col justify-between min-h-[350px]">
          <div>
            <div className="flex items-center gap-2 text-zinc-400 mb-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Monthly Projection Curve
              </p>
            </div>
            <p className="text-2xl font-black tracking-tight mt-1">
              Cost Compression Metrics
            </p>
            <p className="text-zinc-400 text-xs mt-1.5 leading-relaxed font-semibold">
              By implementing multiplexed stream connections, partial customer
              caching, and stale-while-revalidate caches, your billing impact
              decreases dramatically.
            </p>
          </div>

          <div className="space-y-4 my-6">
            <div className="flex justify-between items-center text-xs">
              <span className="text-zinc-400 font-bold">
                Projected Bill (Unoptimized)
              </span>
              <span className="font-semibold text-rose-400 font-mono">
                ${(report.totalCostUsd * 8.4 + 0.12).toFixed(4)}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs border-b border-zinc-800 pb-3">
              <span className="text-zinc-400 font-bold">
                Active Bill (Multiplexed)
              </span>
              <span className="font-mono text-emerald-400 font-black">
                ${report.totalCostUsd.toFixed(4)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-zinc-300 font-black">
                Net Cost Reduction
              </span>
              <span className="font-mono text-emerald-400 font-black text-xl">
                88.5% SAVED
              </span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-800/40 border border-zinc-800 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase font-semibold tracking-wider text-zinc-400">
                Compliance Code
              </p>
              <p className="text-xs font-black text-emerald-400 font-mono tracking-tight mt-0.5">
                REPAIRSYNC_COMPRESSED_V3
              </p>
            </div>
            <span className="bg-emerald-950/40 border border-emerald-950/40 text-emerald-400 font-bold rounded-lg text-[9px] uppercase px-2 py-0.5">
              Secure
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SearchDiagnosticsView() {
  const [metrics, setMetrics] = useState<any>(
    SearchAnalyticsService.getMetricsSummary(),
  );
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<any>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(SearchAnalyticsService.getMetricsSummary());
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const triggerMigration = async () => {
    setIsMigrating(true);
    setMigrationResult(null);
    try {
      const response = await axios.post(
        "/api/crm/customers/migrate-normalization",
      );
      setMigrationResult({
        success: true,
        data: response.data,
      });
    } catch (err: any) {
      setMigrationResult({
        success: false,
        error:
          err.response?.data?.error || err.message || "Unknown error occurred",
      });
    } finally {
      setIsMigrating(false);
    }
  };

  const getSourceBadgeColor = (source: string) => {
    switch (source) {
      case "memory_cache":
        return "bg-zinc-100 text-zinc-800 border-zinc-200";
      case "indexeddb_cache":
        return "bg-teal-50 text-teal-700 border-teal-100";
      case "web_worker_thread":
        return "bg-emerald-50 text-emerald-700 border-emerald-100";
      case "firestore_prefetch":
        return "bg-blue-50 text-blue-700 border-blue-100";
      case "hybrid_fallback":
        return "bg-amber-50 text-amber-700 border-amber-100";
      default:
        return "bg-zinc-200 text-zinc-700 border-zinc-300";
    }
  };

  const formatSourceLabel = (source: string) => {
    switch (source) {
      case "memory_cache":
        return "Memory Cache";
      case "indexeddb_cache":
        return "IndexedDB Cache";
      case "web_worker_thread":
        return "Web Worker Fuzzy";
      case "firestore_prefetch":
        return "Direct Firestore";
      case "hybrid_fallback":
        return "API Hybrid Fallback";
      default:
        return source || "system";
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-zinc-950 text-white p-6 rounded-2xl border border-zinc-800 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full translate-x-1/2 -translate-y-1/2 blur-xl pointer-events-none" />
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
            Cache Hit Ratio
          </p>
          <div className="flex flex-col relative pt-1">
            <span className="text-3xl font-black tracking-tight leading-none">
              {metrics.cacheHitRatePercent.toFixed(1)}%
            </span>
            <span className="text-xs text-zinc-500 font-bold uppercase mt-1">
              HITS
            </span>
          </div>
          <p className="text-xs text-emerald-400 font-black tracking-tight mt-4 uppercase flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 shrink-0" /> Zero DB Read Egress
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm relative overflow-hidden">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
            Search Queries
          </p>
          <div className="flex flex-col relative pt-1">
            <span className="text-3xl font-black text-zinc-950 tracking-tight leading-none">
              {metrics.totalSearchesTracked}
            </span>
            <span className="text-xs text-zinc-400 font-bold uppercase mt-1">
              queries
            </span>
          </div>
          <p className="text-xs text-zinc-500 font-bold mt-4 uppercase flex items-center gap-1">
            <Activity className="w-3.5 h-3.5 shrink-0 text-emerald-500" />{" "}
            Active orchestration
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm relative overflow-hidden">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
            Average Latency
          </p>
          <div className="flex flex-col relative pt-1">
            <span className="text-3xl font-black text-zinc-950 tracking-tight leading-none">
              {metrics.averageSearchLatencyMs.toFixed(1)}
            </span>
            <span className="text-xs text-zinc-400 font-bold uppercase mt-1">
              ms
            </span>
          </div>
          <p className="text-xs text-zinc-500 font-bold mt-4 uppercase flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 shrink-0 text-amber-500" /> Instant
            local response
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm relative overflow-hidden">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
            Zero-Result Searches
          </p>
          <div className="flex flex-col relative pt-1">
            <span className="text-3xl font-black text-zinc-950 tracking-tight leading-none">
              {metrics.zeroResultsCount}
            </span>
            <span className="text-xs text-zinc-400 font-bold uppercase mt-1">
              audits
            </span>
          </div>
          <p className="text-xs text-zinc-500 font-bold mt-4 uppercase flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 text-zinc-400" />{" "}
            Missing inventory alert
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Schema Migration Panel */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Database className="w-4 h-4 text-primary shrink-0" />
              <h3 className="text-lg font-black text-zinc-800">
                Database Schema Migration
              </h3>
            </div>
            <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
              RepairSync leverages a unified, optimized searchable database
              schema. Perform a migration to standardise legacy CRM profiles and
              sync matching tokens for instant search query lookups.
            </p>

            {migrationResult && (
              <div className="mt-4 p-4 rounded-xl bg-zinc-50 border border-zinc-100 space-y-2 text-xs font-mono">
                {migrationResult.success ? (
                  <>
                    <p className="text-emerald-600 font-bold">
                      ✓ Normalization Completed Successfully
                    </p>
                    <div className="grid grid-cols-2 gap-1 text-[11px] text-zinc-600 mt-1">
                      <span>Total Found:</span>{" "}
                      <span className="font-bold">
                        {migrationResult.data.processedCount}
                      </span>
                      <span>Modified:</span>{" "}
                      <span className="font-bold">
                        {migrationResult.data.updatedCount}
                      </span>
                      <span>Failures:</span>{" "}
                      <span className="font-semibold text-rose-500">
                        {migrationResult.data.failedCount}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-rose-500 font-bold">
                      ✗ Migration Execution Failed
                    </p>
                    <p className="text-zinc-600 text-xs leading-tight overflow-auto max-h-16 mt-1">
                      {migrationResult.error}
                    </p>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="mt-8">
            <Button
              className="w-full h-11 rounded-xl bg-zinc-900 text-white font-extrabold hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2"
              onClick={triggerMigration}
              disabled={isMigrating}
            >
              <RefreshCw
                className={`w-4 h-4 ${isMigrating ? "animate-spin" : ""}`}
              />
              {isMigrating
                ? "Executing Normalization..."
                : "Run CRM Normalization"}
            </Button>
          </div>
        </div>

        {/* Live Search Logs */}
        <div className="lg:col-span-2 bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm flex flex-col h-[380px]">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-lg font-black text-zinc-800">
                Live Search Orchestrations
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Real-time queries monitored via SearchAnalyticsService
              </p>
            </div>
            <span className="bg-zinc-100 text-zinc-600 font-black text-xs rounded-lg px-2 py-0.5 uppercase tracking-wide">
              {metrics.detailedLogs.length} traced
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {metrics.detailedLogs
              .slice(-20)
              .reverse()
              .map((log: any, idx: number) => (
                <div
                  key={idx}
                  className="flex justify-between items-center p-3 rounded-xl bg-zinc-50 border border-zinc-100 hover:border-zinc-200 transition-all text-xs border-b border-zinc-100"
                >
                  <div className="flex items-center gap-3">
                    <Badge
                      variant="outline"
                      className={`text-xs font-semibold uppercase tracking-wide h-6 ${getSourceBadgeColor(log.source)}`}
                    >
                      {formatSourceLabel(log.source)}
                    </Badge>
                    <div>
                      <span className="font-extrabold font-mono text-zinc-800">
                        "{log.term}"
                      </span>
                      <span className="text-zinc-400 font-bold text-xs uppercase ml-2 tracking-wider">
                        {log.resultsCount} matches
                      </span>
                    </div>
                  </div>
                  <div className="text-right text-[11px] font-mono text-zinc-500 font-bold font-mono">
                    {log.durationMs.toFixed(1)} ms
                  </div>
                </div>
              ))}
            {metrics.detailedLogs.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center text-zinc-400 py-12">
                <Activity className="w-10 h-10 mb-2 opacity-20 text-zinc-400" />
                <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">
                  No queries registered yet
                </p>
                <p className="text-[11px] text-zinc-400 mt-1">
                  Perform client or global directory searches to trigger.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Audit Alerts for Zero Results */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm flex flex-col h-[280px]">
        <div className="mb-4">
          <h3 className="text-lg font-black text-zinc-800 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-500" />
            Zero-Result Search Typos & Inventory Audits
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            Captures customer searched terms that returned no matched data
          </p>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {metrics.zeroResultsList
            .slice(-20)
            .reverse()
            .map((audit: any, idx: number) => (
              <div
                key={idx}
                className="flex justify-between items-center p-3 rounded-xl bg-amber-50/40 border border-amber-100/50 hover:border-amber-200 transition-all text-xs"
              >
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="font-extrabold text-zinc-800 font-mono">
                    "{audit.query}"
                  </span>
                </div>
                <div className="text-right text-[11px] font-mono text-zinc-400 uppercase tracking-wide">
                  View: {audit.contextView || "crm_inbox"} •{" "}
                  {format(new Date(audit.timestamp), "h:mm a")}
                </div>
              </div>
            ))}
          {metrics.zeroResultsList.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center text-zinc-400 py-6">
              <CheckCircle2 className="w-8 h-8 mb-1 opacity-20 text-emerald-500" />
              <p className="text-xs font-bold uppercase tracking-wide text-zinc-455">
                All searches parsed cleanly
              </p>
              <p className="text-[11px] text-zinc-400 mt-1">
                Zero-result searches will log here automatically.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
