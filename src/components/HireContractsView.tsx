import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import {
  collection,
  query,
  onSnapshot,
  doc,
  addDoc as firestoreAddDoc,
  updateDoc as firestoreUpdateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  serverTimestamp,
  limit,
} from "firebase/firestore";
import {
  Calendar,
  Layers,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  StopCircle,
  Truck,
  User,
  Wrench,
  X,
} from "lucide-react";
import { useAuth } from "../providers/AuthProvider";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { ScrollArea } from "./ui/scroll-area";
import { Badge } from "./ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import axios from "axios";


async function addDoc(colRef: any, data: any) { return firestoreAddDoc(colRef, { ...data }); }
async function updateDoc(docRef: any, data: any) { return firestoreUpdateDoc(docRef, { ...data }); }

export const HireContractsView = () => {
  const [contracts, setContracts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isNewContractOpen, setIsNewContractOpen] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);

  // Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [billingFrequency, setBillingFrequency] = useState<"WEEKLY" | "FORTNIGHTLY" | "MONTHLY">("WEEKLY");
  const [rate, setRate] = useState("");
  const [nextBillingDate, setNextBillingDate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [equipmentDesc, setEquipmentDesc] = useState("");

  useEffect(() => {
    // Fetch all customers for dropdown
    const qCust = query(collection(db, "crm_customers"), limit(2000));
    getDocs(qCust).then((snap) => {
      setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }).catch(console.error);

    // Subscribe to hire contracts
    const qContracts = query(collection(db, "hire_contracts"), limit(1000));
    const unsub = onSnapshot(qContracts, async (snap) => {
      const contractsList: any[] = [];
      for (const contractDoc of snap.docs) {
        const data = contractDoc.data();
        let customerName = "Unknown Customer";
        
        if (data.customer_id) {
          try {
            const custSnap = await getDoc(doc(db, "crm_customers", data.customer_id));
            if (custSnap.exists()) {
              const cData = custSnap.data();
              customerName = cData.fullname || `${cData.firstname || ""} ${cData.lastname || ""}`.trim() || "Customer";
            }
          } catch (e) {
            console.error(e);
          }
        }
        contractsList.push({ id: contractDoc.id, customerName, ...data });
      }
      setContracts(contractsList);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    return unsub;
  }, []);

  const handleStatusChange = async (contractId: string, currentStatus: string, action: "PAUSE" | "RESUME" | "TERMINATE") => {
    try {
      const contractRef = doc(db, "hire_contracts", contractId);
      let newStatus: "ACTIVE" | "PAUSED" | "TERMINATED" = "ACTIVE";
      if (action === "PAUSE") newStatus = "PAUSED";
      if (action === "TERMINATE") newStatus = "TERMINATED";
      
      await updateDoc(contractRef, {
        status: newStatus,
        updated_at: serverTimestamp()
      });
      toast.success(`Hire agreement successfully ${newStatus.toLowerCase()}`);
    } catch (e: any) {
      toast.error("Failed to update schedule status", { description: e.message });
    }
  };

  const handleCreateContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) {
      toast.error("Please select a customer first.");
      return;
    }
    if (!rate || isNaN(Number(rate))) {
      toast.error("Please enter a valid rate.");
      return;
    }
    if (!nextBillingDate || !startDate) {
      toast.error("Start and billing dates are required.");
      return;
    }

    try {
      const docData = {
        customer_id: selectedCustomerId,
        status: "ACTIVE",
        billing_frequency: billingFrequency,
        rate_per_period: Number(rate),
        next_billing_date: nextBillingDate,
        start_date: startDate,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
        line_items: [
          {
            id: Math.random().toString(36).substring(7),
            description: equipmentDesc || "Equipment Hire Rate",
            quantity: 1,
            unit_amount: Number(rate),
            line_amount: Number(rate),
            tax_type: "OUTPUT",
            account_code: "200"
          }
        ]
      };

      await addDoc(collection(db, "hire_contracts"), docData);
      toast.success("Recurring Hire Agreement Created!", { description: `Billing starts on ${nextBillingDate}` });
      setIsNewContractOpen(false);
      
      // Reset
      setSelectedCustomerId("");
      setRate("");
      setEquipmentDesc("");
      setNextBillingDate("");
      setStartDate("");
    } catch (e: any) {
      toast.error("Failed to generate schedule", { description: e.message });
    }
  };

  const handleForceEvaluate = async () => {
    setIsEvaluating(true);
    try {
      await axios.post("/api/xero/sync/process");
      toast.success("Billing Evaluation Succeeded!", { description: "Active contracts were scanned and matched." });
    } catch (e: any) {
      toast.error("Billing evaluation request failed", { description: e.message });
    } finally {
      setIsEvaluating(false);
    }
  };

  const filteredContracts = contracts.filter(
    (c) =>
      c.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.billing_frequency?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.status?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 pt-2 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold tracking-tight text-zinc-900">Recurring Rental Agreement</h3>
          <p className="text-xs text-zinc-500">Automated invoice generation for equipment, tools, and recurring rentals</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
          <Button
            onClick={handleForceEvaluate}
            disabled={isEvaluating}
            variant="outline"
            size="sm"
            className="rounded-xl border-zinc-200 text-xs font-semibold h-9 flex items-center gap-1.5 hover:bg-zinc-50 shrink-0 bg-white"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isEvaluating ? 'animate-spin' : ''}`} />
            Evaluate Billing
          </Button>
          <Button
            onClick={() => setIsNewContractOpen(true)}
            size="sm"
            className="rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-bold h-9 flex items-center gap-1 text-xs shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            New Hire Schedule
          </Button>
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm space-y-4">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <Input
            placeholder="Search hire contracts by client name or billing frequency..."
            className="pl-10 h-11 rounded-xl bg-white border-zinc-200 focus-visible:ring-0 focus-visible:border-zinc-300 shadow-sm text-xs font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="space-y-3 pt-2">
          <div className="space-y-3">
            {filteredContracts.map((c) => (
              <div
                key={c.id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-white rounded-xl border border-zinc-150 shadow-sm hover:border-zinc-300 transition-all gap-4 group"
              >
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-zinc-800 text-sm truncate uppercase group-hover:text-primary transition-colors">{c.customerName}</span>
                    <Badge className={`uppercase text-[9px] font-black tracking-wider px-1.5 py-0 rounded-md border shadow-none shrink-0 ${
                      c.status === "ACTIVE"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : c.status === "PAUSED"
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-rose-50 text-rose-700 border-rose-200"
                    }`}>
                      {c.status}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500 font-medium pt-0.5">
                    <span className="flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      {c.line_items?.[0]?.description || "Contract Rent"}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1 font-mono uppercase font-bold text-zinc-700">
                      Freq: {c.billing_frequency}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      Next Bill: {c.next_billing_date}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-x-6 gap-y-2 pt-2 sm:pt-0 border-t border-zinc-100 sm:border-0 shrink-0">
                  <div className="text-left sm:text-right">
                    <div className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">Rate</div>
                    <div className="font-black text-base text-primary">${Number(c.rate_per_period).toFixed(2)}</div>
                  </div>

                  <div className="flex items-center gap-1.5 justify-end">
                    {c.status === "ACTIVE" ? (
                      <Button
                        onClick={() => handleStatusChange(c.id, c.status, "PAUSE")}
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0 rounded-lg hover:bg-zinc-100 border-zinc-200 text-zinc-650"
                        title="Pause schedule"
                      >
                        <Pause className="w-3.5 h-3.5" />
                      </Button>
                    ) : c.status === "PAUSED" ? (
                      <Button
                        onClick={() => handleStatusChange(c.id, c.status, "RESUME")}
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0 rounded-lg hover:bg-emerald-50 hover:text-emerald-700 border-zinc-200 text-emerald-600"
                        title="Resume Schedule"
                      >
                        <Play className="w-3.5 h-3.5" />
                      </Button>
                    ) : null}

                    {c.status !== "TERMINATED" && (
                      <Button
                        onClick={() => handleStatusChange(c.id, c.status, "TERMINATE")}
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0 rounded-lg hover:bg-rose-50 hover:text-rose-700 border-zinc-200 text-rose-500"
                        title="Terminate Agreement"
                      >
                        <StopCircle className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {filteredContracts.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center opacity-60">
                <Truck className="w-12 h-12 text-zinc-300 mb-3" />
                <p className="text-xs uppercase tracking-wide font-black text-zinc-500 mb-1">No Hire Schedules Matches</p>
                <p className="text-xs text-zinc-400">Add a schedule to automate repeating billing allocations easily.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New Schedule Modal Dialog */}
      <Dialog open={isNewContractOpen} onOpenChange={setIsNewContractOpen}>
        <DialogContent className="sm:max-w-[450px] bg-white rounded-2xl sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">New Hire Agreement</DialogTitle>
            <CardDescription>Setup an automated cron-evaluated rental or hire schedule</CardDescription>
          </DialogHeader>
          <form onSubmit={handleCreateContract} className="space-y-4 pt-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-zinc-600">Customer Client</Label>
              <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                <SelectTrigger className="bg-zinc-50 border-zinc-200 rounded-xl h-10 shadow-none font-semibold">
                  <SelectValue placeholder="Select a Customer" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.fullname || `${c.firstname || ""} ${c.lastname || ""}`.trim()} ({c.email || "No email"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-zinc-600">Billing Frequency</Label>
                <Select value={billingFrequency} onValueChange={(val: any) => setBillingFrequency(val)}>
                  <SelectTrigger className="bg-zinc-50 border-zinc-200 rounded-xl h-10 shadow-none font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="WEEKLY">Weekly</SelectItem>
                    <SelectItem value="FORTNIGHTLY">Fortnightly</SelectItem>
                    <SelectItem value="MONTHLY">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-zinc-600">Rate per Period ($)</Label>
                <Input
                  type="number"
                  placeholder="e.g. 150"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  className="bg-zinc-50 border-zinc-200 h-10 rounded-xl shadow-none"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-zinc-600">Start Date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-zinc-50 border-zinc-200 h-10 rounded-xl shadow-none"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-zinc-600">Next Billing Date</Label>
                <Input
                  type="date"
                  value={nextBillingDate}
                  onChange={(e) => setNextBillingDate(e.target.value)}
                  className="bg-zinc-50 border-zinc-200 h-10 rounded-xl shadow-none"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-zinc-600">Equipment / Description for Line Item</Label>
              <Input
                placeholder="e.g. iPad Pro Hire with Rugged Cover"
                value={equipmentDesc}
                onChange={(e) => setEquipmentDesc(e.target.value)}
                className="bg-zinc-50 border-zinc-200 h-11 rounded-xl shadow-none text-xs font-medium"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsNewContractOpen(false)}
                className="rounded-xl border-zinc-200 font-semibold"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 font-bold"
              >
                Create Schedule
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
