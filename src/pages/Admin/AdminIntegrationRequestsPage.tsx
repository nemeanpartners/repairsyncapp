import React, { useEffect, useState } from "react";
import axios from "axios";
import { format } from "date-fns";
import { CheckCircle, Clock, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "../../providers/AuthProvider";

const STATUS_OPTIONS = ["pending", "reviewing", "completed", "declined"] as const;

export function AdminIntegrationRequestsPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const response = await axios.get("/api/admin/integration-requests", {
        headers: {
          "x-user-id": user?.uid,
          "x-user-role": "admin",
        },
      });
      setRequests(response.data.requests || []);
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to load integration requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) void fetchRequests();
  }, [user]);

  const updateStatus = async (id: string, status: string) => {
    try {
      setSavingId(id);
      await axios.post(
        `/api/admin/integration-requests/${id}/status`,
        { status },
        {
          headers: {
            "x-user-id": user?.uid,
            "x-user-role": "admin",
          },
        },
      );
      toast.success("Request updated");
      await fetchRequests();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to update request");
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center p-8 text-zinc-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading requests...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white p-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Integration and Support Requests</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Review customer integration requests, support follow-ups, and requested workflow connections.
          </p>
        </div>
        <Button variant="outline" onClick={fetchRequests}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4">
        {requests.map((request) => (
          <div key={request.id} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-bold text-zinc-900">{request.integrationName || "Support request"}</h2>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-bold uppercase text-zinc-600">
                    {request.requestType || "integration"}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${
                    request.status === "completed"
                      ? "bg-emerald-50 text-emerald-700"
                      : request.status === "declined"
                        ? "bg-rose-50 text-rose-700"
                        : "bg-amber-50 text-amber-700"
                  }`}>
                    {request.status || "pending"}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-600">{request.message}</p>
                <div className="mt-4 grid gap-1 text-xs text-zinc-500">
                  <span>Company: {request.companyName || request.companyId || "-"}</span>
                  <span>User: {request.email || request.userId || "-"}</span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {request.createdAt?.seconds
                      ? format(new Date(request.createdAt.seconds * 1000), "PPpp")
                      : "Timestamp pending"}
                  </span>
                </div>
              </div>
              <div className="flex min-w-[180px] flex-col gap-2">
                {STATUS_OPTIONS.map((status) => (
                  <Button
                    key={status}
                    variant={request.status === status ? "default" : "outline"}
                    size="sm"
                    disabled={savingId === request.id}
                    onClick={() => updateStatus(request.id, status)}
                    className="justify-start capitalize"
                  >
                    {request.status === status ? <CheckCircle className="mr-2 h-4 w-4" /> : null}
                    {status}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        ))}
        {requests.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-10 text-center text-sm text-zinc-500">
            No integration or support requests yet.
          </div>
        ) : null}
      </div>
    </div>
  );
}
