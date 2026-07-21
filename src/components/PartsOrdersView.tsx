import React, { useState, useMemo } from "react";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { toast } from "sonner";
import {
  Package,
  Plus,
  Search,
  Loader2,
  Wrench,
  X,
  Trash2,
  CheckCircle2,
  Clock,
  Truck,
  ShieldAlert,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { motion, AnimatePresence } from "motion/react";
import { format } from "date-fns";

// Define the interface here or import it if you extracted to types.ts
export interface PartsOrder {
  id: string;
  partName: string;
  description?: string;
  status: "needs_ordering" | "ordered" | "received" | "cancelled";
  supplier?: string;
  cost?: number;
  trackingNumber?: string;
  ticketId?: string;
  ticketNumber?: string;
  customerId?: string;
  customerName?: string;
  uid: string;
  createdAt: any;
}

interface PartsOrdersViewProps {
  orders: PartsOrder[];
  currentUserUid: string;
  tickets?: any[];
}

export const PartsOrdersView: React.FC<PartsOrdersViewProps> = ({
  orders,
  currentUserUid,
  tickets = [],
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | PartsOrder["status"]
  >("all");
  const [isAddPartOpen, setIsAddPartOpen] = useState(false);

  const [isCreating, setIsCreating] = useState(false);
  const [draft, setDraft] = useState<Partial<PartsOrder>>({
    partName: "",
    description: "",
    supplier: "",
    cost: 0,
    status: "needs_ordering",
    trackingNumber: "",
  });

  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);
  const [selectedTicketNumber, setSelectedTicketNumber] = useState<string>("all");

  const filteredOrders = useMemo(() => {
    let result = [...orders];

    if (statusFilter !== "all") {
      result = result.filter((o) => o.status === statusFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (o) =>
          o.partName.toLowerCase().includes(q) ||
          o.supplier?.toLowerCase().includes(q) ||
          String(o.ticketNumber || "").toLowerCase().includes(q),
      );
    }

    return result.sort((a, b) => {
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
      return dateB.getTime() - dateA.getTime();
    });
  }, [orders, statusFilter, searchQuery]);

  const deviceGroups = useMemo(() => {
    const groupsMap: { [key: string]: { id: string; ticketNumber?: string; deviceName: string; customerName?: string; orders: PartsOrder[] } } = {};
    
    filteredOrders.forEach((order) => {
      const key = order.ticketNumber || "unlinked";
      if (!groupsMap[key]) {
        const ticket = tickets.find((t) => t.number === order.ticketNumber);
        const deviceName = ticket 
          ? `${ticket.brand || ""} ${ticket.device_model || ""}`.trim() || `Job #${order.ticketNumber}`
          : order.ticketNumber 
            ? `Job #${order.ticketNumber}` 
            : "General / Unlinked";
            
        groupsMap[key] = {
          id: key,
          ticketNumber: order.ticketNumber,
          deviceName,
          customerName: order.customerName || ticket?.customer_name,
          orders: [],
        };
      }
      groupsMap[key].orders.push(order);
    });
    
    return Object.values(groupsMap);
  }, [filteredOrders, tickets]);

  const displayedOrders = useMemo(() => {
    if (selectedTicketNumber === "all") return filteredOrders;
    if (selectedTicketNumber === "unlinked") return filteredOrders.filter(o => !o.ticketNumber);
    return filteredOrders.filter(o => o.ticketNumber === selectedTicketNumber);
  }, [filteredOrders, selectedTicketNumber]);

  const handleCreate = async () => {
    if (!draft.partName?.trim() || !currentUserUid) return;
    setIsCreating(true);
    try {
      let finalTicketId = draft.ticketId;
      if (draft.ticketNumber && !finalTicketId) {
        const found = tickets.find((t) => t.number === draft.ticketNumber);
        if (found) finalTicketId = found.id;
      }

      await addDoc(collection(db, "parts_orders"), {
        ...draft,
        ticketId: finalTicketId || null,
        uid: currentUserUid,
        createdAt: serverTimestamp(),
      });
      toast.success("Parts order created");
      setDraft({
        partName: "",
        description: "",
        supplier: "",
        cost: 0,
        status: "needs_ordering",
        trackingNumber: "",
        ticketNumber: "",
        ticketId: "",
      });
      setIsAddPartOpen(false);
    } catch (e) {
      console.error(e);
      toast.error("Failed to create order");
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdateStatus = async (
    id: string,
    newStatus: PartsOrder["status"],
  ) => {
    try {
      await updateDoc(doc(db, "parts_orders", id), { status: newStatus });
      toast.success(`Marked as ${newStatus}`);
    } catch (e) {
      console.error(e);
      toast.error("Failed to update status");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, "parts_orders", id));
      toast.success("Order deleted");
      setOrderToDelete(null);
    } catch (e) {
      console.error(e);
      toast.error("Failed to delete order");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "received":
        return "bg-green-500 text-white";
      case "ordered":
        return "bg-blue-500 text-white";
      case "cancelled":
        return "bg-red-50 text-red-600 border border-red-200";
      default:
        return "bg-amber-500 text-white"; // needs_ordering
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "received":
        return <CheckCircle2 className="w-4 h-4" />;
      case "ordered":
        return <Truck className="w-4 h-4" />;
      case "cancelled":
        return <X className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "received":
        return "Received";
      case "ordered":
        return "Ordered";
      case "cancelled":
        return "Cancelled";
      default:
        return "Needs Ordering";
    }
  };

  const getBadgeStatusColor = (ordersList: PartsOrder[]) => {
    if (!ordersList || ordersList.length === 0) {
      return "bg-zinc-100 text-zinc-500 border-zinc-200";
    }
    if (ordersList.some((o) => o.status === "needs_ordering")) {
      return "bg-amber-100 text-amber-800 border-amber-200/60";
    }
    if (ordersList.some((o) => o.status === "ordered")) {
      return "bg-blue-100 text-blue-800 border-blue-200/60";
    }
    if (ordersList.some((o) => o.status === "received")) {
      return "bg-emerald-100 text-emerald-800 border-emerald-200/60";
    }
    if (ordersList.some((o) => o.status === "cancelled")) {
      return "bg-rose-100 text-rose-800 border-rose-200/60";
    }
    return "bg-zinc-100 text-zinc-700 border-zinc-200";
  };

  return (
    <section className="flex-1 flex flex-col glass-panel min-h-0 overflow-y-auto ">
      <div className="px-4 md:px-8 py-4 md:py-5 border-b border-zinc-200 shrink-0 bg-white">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-zinc-900 flex items-center gap-2">
              <Package className="w-5 h-5 md:w-6 md:h-6 text-zinc-800" />
              Parts Orders
            </h1>
            <p className="text-zinc-500 text-sm mt-1">
              Manage ad-hoc parts and track order statuses.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => setIsAddPartOpen(true)}
              className="bg-zinc-900 hover:bg-zinc-850 text-white h-7.5 text-[11px] font-bold rounded-full px-3 flex items-center gap-1 shadow-sm shrink-0"
            >
              <Plus className="w-3 h-3" /> Add Part
            </Button>
            <Select
              value={statusFilter}
              onValueChange={(v: any) => setStatusFilter(v)}
            >
              <SelectTrigger className="w-[115px] h-7.5 bg-zinc-100 hover:bg-zinc-150 border-none rounded-full text-[11px] font-semibold px-2.5">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Orders</SelectItem>
                <SelectItem value="needs_ordering">Wait Order</SelectItem>
                <SelectItem value="ordered">Ordered</SelectItem>
                <SelectItem value="received">Received</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative w-36">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-400 font-bold" />
              <Input
                placeholder="Search..."
                className="pl-7 w-full h-7.5 bg-zinc-100 border-none rounded-full text-[11px] font-medium focus-visible:ring-zinc-200"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 min-w-0 overflow-hidden flex flex-col md:flex-row max-w-6xl mx-auto w-full divide-y md:divide-y-0 md:divide-x divide-zinc-200">
        {/* Left Column: Device and Job Navigation */}
        <div className="w-full md:w-64 bg-zinc-50/50 p-4 shrink-0 overflow-y-auto  hidden md:block max-h-[calc(100vh-140px)]">
          <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-3 px-1.5">
            Devices & Jobs
          </h3>
          <div className="space-y-1">
            <button
              onClick={() => setSelectedTicketNumber("all")}
              className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-colors flex items-center justify-between group ${
                selectedTicketNumber === "all"
                  ? "bg-white text-zinc-950 font-bold shadow-sm border border-zinc-200"
                  : "text-zinc-600 hover:bg-zinc-100/80"
              }`}
            >
              <span className="truncate">All Devices</span>
              <Badge
                variant="outline"
                className={`px-1.5 py-0 text-xs font-medium border group-hover:bg-opacity-80 transition-colors ${getBadgeStatusColor(filteredOrders)}`}
              >
                {filteredOrders.length}
              </Badge>
            </button>
            {deviceGroups.map((group) => (
              <button
                key={group.id}
                onClick={() => setSelectedTicketNumber(group.ticketNumber || "unlinked")}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-all flex flex-col gap-0.5 border ${
                  selectedTicketNumber === (group.ticketNumber || "unlinked")
                    ? "bg-white text-zinc-950 font-bold border-zinc-200 shadow-sm"
                    : "text-zinc-600 hover:bg-zinc-100/80 border-transparent"
                }`}
              >
                <div className="flex justify-between items-center w-full">
                  <span className="truncate font-semibold text-zinc-800">{group.deviceName}</span>
                  <Badge
                    variant="outline"
                    className={`px-1.5 py-0 text-xs font-medium border ml-1 ${getBadgeStatusColor(group.orders)}`}
                  >
                    {group.orders.length}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs text-zinc-400 font-normal">
                  <span className="font-mono">{group.ticketNumber ? `#${group.ticketNumber}` : "Unlinked"}</span>
                  {group.customerName && <span className="max-w-[100px] truncate scrollbar-none">{group.customerName}</span>}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Mobile horizontal scrolling devices select */}
        <div className="w-full p-2 bg-zinc-50 border-b border-zinc-200 block md:hidden overflow-x-auto whitespace-nowrap  shrink-0">
          <div className="flex gap-1.5 px-2">
            <button
              onClick={() => setSelectedTicketNumber("all")}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all shadow-sm border flex items-center gap-1.5 ${
                selectedTicketNumber === "all"
                  ? "bg-white text-zinc-950 border-zinc-200 font-bold"
                  : "bg-transparent text-zinc-600 border-transparent hover:bg-zinc-100"
              }`}
            >
              <span>All Devices</span>
              <span className={`px-1.5 py-0.5 text-xs rounded-full border font-bold ${getBadgeStatusColor(filteredOrders)}`}>
                {filteredOrders.length}
              </span>
            </button>
            {deviceGroups.map((group) => (
              <button
                key={group.id}
                onClick={() => setSelectedTicketNumber(group.ticketNumber || "unlinked")}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all shadow-sm border flex items-center gap-1.5 ${
                  selectedTicketNumber === (group.ticketNumber || "unlinked")
                    ? "bg-white text-zinc-950 border-zinc-200 font-bold"
                    : "bg-transparent text-zinc-600 border-transparent hover:bg-zinc-100"
                }`}
              >
                <span className="truncate max-w-[120px]">{group.deviceName}</span>
                <span className={`px-1.5 py-0.5 text-xs rounded-full border font-bold ${getBadgeStatusColor(group.orders)}`}>
                  {group.orders.length}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Right Column: Mini Cards list */}
        <div className="flex-1 overflow-y-auto  p-4 md:p-6 bg-zinc-50/20">
          <div className="space-y-3">
            {displayedOrders.length === 0 ? (
              <div className="text-center py-20 px-6 opacity-90">
                <Package className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
                <h3 className="text-base font-bold text-foreground mb-1">
                  No Parts Found
                </h3>
                <p className="text-xs text-muted-foreground">
                  No orders match this selection.
                </p>
              </div>
            ) : (
              <div className="grid gap-3">
                <AnimatePresence>
                  {displayedOrders.map((order) => (
                    <motion.div
                      key={order.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                    >
                       <Card className="p-3 border border-zinc-200/80 hover:border-zinc-350 bg-white hover:shadow-sm transition-all duration-150 rounded-xl shadow-none">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 items-center w-full">
                          
                          {/* Column 1: Device & Job */}
                          <div className="md:col-span-4 flex items-center gap-3">
                            <div className={`p-2 rounded-lg shrink-0 ${getStatusColor(order.status).replace("text-white", "bg-opacity-10")} ${getStatusColor(order.status).split(" ")[0].replace("bg-", "text-")} flex items-center justify-center`}>
                              {getStatusIcon(order.status)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-mono text-[9px] font-bold text-zinc-900 bg-zinc-100 rounded px-1.5 py-0.5 shrink-0">
                                  {order.ticketNumber ? `Job #${order.ticketNumber}` : "General"}
                                </span>
                                {order.customerName && (
                                  <span className="text-xs text-zinc-500 font-medium truncate max-w-[80px]" title={order.customerName}>
                                    {order.customerName}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs font-semibold text-zinc-700 truncate mt-1">
                                {(() => {
                                  const ticket = tickets.find((t) => t.number === order.ticketNumber);
                                  return ticket 
                                    ? `${ticket.brand || ""} ${ticket.device_model || ""}`.trim() || `Job #${order.ticketNumber}`
                                    : "General Stock / Unlinked";
                                })()}
                              </p>
                            </div>
                          </div>

                          {/* Column 2: Part Details */}
                          <div className="md:col-span-5 min-w-0">
                            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                              <h4 className="font-bold text-xs text-zinc-900 truncate max-w-[150px]" title={order.partName}>
                                {order.partName}
                              </h4>
                              <span className={`text-[8px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md ${getStatusColor(order.status)}`}>
                                {getStatusText(order.status)}
                              </span>
                            </div>
                            
                            <div className="flex flex-wrap items-center gap-x-2 text-xs text-zinc-400 font-medium font-sans">
                              {order.supplier && (
                                <span className="flex items-center gap-1 text-zinc-600 bg-zinc-100/50 border border-zinc-200/50 px-1 py-0.2 rounded">
                                  Sup: <span className="font-bold text-zinc-700">{order.supplier}</span>
                                </span>
                              )}
                              {order.trackingNumber && (
                                <span className="flex items-center gap-0.5 text-blue-600 bg-blue-50/50 border border-blue-150 px-1 py-0.2 rounded font-semibold truncate max-w-[120px]" title={order.trackingNumber}>
                                  Track: {order.trackingNumber}
                                </span>
                              )}
                              {order.createdAt && (
                                <span className="text-[9px] text-zinc-400 font-normal">
                                  {format(order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt), "MMM d, h:mm a")}
                                </span>
                              )}
                            </div>

                            {order.description && (
                              <p className="text-xs mt-1 text-zinc-500 font-medium bg-zinc-50/50 border border-zinc-150/55 p-1.5 rounded truncate max-w-full" title={order.description}>
                                {order.description}
                              </p>
                            )}
                          </div>

                          {/* Column 3: Costs, Status update & Delete actions */}
                          <div className="md:col-span-3 flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center gap-2 border-t md:border-t-0 pt-2 md:pt-0 border-zinc-100">
                            {order.cost !== undefined && order.cost > 0 && (
                              <span className="text-xs font-extrabold text-zinc-800 font-mono">
                                Cost: ${Number(order.cost).toFixed(2)}
                              </span>
                            )}
                            
                            <div className="flex items-center gap-1.5 w-full md:w-auto">
                              <Select
                                value={order.status || ""}
                                onValueChange={(v: any) => handleUpdateStatus(order.id, v)}
                              >
                                <SelectTrigger className="w-full md:w-[110px] h-7 text-xs font-medium bg-zinc-100 hover:bg-zinc-150 border-zinc-250 rounded-md">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="needs_ordering">Wait Order</SelectItem>
                                  <SelectItem value="ordered">Ordered</SelectItem>
                                  <SelectItem value="received">Received</SelectItem>
                                  <SelectItem value="cancelled">Cancelled</SelectItem>
                                </SelectContent>
                              </Select>

                              <Button
                                size="xs"
                                variant="ghost"
                                onClick={() => setOrderToDelete(order.id)}
                                className="text-zinc-400 hover:text-rose-600 hover:bg-rose-50 h-7 w-7 p-0 rounded-md shadow-none flex items-center justify-center border border-transparent hover:border-rose-100/30"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>

                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={isAddPartOpen} onOpenChange={setIsAddPartOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" />
              Quick Add Part
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-[0.7rem] font-bold text-zinc-500 uppercase tracking-wide px-1">
                Part Name *
              </label>
              <Input
                placeholder="e.g. iPhone Screen"
                value={draft.partName}
                onChange={(e) =>
                  setDraft({ ...draft, partName: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <label className="text-[0.7rem] font-bold text-zinc-500 uppercase tracking-wide px-1">
                Supplier
              </label>
              <Input
                placeholder="e.g. Mobistars"
                value={draft.supplier}
                onChange={(e) =>
                  setDraft({ ...draft, supplier: e.target.value })
                }
              />
            </div>
            <div className="flex gap-3">
              <div className="space-y-2 flex-1">
                <label className="text-[0.7rem] font-bold text-zinc-500 uppercase tracking-wide px-1">
                  Cost
                </label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={draft.cost || ""}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      cost: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div className="space-y-2 flex-1">
                <label className="text-[0.7rem] font-bold text-zinc-500 uppercase tracking-wide px-1">
                  Status
                </label>
                <Select
                  value={draft.status}
                  onValueChange={(v: any) => setDraft({ ...draft, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="needs_ordering">
                      Needs Ordering
                    </SelectItem>
                    <SelectItem value="ordered">Ordered</SelectItem>
                    <SelectItem value="received">Received</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[0.7rem] font-bold text-zinc-500 uppercase tracking-wide px-1">
                Link Ticket #
              </label>
              <Input
                placeholder="e.g. 12944"
                value={draft.ticketNumber || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  const found = tickets.find((t) => t.number === val);
                  setDraft({
                    ...draft,
                    ticketNumber: val,
                    ticketId: found ? found.id : undefined,
                  });
                }}
              />
              {draft.ticketNumber &&
                tickets.find((t) => t.number === draft.ticketNumber) && (
                  <p className="text-xs text-green-600 font-bold px-1 isolate">
                    ✓ Ticket Found
                  </p>
                )}
            </div>
            <div className="space-y-2">
              <label className="text-[0.7rem] font-bold text-zinc-500 uppercase tracking-wide px-1">
                Tracking Number
              </label>
              <Input
                placeholder="e.g. TBA..."
                value={draft.trackingNumber || ""}
                onChange={(e) =>
                  setDraft({ ...draft, trackingNumber: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <label className="text-[0.7rem] font-bold text-zinc-500 uppercase tracking-wide px-1">
                Notes
              </label>
              <Textarea
                placeholder="Additional instructions..."
                value={draft.description || ""}
                onChange={(e) =>
                  setDraft({ ...draft, description: e.target.value })
                }
                className="resize-none min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddPartOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!draft.partName?.trim() || isCreating}
            >
              {isCreating ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Add Part Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {orderToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <Card className="w-full max-w-sm p-6 space-y-6">
            <div className="flex items-center gap-3 text-red-500">
              <ShieldAlert className="w-8 h-8" />
              <h3 className="text-xl font-bold">Delete Order?</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              This action cannot be undone. Are you sure you want to delete this
              part order?
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="ghost" onClick={() => setOrderToDelete(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleDelete(orderToDelete)}
              >
                Delete
              </Button>
            </div>
          </Card>
        </div>
      )}
    </section>
  );
};
