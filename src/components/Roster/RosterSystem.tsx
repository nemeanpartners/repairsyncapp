import React, { useState, useEffect } from "react";
import {
  format,
  startOfWeek,
  addDays,
  isSameDay,
  addWeeks,
  subWeeks,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
} from "date-fns";
import {
  Calendar as CalendarIcon,
  Plus,
  ChevronLeft,
  ChevronRight,
  User,
  Clock,
  Check,
  X,
  ArrowLeftRight,
  Coffee,
  Briefcase,
  AlertCircle,
  MoreVertical,
  Edit,
  Trash2,
  CheckCircle2,
  Loader2,
  CalendarDays,
  Search,
} from "lucide-react";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  getDocs,
} from "firebase/firestore";
import { db } from "../../firebase";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";

const ensureDate = (date: any) => {
  if (!date) return new Date();
  if (date.toDate) return date.toDate();
  if (date instanceof Date) return date;
  return new Date(date);
};

interface Shift {
  id: string;
  userId?: string;
  userName?: string;
  startTime: any;
  endTime: any;
  role: string;
  status: "draft" | "published" | "assigned" | "on_swap";
  isSwapRequested?: boolean;
  notes?: string;
}

interface Task {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "completed";
  uid: string;
}

interface LeaveRequest {
  id: string;
  userId: string;
  userName: string;
  startDate: any;
  endDate: any;
  type: "vacation" | "sick" | "personal" | "other";
  status: "pending" | "approved" | "rejected";
  reason?: string;
  adminNote?: string;
  createdAt: any;
}

interface RosterSystemProps {
  user: any;
  isAdmin: boolean;
}

