import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../../providers/AuthProvider';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { CheckCircle, XCircle } from 'lucide-react';

export function AdminDeletionRequestsPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  
  const fetchRequests = async () => {
    try {
      const res = await axios.get('/api/admin/account-deletion-requests', {
        headers: {
          'x-user-id': user?.uid,
          'x-user-role': 'admin' // In real app, the backend verifies
        }
      });
      setRequests(res.data.requests);
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Failed to load requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchRequests();
    }
  }, [user]);

  const handleApprove = async (id: string) => {
    try {
      if (!window.confirm("Are you sure you want to approve this deletion? This action may be irreversible.")) return;
      await axios.post(`/api/admin/account-deletion-requests/${id}/approve`, { adminNotes: 'Approved by admin UI' }, {
        headers: {
          'x-user-id': user?.uid,
          'x-user-role': 'admin'
        }
      });
      toast.success("Request approved");
      fetchRequests();
    } catch (e: any) {
       toast.error(e.response?.data?.error || "Failed to approve");
    }
  };

  const handleReject = async (id: string) => {
    try {
      if (!window.confirm("Are you sure you want to reject this request?")) return;
      await axios.post(`/api/admin/account-deletion-requests/${id}/reject`, { adminNotes: 'Rejected by admin UI' }, {
        headers: {
          'x-user-id': user?.uid,
          'x-user-role': 'admin'
        }
      });
      toast.success("Request rejected");
      fetchRequests();
    } catch (e: any) {
       toast.error(e.response?.data?.error || "Failed to reject");
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-zinc-200">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Account Deletion Requests</h1>
          <p className="text-sm text-zinc-500">Manage user requested account deletions. Approval anonymizes the user account.</p>
        </div>
      </div>
      
      <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-zinc-50 text-xs font-semibold uppercase text-zinc-500 border-b border-zinc-200">
            <tr>
              <th className="px-6 py-4">User Email</th>
              <th className="px-6 py-4">Reason</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Requested At</th>
              <th className="px-6 py-4">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {requests.map(req => (
              <tr key={req.id}>
                <td className="px-6 py-4 3">{req.email}</td>
                <td className="px-6 py-4 max-w-sm truncate text-zinc-600">{req.reason || '-'}</td>
                <td className="px-6 py-4 font-semibold uppercase text-xs">
                  <span className={`px-2 py-1 rounded ${req.status === 'pending' ? 'bg-amber-100 text-amber-800' : req.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                    {req.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-zinc-500">
                  {req.requestedAt ? format(new Date(req.requestedAt.seconds * 1000), "PPpp") : "-"}
                </td>
                <td className="px-6 py-4">
                  {req.status === 'pending' && (
                    <div className="flex gap-2">
                      <button onClick={() => handleApprove(req.id)} className="p-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg" title="Approve">
                         <CheckCircle className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleReject(req.id)} className="p-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg" title="Reject">
                         <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {requests.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-zinc-500">No requests found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
