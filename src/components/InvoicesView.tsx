import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import {
  FileText,
  Search,
  Layers,
} from "lucide-react";
import { db } from "../firebase";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  getDoc,
  doc,
} from "firebase/firestore";
import {
  format,
} from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HireContractsView } from "./HireContractsView";

export const InvoicesView = ({ onNavigate, onOpenTicket }: { onNavigate?: (view: string) => void, onOpenTicket?: (custId?: string, tickId?: string) => void }) => {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch all invoices
  
  const getBadgeColor = (status: string | undefined, syncStatus?: string) => {
    const s = (status || "").toLowerCase();
    const sync = (syncStatus || "").toLowerCase();

    if (s === "overdue" || sync === "error" || s === "sync_error" || s === "error") {
      return "bg-red-100 text-red-700 hover:bg-red-200 border-red-200";
    }
    if (s === "paid") {
      return "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-emerald-200";
    }
    if (s === "partially_paid" || s === "partially paid" || s === "pending" || s === "local_draft" || s === "unpaid") {
      return "bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-200";
    }
    return "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 border-zinc-200";
  };

  useEffect(() => {
    const q = query(
      collection(db, "invoices"),
      orderBy("created_at", "desc"),
    );
    const unsub = onSnapshot(q, async (snap) => {
      const invs = [];
      for (const d of snap.docs) {
        const data = d.data();
        let customerName = "Unknown";
        if (data.customer_id) {
          try {
            const cSnap = await getDoc(
              doc(db, "crm_customers", data.customer_id),
            );
            if (cSnap.exists()) {
              customerName =
                cSnap.data().fullname ||
                `${cSnap.data().firstname || ""} ${cSnap.data().lastname || ""}`.trim() ||
                "Customer";
            }
          } catch (e) {}
        }
        invs.push({ id: d.id, ...data, customerName });
      }
      setInvoices(invs);
    }, (error) => {
      console.error("InvoicesView snapshot subscription error:", error);
    });
    return () => unsub();
  }, []);

  const filteredInvoices = invoices.filter(
    (inv) =>
      String(inv.id).toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(inv.invoice_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (inv.customerName &&
        inv.customerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (inv.ticket_id &&
        String(inv.ticket_id).toLowerCase().includes(searchTerm.toLowerCase())),
  );

  return (
    <div className="flex flex-col h-full w-full bg-zinc-50/50">
      <div className="px-4 md:px-8 py-4 md:py-6 border-b border-zinc-200 bg-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-zinc-900">Financials & Invoices</h1>
          <p className="text-zinc-500 text-sm mt-1">Manage your invoices and hire agreements</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 animate-in fade-in zoom-in-95 duration-500">
        <div className="max-w-6xl mx-auto w-full flex flex-col gap-6">
          <Tabs defaultValue="invoices" className="flex flex-col space-y-4">
            <TabsList className="bg-zinc-100 p-1 rounded-xl self-start flex gap-1 border border-zinc-200/50 max-w-full overflow-x-auto   ">
              <TabsTrigger value="invoices" className="rounded-lg px-4 py-2 text-xs font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-zinc-900 text-zinc-500 flex items-center gap-2 transition-all whitespace-nowrap">
                <FileText className="w-4 h-4 shrink-0" />
                Direct Invoices
              </TabsTrigger>
              <TabsTrigger value="rentals" className="rounded-lg px-4 py-2 text-xs font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-zinc-900 text-zinc-500 flex items-center gap-2 transition-all whitespace-nowrap">
                <Layers className="w-4 h-4 shrink-0" />
                Hire Agreements
              </TabsTrigger>
            </TabsList>
            <TabsContent value="invoices" className="flex flex-col mt-0 focus-visible:ring-0">
              <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm flex flex-col space-y-4">
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by customer name, invoice ID..."
                    className="pl-9 h-12 rounded-xl bg-white border-border/30 focus-visible:ring-0 focus-visible:border-zinc-300 shadow-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Button 
                  onClick={() => window.dispatchEvent(new CustomEvent('open-new-invoice'))}
                  className="h-12 rounded-xl px-6 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  <span className="font-bold">New Invoice</span>
                </Button>
              </div>
              <div className="space-y-3">
                <div className="space-y-3">
                  {filteredInvoices.map((inv) => (
                    <div
                      key={inv.id}
                      className="flex items-center justify-between p-3 bg-white rounded-xl shadow-sm border border-border/50 hover:border-primary/30 hover:shadow-md transition-all cursor-pointer group"
                      onClick={() => onNavigate ? onNavigate(`invoice/${inv.id}`) : navigate(`/invoice/${inv.id}`)}
                    >
                      <div className="flex flex-col">
                        <span className="font-bold text-sm text-zinc-800 group-hover:text-primary transition-colors">
                          {inv.customerName}
                        </span>
                        <div className="flex items-center gap-2 text-xs font-medium text-zinc-500 mt-0.5">
                          <span className="uppercase tracking-wide">
                            Inv: {inv.invoice_number ? inv.invoice_number.replace(/\D/g, '') : inv.id.substring(0, 8)}
                          </span>
                          <span>•</span>
                          <span className="uppercase tracking-wide">
                            Date:{" "}
                            {inv.created_at?.toDate
                              ? format(inv.created_at.toDate(), "PP")
                              : "N/A"}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right flex flex-col justify-center">
                          <div className="font-black text-base text-zinc-900">
                            ${Number(inv.total).toFixed(2)}
                          </div>
                          <Badge
                            className={`uppercase text-[9px] font-bold tracking-wide mt-0.5 border-none shadow-none px-1.5 py-0 ${getBadgeColor(inv.status, inv.sync_status)}`}
                          >
                            {inv.sync_status === 'error' || inv.sync_status === 'SYNC_ERROR' || inv.status === 'sync_error' ? 'SYNC ERROR' : (inv.status?.toUpperCase() || "UNPAID")}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                  {filteredInvoices.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <FileText className="w-12 h-12 text-zinc-200 mb-4" />
                      <p className="text-sm font-bold text-muted-foreground uppercase tracking-wide">
                        No invoices found
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>
          <TabsContent value="rentals" className="flex flex-col mt-0 focus-visible:ring-0">
            <HireContractsView />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  </div>
  );
};