export const RosterSystem: React.FC<RosterSystemProps> = ({
  user,
  isAdmin,
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskSort, setTaskSort] = useState<"dueDate" | "priority" | "status">(
    "dueDate",
  );
  const [taskSearchQuery, setTaskSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"roster" | "leave" | "tasks">(
    "roster",
  );

  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<Partial<Shift> | null>(null);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [newLeaveRequest, setNewLeaveRequest] = useState<Partial<LeaveRequest>>(
    {
      type: "vacation",
      userId: user?.uid,
      userName: user?.displayName || user?.email?.split("@")[0] || "User",
    },
  );

  const [staffList, setStaffList] = useState<{ id: string; name: string }[]>(
    [],
  );

  useEffect(() => {
    // Fetch users for admin dropdown
    if (isAdmin) {
      const fetchUsers = async () => {
        const usersSnap = await getDocs(collection(db, "users"));
        const users = usersSnap.docs.map((doc) => ({
          id: doc.id,
          name:
            doc.data().displayName || doc.data().name || doc.id.split("@")[0],
        }));
        setStaffList(users);
      };
      fetchUsers();
    }

    const shiftsQuery = query(
      collection(db, "shifts"),
      orderBy("startTime", "asc"),
    );
    const unsubscribeShifts = onSnapshot(
      shiftsQuery,
      (snapshot) => {
        setShifts(
          snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Shift),
        );
        setLoading(false);
      },
      (error) => {
        console.error("Shifts listener error:", error);
        setLoading(false);
      },
    );

    const leaveRequestsQuery = isAdmin
      ? query(collection(db, "leave_requests"), orderBy("createdAt", "desc"))
      : query(
          collection(db, "leave_requests"),
          where("userId", "==", user?.uid),
          orderBy("createdAt", "desc"),
        );

    const unsubscribeLeave = onSnapshot(
      leaveRequestsQuery,
      (snapshot) => {
        setLeaveRequests(
          snapshot.docs.map(
            (doc) => ({ id: doc.id, ...doc.data() }) as LeaveRequest,
          ),
        );
      },
      (error) => {
        console.error("Leave requests listener error:", error);
      },
    );

    const tasksQuery = query(
      collection(db, "tasks"),
      where("uid", "==", user.uid),
    );
    const unsubscribeTasks = onSnapshot(
      tasksQuery,
      (snapshot) => {
        setTasks(
          snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Task),
        );
      },
      (error) => {
        console.error("Tasks listener error:", error);
      },
    );

    return () => {
      unsubscribeShifts();
      unsubscribeLeave();
      unsubscribeTasks();
    };
  }, [isAdmin, user]);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = [...Array(7)].map((_, i) => addDays(weekStart, i));

  const sortedTasks = React.useMemo(() => {
    let result = [...tasks];

    if (taskSearchQuery.trim()) {
      const query = taskSearchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          (t.title || "").toLowerCase().includes(query) ||
          (t.description || "").toLowerCase().includes(query),
      );
    }

    return result.sort((a, b) => {
      const priorityWeight = { urgent: 4, high: 3, medium: 2, low: 1 };
      const aPriority =
        priorityWeight[a.priority as keyof typeof priorityWeight] || 0;
      const bPriority =
        priorityWeight[b.priority as keyof typeof priorityWeight] || 0;

      const aStatusVal = a.status === "completed" ? 1 : -1;
      const bStatusVal = b.status === "completed" ? 1 : -1;

      const aDate = new Date(a.dueDate).getTime();
      const bDate = new Date(b.dueDate).getTime();

      if (taskSort === "dueDate") {
        if (aStatusVal !== bStatusVal) return aStatusVal - bStatusVal;
        if (aDate !== bDate) return aDate - bDate;
        return bPriority - aPriority;
      }
      if (taskSort === "priority") {
        if (aStatusVal !== bStatusVal) return aStatusVal - bStatusVal;
        if (bPriority !== aPriority) return bPriority - aPriority;
        return aDate - bDate;
      }
      if (taskSort === "status") {
        if (aStatusVal !== bStatusVal) return aStatusVal - bStatusVal;
        if (bPriority !== aPriority) return bPriority - aPriority;
        return aDate - bDate;
      }
      return 0;
    });
  }, [tasks, taskSort, taskSearchQuery]);

  const handlePrevWeek = () => setCurrentDate(subWeeks(currentDate, 1));
  const handleNextWeek = () => setCurrentDate(addWeeks(currentDate, 1));
  const handleToday = () => setCurrentDate(new Date());

  const handleSaveShift = async () => {
    if (
      !editingShift?.startTime ||
      !editingShift?.endTime ||
      !editingShift?.role
    ) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      if (editingShift.id) {
        await updateDoc(doc(db, "shifts", editingShift.id), {
          ...editingShift,
          updatedAt: serverTimestamp(),
        });
        toast.success("Shift updated");
      } else {
        await addDoc(collection(db, "shifts"), {
          ...editingShift,
          status: "published",
          createdAt: serverTimestamp(),
        });
        toast.success("Shift created");
      }
      setIsShiftModalOpen(false);
      setEditingShift(null);
    } catch (error) {
      console.error(error);
      toast.error("Failed to save shift");
    }
  };

  const handleSaveLeaveRequest = async () => {
    if (!newLeaveRequest.startDate || !newLeaveRequest.endDate) {
      toast.error("Please select dates");
      return;
    }

    try {
      await addDoc(collection(db, "leave_requests"), {
        ...newLeaveRequest,
        status: "pending",
        createdAt: serverTimestamp(),
        userId: user.uid,
        userName: user.displayName || user.email.split("@")[0],
      });
      toast.success("Leave request submitted");
      setIsLeaveModalOpen(false);
    } catch (error) {
      toast.error("Failed to submit leave request");
    }
  };

  const handleApproveLeave = async (id: string) => {
    try {
      await updateDoc(doc(db, "leave_requests", id), { status: "approved" });
      toast.success("Leave request approved");
    } catch (error) {
      toast.error("Failed to update request");
    }
  };

  const handleRejectLeave = async (id: string) => {
    try {
      await updateDoc(doc(db, "leave_requests", id), { status: "rejected" });
      toast.success("Leave request rejected");
    } catch (error) {
      toast.error("Failed to update request");
    }
  };

  const handleAcceptShift = async (shift: Shift) => {
    try {
      await updateDoc(doc(db, "shifts", shift.id), {
        userId: user.uid,
        userName: user.displayName || user.email.split("@")[0],
        status: "assigned",
      });
      toast.success("Shift accepted");
    } catch (error) {
      toast.error("Failed to accept shift");
    }
  };

  const handleRequestSwap = async (shift: Shift) => {
    try {
      await updateDoc(doc(db, "shifts", shift.id), {
        isSwapRequested: true,
        status: "on_swap",
      });
      toast.success("Swap request posted");
    } catch (error) {
      toast.error("Failed to request swap");
    }
  };

  const handlePublishShift = async (id: string) => {
    await updateDoc(doc(db, "shifts", id), { status: "published" });
  };

  const handleDeleteShift = async (id: string) => {
    if (confirm("Delete this shift?")) {
      await deleteDoc(doc(db, "shifts", id));
      toast.success("Shift deleted");
    }
  };

  return (
    <div className="flex flex-col h-full bg-transparent overflow-hidden">
      {/* Header */}
      <div className="p-6 pb-2">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-3xl font-black tracking-tight flex items-center gap-2">
              <CalendarDays className="w-8 h-8 text-primary" />
              Staff Roster
            </h2>
            <p className="text-muted-foreground font-medium">
              Manage shifts and leave requests
            </p>
          </div>

          <div className="flex items-center gap-2 bg-secondary/30 p-1 rounded-2xl sm:rounded-2xl border border-white/40">
            <Button
              variant={activeTab === "roster" ? "default" : "ghost"}
              className={`rounded-xl px-6 ${activeTab === "roster" ? "shadow-sm" : ""}`}
              onClick={() => setActiveTab("roster")}
            >
              Calendar
            </Button>
            <Button
              variant={activeTab === "leave" ? "default" : "ghost"}
              className={`rounded-xl px-6 ${activeTab === "leave" ? "shadow-sm" : ""}`}
              onClick={() => setActiveTab("leave")}
            >
              Leave Requests
              {isAdmin &&
                leaveRequests.filter((r) => r.status === "pending").length >
                  0 && (
                  <Badge className="ml-2 bg-red-50 text-red-600 border border-red-200 border-none w-5 h-5 p-0 flex items-center justify-center rounded-full text-xs">
                    {leaveRequests.filter((r) => r.status === "pending").length}
                  </Badge>
                )}
            </Button>
            <Button
              variant={activeTab === "tasks" ? "default" : "ghost"}
              className={`rounded-xl px-6 ${activeTab === "tasks" ? "shadow-sm" : ""}`}
              onClick={() => setActiveTab("tasks")}
            >
              Tasks
            </Button>
          </div>
        </div>

        {activeTab === "tasks" && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white/40 p-3 rounded-2xl border border-white/60 shadow-sm backdrop-blur-md gap-3">
            <h3 className="text-lg font-bold px-4">Your Tasks</h3>
            <div className="flex items-center gap-2 sm:pr-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-none">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <Input
                  className="pl-9 h-10 w-full sm:w-48 lg:w-64 bg-white border-none rounded-xl text-sm focus-visible:ring-0 focus-visible:border-zinc-300"
                  placeholder="Search tasks..."
                  value={taskSearchQuery}
                  onChange={(e) => setTaskSearchQuery(e.target.value)}
                />
              </div>
              <select
                className="h-10 bg-white border-none rounded-xl px-3 text-sm focus:outline-none focus:ring-0 focus:border-zinc-300 text-zinc-600 font-medium cursor-pointer"
                value={taskSort}
                onChange={(e) => setTaskSort(e.target.value as any)}
              >
                <option value="dueDate">Sort by Date</option>
                <option value="priority">Sort by Priority</option>
                <option value="status">Sort by Status</option>
              </select>
            </div>
          </div>
        )}

        {activeTab === "roster" && (
          <div className="flex items-center justify-between bg-white/40 p-3 rounded-2xl border border-white/60 shadow-sm backdrop-blur-md">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full hover:bg-white"
                onClick={handlePrevWeek}
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <h3 className="text-lg font-bold min-w-[150px] text-center">
                {format(weekStart, "MMM d")} -{" "}
                {format(weekDays[6], "MMM d, yyyy")}
              </h3>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full hover:bg-white"
                onClick={handleNextWeek}
              >
                <ChevronRight className="w-5 h-5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full px-4 ml-2 border-zinc-200"
                onClick={handleToday}
              >
                Today
              </Button>
            </div>

            {isAdmin && (
              <Button
                onClick={() => {
                  setEditingShift({
                    startTime: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
                    endTime: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
                    role: "Technician",
                    status: "published",
                  });
                  setIsShiftModalOpen(true);
                }}
                className="rounded-full bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 px-6"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Shift
              </Button>
            )}
          </div>
        )}

        {activeTab === "leave" && (
          <div className="flex items-center justify-between bg-white/40 p-3 rounded-2xl border border-white/60 shadow-sm backdrop-blur-md">
            <h3 className="text-lg font-bold px-4">Leave Overview</h3>
            <Button
              onClick={() => setIsLeaveModalOpen(true)}
              className="rounded-full bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 px-6"
            >
              <Plus className="w-4 h-4 mr-2" />
              Request Leave
            </Button>
          </div>
        )}
      </div>

      {/* Main Area */}
      <div className="flex-1 overflow-y-auto p-6 pt-2 ">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
          </div>
        ) : (
          <>
            {activeTab === "roster" && (
              <div className="grid grid-cols-1 md:grid-cols-7 gap-4 min-h-[600px]">
                {weekDays.map((day, dIdx) => {
                  const dayShifts = shifts.filter((s) =>
                    isSameDay(ensureDate(s.startTime), day),
                  );
                  const isToday = isSameDay(day, new Date());

                  return (
                    <div
                      key={dIdx}
                      className={`flex flex-col gap-3 p-4 rounded-2xl border transition-all ${isToday ? "bg-primary/5 border-primary/20 ring-1 ring-primary/10" : "bg-white/40 border-white/60"}`}
                    >
                      <div className="flex flex-col items-center mb-2">
                        <span
                          className={`text-xs font-semibold uppercase tracking-wide ${isToday ? "text-primary" : "text-muted-foreground"}`}
                        >
                          {format(day, "EEE")}
                        </span>
                        <span
                          className={`text-2xl font-black ${isToday ? "text-primary" : ""}`}
                        >
                          {format(day, "d")}
                        </span>
                      </div>

                      <div className="flex-1 flex flex-col gap-3">
                        {dayShifts.length === 0 ? (
                          <div className="flex-1 flex flex-center items-center justify-center opacity-20 py-8">
                            <Briefcase className="w-8 h-8" />
                          </div>
                        ) : (
                          dayShifts.map((shift) => (
                            <motion.div
                              layoutId={shift.id}
                              key={shift.id}
                              className={`p-3 rounded-2xl sm:rounded-2xl border transition-all relative group ${
                                shift.userId
                                  ? "bg-white border-zinc-100 shadow-sm"
                                  : "bg-emerald-50 border-emerald-100"
                              }`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <Badge
                                  variant="outline"
                                  className="text-[9px] font-semibold uppercase tracking-tight py-0 px-2 h-5 border-zinc-200"
                                >
                                  {shift.role}
                                </Badge>
                                {isAdmin && (
                                  <div className="flex items-center gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="w-6 h-6 h-6 rounded-lg text-muted-foreground hover:text-primary"
                                      onClick={() => {
                                        const start = format(
                                          ensureDate(shift.startTime),
                                          "yyyy-MM-dd'T'HH:mm",
                                        );
                                        const end = format(
                                          ensureDate(shift.endTime),
                                          "yyyy-MM-dd'T'HH:mm",
                                        );
                                        setEditingShift({
                                          ...shift,
                                          startTime: start,
                                          endTime: end,
                                        });
                                        setIsShiftModalOpen(true);
                                      }}
                                    >
                                      <Edit className="w-3 h-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="w-6 h-6 h-6 rounded-lg text-muted-foreground hover:text-red-500"
                                      onClick={() =>
                                        handleDeleteShift(shift.id)
                                      }
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </div>
                                )}
                              </div>

                              <div className="space-y-1.5">
                                <p className="text-xs font-medium text-zinc-500 flex items-center gap-1.5">
                                  <Clock className="w-3 h-3" />
                                  {format(
                                    ensureDate(shift.startTime),
                                    "h:mm a",
                                  )}{" "}
                                  -{" "}
                                  {format(ensureDate(shift.endTime), "h:mm a")}
                                </p>

                                <div className="flex items-center gap-2 pt-1 border-t border-zinc-50 mt-1">
                                  <div
                                    className={`w-6 h-6 rounded-lg flex items-center justify-center ${shift.userId ? "bg-zinc-100" : "bg-emerald-100"}`}
                                  >
                                    <User
                                      className={`w-3.5 h-3.5 ${shift.userId ? "text-zinc-600" : "text-emerald-600"}`}
                                    />
                                  </div>
                                  <span className="text-[11px] font-bold truncate">
                                    {shift.userName || "Unassigned"}
                                  </span>
                                </div>
                              </div>

                              {/* Actions */}
                              <div className="mt-3 pt-3 border-t border-zinc-100 flex flex-col gap-1.5">
                                {!shift.userId && (
                                  <Button
                                    size="sm"
                                    className="w-full h-8 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold h-8"
                                    onClick={() => handleAcceptShift(shift)}
                                  >
                                    CLAIM SHIFT
                                  </Button>
                                )}

                                {shift.userId === user.uid &&
                                  !shift.isSwapRequested && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="w-full h-8 rounded-xl text-xs font-semibold border-zinc-200 h-8"
                                      onClick={() => handleRequestSwap(shift)}
                                    >
                                      REQUEST SWAP
                                    </Button>
                                  )}

                                {shift.isSwapRequested &&
                                  shift.userId !== user.uid && (
                                    <Button
                                      size="sm"
                                      className="w-full h-8 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold h-8"
                                      onClick={() => handleAcceptShift(shift)}
                                    >
                                      PICK UP SWAP
                                    </Button>
                                  )}

                                {shift.isSwapRequested && (
                                  <Badge className="bg-orange-100 text-orange-700 border-none justify-center py-1 mt-1 text-[8px] font-semibold uppercase">
                                    <ArrowLeftRight className="w-2.5 h-2.5 mr-1" />
                                    Swap Requested
                                  </Badge>
                                )}
                              </div>
                            </motion.div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {activeTab === "leave" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-1">
                    My Requests
                  </h4>
                  {leaveRequests.filter((r) => r.userId === user.uid).length ===
                  0 ? (
                    <div className="p-12 text-center bg-white/20 rounded-2xl border border-dashed border-white/40">
                      <p className="text-sm text-muted-foreground font-medium">
                        No leave requests found
                      </p>
                    </div>
                  ) : (
                    leaveRequests
                      .filter((r) => r.userId === user.uid)
                      .map((req) => (
                        <Card
                          key={req.id}
                          className="p-5 rounded-2xl border-white/60 bg-white/40 shadow-sm hover:shadow-md transition-all"
                        >
                          <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-10 h-10 rounded-2xl sm:rounded-2xl flex items-center justify-center ${
                                  req.type === "vacation"
                                    ? "bg-sky-100 text-sky-600"
                                    : req.type === "sick"
                                      ? "bg-red-100 text-red-600"
                                      : "bg-orange-100 text-orange-600"
                                }`}
                              >
                                <Coffee className="w-5 h-5" />
                              </div>
                              <div>
                                <h5 className="font-bold text-sm capitalize">
                                  {req.type} Leave
                                </h5>
                                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">
                                  {format(ensureDate(req.startDate), "MMM d")} -{" "}
                                  {format(
                                    ensureDate(req.endDate),
                                    "MMM d, yyyy",
                                  )}
                                </p>
                              </div>
                            </div>
                            <Badge
                              className={`rounded-full px-3 h-6 text-xs font-semibold uppercase border-none ${
                                req.status === "approved"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : req.status === "rejected"
                                    ? "bg-red-100 text-red-700"
                                    : "bg-zinc-100 text-zinc-600"
                              }`}
                            >
                              {req.status}
                            </Badge>
                          </div>
                          {req.reason && (
                            <p className="text-xs text-zinc-600 bg-white/60 p-3 rounded-xl border border-white/40 mb-3">
                              {req.reason}
                            </p>
                          )}
                          {req.adminNote && (
                            <div className="flex items-start gap-2 text-xs font-medium text-primary mt-2 p-3 bg-primary/5 rounded-xl border border-primary/10">
                              <AlertCircle className="w-4 h-4 shrink-0" />
                              <span>{req.adminNote}</span>
                            </div>
                          )}
                        </Card>
                      ))
                  )}
                </div>

                {isAdmin && (
                  <div className="space-y-4">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-1">
                      All Staff Requests (Admin)
                    </h4>
                    {leaveRequests.filter((r) => r.userId !== user.uid)
                      .length === 0 ? (
                      <div className="p-12 text-center bg-white/20 rounded-2xl border border-dashed border-white/40">
                        <p className="text-sm text-muted-foreground font-medium">
                          No other requests to display
                        </p>
                      </div>
                    ) : (
                      leaveRequests
                        .filter((r) => r.userId !== user.uid)
                        .map((req) => (
                          <Card
                            key={req.id}
                            className={`p-5 rounded-2xl border-white/60 bg-white shadow-sm transition-all ${req.status === "pending" ? "ring-2 ring-primary ring-offset-2" : ""}`}
                          >
                            <div className="flex justify-between items-start mb-4">
                              <div className="flex items-center gap-3">
                                <Avatar className="w-10 h-10 border-white shadow-sm ring-2 ring-zinc-50">
                                  <AvatarFallback className="bg-zinc-100 text-zinc-500 font-bold text-xs">
                                    {req.userName[0].toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <h5 className="font-bold text-sm">
                                    {req.userName}
                                  </h5>
                                  <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">
                                    {req.type} •{" "}
                                    {format(ensureDate(req.startDate), "MMM d")}{" "}
                                    - {format(ensureDate(req.endDate), "MMM d")}
                                  </p>
                                </div>
                              </div>
                              <Badge
                                className={`rounded-full px-3 h-6 text-xs font-semibold uppercase border-none ${
                                  req.status === "approved"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : req.status === "rejected"
                                      ? "bg-red-100 text-red-700"
                                      : "bg-zinc-100 text-zinc-600"
                                }`}
                              >
                                {req.status}
                              </Badge>
                            </div>

                            {req.reason && (
                              <p className="text-xs text-zinc-600 bg-zinc-50 p-3 rounded-xl mb-4 border border-zinc-100">
                                {req.reason}
                              </p>
                            )}

                            {req.status === "pending" && (
                              <div className="flex gap-2">
                                <Button
                                  className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10"
                                  onClick={() => handleApproveLeave(req.id)}
                                >
                                  <Check className="w-4 h-4 mr-2" /> Approve
                                </Button>
                                <Button
                                  variant="outline"
                                  className="flex-1 rounded-xl border-red-100 text-red-600 hover:bg-red-50 font-bold h-10"
                                  onClick={() => handleRejectLeave(req.id)}
                                >
                                  <X className="w-4 h-4 mr-2" /> Reject
                                </Button>
                              </div>
                            )}
                          </Card>
                        ))
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === "tasks" && (
              <div className="grid gap-4">
                {sortedTasks.length === 0 ? (
                  <div className="p-12 text-center bg-white/20 rounded-2xl border border-dashed border-white/40">
                    <p className="text-sm text-muted-foreground font-medium">
                      No tasks found
                    </p>
                  </div>
                ) : (
                  sortedTasks.map((task) => (
                    <Card
                      key={task.id}
                      className={`rounded-2xl sm:rounded-2xl border-border/30 shadow-sm transition-all ${task.status === "completed" ? "opacity-60 bg-secondary/30/50" : "bg-white/40"}`}
                    >
                      <div className="p-6 flex items-start gap-4">
                        <motion.button
                          whileTap={{ scale: 0.9 }}
                          onClick={async () => {
                            try {
                              const newStatus =
                                task.status === "completed"
                                  ? "open"
                                  : "completed";
                              await updateDoc(doc(db, "tasks", task.id), {
                                status: newStatus,
                              });
                            } catch (e) {
                              console.error("Error updating task status:", e);
                            }
                          }}
                          className={`mt-1 shrink-0 w-6 h-6 rounded-2xl sm:rounded-2xl border flex items-center justify-center transition-colors ${
                            task.status === "completed"
                              ? "bg-green-500 border-green-500 text-white"
                              : "border-zinc-300 hover:border-blue-500 text-transparent hover:text-blue-200"
                          }`}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </motion.button>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4 mb-1">
                            <h4
                              className={`text-base font-semibold truncate ${task.status === "completed" ? "line-through text-zinc-500" : "text-zinc-900"}`}
                            >
                              {task.title}
                            </h4>
                            <div className="flex items-center gap-2 shrink-0">
                              <select
                                className={`px-2 py-0.5 text-xs uppercase font-bold tracking-wider rounded-2xl sm:rounded-2xl border-none outline-none cursor-pointer  ${
                                  task.priority === "urgent"
                                    ? "bg-red-100 text-red-700"
                                    : task.priority === "high"
                                      ? "bg-orange-100 text-orange-700"
                                      : task.priority === "medium"
                                        ? "bg-blue-100 text-blue-700"
                                        : "bg-zinc-100 text-zinc-600"
                                }`}
                                value={task.priority}
                                onChange={async (e) => {
                                  try {
                                    await updateDoc(doc(db, "tasks", task.id), {
                                      priority: e.target.value,
                                    });
                                  } catch (error) {
                                    console.error(
                                      "Error updating task priority:",
                                      error,
                                    );
                                  }
                                }}
                              >
                                <option
                                  value="urgent"
                                  className="bg-white text-red-700"
                                >
                                  URGENT
                                </option>
                                <option
                                  value="high"
                                  className="bg-white text-orange-700"
                                >
                                  HIGH
                                </option>
                                <option
                                  value="medium"
                                  className="bg-white text-blue-700"
                                >
                                  MEDIUM
                                </option>
                                <option
                                  value="low"
                                  className="bg-white text-zinc-600"
                                >
                                  LOW
                                </option>
                              </select>
                            </div>
                          </div>

                          {task.description && (
                            <p className="text-sm text-zinc-600 mb-3 line-clamp-2">
                              {task.description}
                            </p>
                          )}

                          <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-zinc-500">
                            {task.dueDate && (
                              <div
                                className={`flex items-center gap-1.5 ${
                                  task.status !== "completed" &&
                                  new Date(task.dueDate) < new Date()
                                    ? "text-red-500 font-bold"
                                    : ""
                                }`}
                              >
                                <CalendarIcon className="w-3.5 h-3.5" />
                                {format(new Date(task.dueDate), "MMM d, yyyy")}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      <Dialog open={isShiftModalOpen} onOpenChange={setIsShiftModalOpen}>
        <DialogContent className="rounded-2xl p-8 border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black tracking-tight">
              {editingShift?.id ? "Edit Shift" : "Create New Shift"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground ml-1">
                  Start Time
                </label>
                <Input
                  type="datetime-local"
                  className="rounded-2xl sm:rounded-2xl h-12 bg-zinc-50 border-zinc-100"
                  value={editingShift?.startTime || ""}
                  onChange={(e) =>
                    setEditingShift({
                      ...editingShift,
                      startTime: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground ml-1">
                  End Time
                </label>
                <Input
                  type="datetime-local"
                  className="rounded-2xl sm:rounded-2xl h-12 bg-zinc-50 border-zinc-100"
                  value={editingShift?.endTime || ""}
                  onChange={(e) =>
                    setEditingShift({
                      ...editingShift,
                      endTime: e.target.value,
                    })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground ml-1">
                Role / Position
              </label>
              <Select
                value={editingShift?.role || ""}
                onValueChange={(v) =>
                  setEditingShift({ ...editingShift, role: v })
                }
              >
                <SelectTrigger className="rounded-2xl sm:rounded-2xl h-12 bg-zinc-50 border-zinc-100 font-bold">
                  <SelectValue placeholder="Select Role" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl sm:rounded-2xl border-zinc-100">
                  <SelectItem value="Technician">Technician</SelectItem>
                  <SelectItem value="Admin">Admin / Front Desk</SelectItem>
                  <SelectItem value="Manager">Store Manager</SelectItem>
                  <SelectItem value="Trainer">Trainer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground ml-1">
                Assign To (Optional)
              </label>
              <Select
                value={editingShift?.userId || "none"}
                onValueChange={(v) => {
                  if (v === "none") {
                    setEditingShift({
                      ...editingShift,
                      userId: "",
                      userName: "",
                      status: "published",
                    });
                  } else {
                    const staff = staffList.find((s) => s.id === v);
                    setEditingShift({
                      ...editingShift,
                      userId: v,
                      userName: staff?.name,
                      status: "assigned",
                    });
                  }
                }}
              >
                <SelectTrigger className="rounded-2xl sm:rounded-2xl h-12 bg-zinc-50 border-zinc-100 font-bold">
                  <SelectValue placeholder="Select Staff" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl sm:rounded-2xl border-zinc-100">
                  <SelectItem value="none">Unassigned / Open Shift</SelectItem>
                  {staffList.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground ml-1">
                Shift Notes
              </label>
              <textarea
                className="w-full rounded-2xl sm:rounded-2xl p-4 bg-zinc-50 border border-zinc-100 focus:outline-none focus:ring-0 focus:border-zinc-300 text-sm font-medium resize-none h-24"
                placeholder="e.g. Lunch cover, priority repair stack..."
                value={editingShift?.notes || ""}
                onChange={(e) =>
                  setEditingShift({ ...editingShift, notes: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="ghost"
              onClick={() => setIsShiftModalOpen(false)}
              className="rounded-2xl sm:rounded-2xl h-12 px-8 font-bold"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveShift}
              className="rounded-2xl sm:rounded-2xl h-12 px-8 font-semibold uppercase tracking-wide bg-primary hover:bg-primary/90 text-white shadow-xl shadow-primary/20"
            >
              {editingShift?.id ? "Update Shift" : "Create Shift"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isLeaveModalOpen} onOpenChange={setIsLeaveModalOpen}>
        <DialogContent className="rounded-2xl p-8 border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black tracking-tight">
              Request Time Off
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground ml-1">
                  Start Date
                </label>
                <Input
                  type="date"
                  className="rounded-2xl sm:rounded-2xl h-12 bg-zinc-50 border-zinc-100"
                  value={newLeaveRequest.startDate || ""}
                  onChange={(e) =>
                    setNewLeaveRequest({
                      ...newLeaveRequest,
                      startDate: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground ml-1">
                  End Date
                </label>
                <Input
                  type="date"
                  className="rounded-2xl sm:rounded-2xl h-12 bg-zinc-50 border-zinc-100"
                  value={newLeaveRequest.endDate || ""}
                  onChange={(e) =>
                    setNewLeaveRequest({
                      ...newLeaveRequest,
                      endDate: e.target.value,
                    })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground ml-1">
                Leave Type
              </label>
              <Select
                value={newLeaveRequest.type || "vacation"}
                onValueChange={(v) =>
                  setNewLeaveRequest({ ...newLeaveRequest, type: v as any })
                }
              >
                <SelectTrigger className="rounded-2xl sm:rounded-2xl h-12 bg-zinc-50 border-zinc-100 font-bold">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl sm:rounded-2xl border-zinc-100">
                  <SelectItem value="vacation">
                    Vacation / Annual Leave
                  </SelectItem>
                  <SelectItem value="sick">Sick Leave</SelectItem>
                  <SelectItem value="personal">Personal / Carers</SelectItem>
                  <SelectItem value="other">Other / Compassionate</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground ml-1">
                Reason (Optional)
              </label>
              <textarea
                className="w-full rounded-2xl sm:rounded-2xl p-4 bg-zinc-50 border border-zinc-100 focus:outline-none focus:ring-0 focus:border-zinc-300 text-sm font-medium resize-none h-24"
                placeholder="Brief explanation for your request..."
                value={newLeaveRequest.reason || ""}
                onChange={(e) =>
                  setNewLeaveRequest({
                    ...newLeaveRequest,
                    reason: e.target.value,
                  })
                }
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="ghost"
              onClick={() => setIsLeaveModalOpen(false)}
              className="rounded-2xl sm:rounded-2xl h-12 px-8 font-bold"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveLeaveRequest}
              className="rounded-2xl sm:rounded-2xl h-12 px-8 font-semibold uppercase tracking-wide bg-primary hover:bg-primary/90 text-white shadow-xl shadow-primary/20"
            >
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
