import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FileText,
  Search,
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

export const InvoicesModal = ({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) => {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch all invoices
  useEffect(() => {
    if (!isOpen) return;
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
      console.error("InvoicesModal snapshot subscription error:", error);
    });
    return () => unsub();
  }, [isOpen]);

  const filteredInvoices = invoices.filter(
    (inv) =>
      String(inv.id).toLowerCase().includes(searchTerm.toLowerCase()) ||
      (inv.customerName &&
        inv.customerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (inv.ticket_id &&
        String(inv.ticket_id).toLowerCase().includes(searchTerm.toLowerCase())),
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0 overflow-hidden rounded-2xl border-none shadow-xl">
        <DialogHeader className="p-6 pb-0 shrink-0">
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" />
            Financials & Invoices
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col p-6 pt-4">
            <div className="flex-1 min-h-0 min-w-0 flex flex-col space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by customer name, invoice ID..."
                    className="pl-9 h-12 rounded-xl bg-zinc-50 border-border/30 focus-visible:ring-0 focus-visible:border-zinc-300"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <ScrollArea className="flex-1 h-[400px] rounded-xl border border-border/30 bg-zinc-50/50">
                  <div className="p-4 space-y-3">
                    {filteredInvoices.map((inv) => (
                      <div
                        key={inv.id}
                        className="flex items-center justify-between p-4 bg-white rounded-xl shadow-sm border border-border/50 hover:border-primary/30 transition-colors"
                      >
                        <div className="flex flex-col">
                          <span className="font-bold text-lg text-zinc-800">
                            {inv.customerName}
                          </span>
                          <div className="flex items-center gap-2 text-xs font-medium text-zinc-500 mt-1">
                            <span className="uppercase tracking-wider">
                              Inv: {inv.invoice_number ? inv.invoice_number.replace(/\D/g, '') : inv.id.substring(0, 8)}
                            </span>
                            <span>•</span>
                            <span>
                              Date:{" "}
                              {inv.created_at?.toDate
                                ? format(inv.created_at.toDate(), "PP")
                                : "N/A"}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="font-black text-xl text-foreground">
                              ${Number(inv.total).toFixed(2)}
                            </div>
                            <Badge
                              className={`uppercase text-xs font-medium tracking-wide mt-1 ${inv.status === "paid" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}
                            >
                              {inv.status?.toUpperCase() || "UNPAID"}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                    {filteredInvoices.length === 0 && (
                      <div className="text-center py-10">
                        <p className="text-sm font-bold text-muted-foreground uppercase tracking-wide">
                          No invoices found
                        </p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
