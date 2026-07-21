import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Link as LinkIcon, 
  CheckCircle2, 
  RefreshCw, 
  Trash2, 
  Play, 
  AlertCircle, 
  Clock, 
  Loader2, 
  Coins, 
  FileText, 
  User, 
  ChevronRight,
  Database,
  HelpCircle
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { useSettings } from '../../../providers/SettingsProvider';
import { db } from '../../../firebase';
import { collection, query, onSnapshot, limit, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

function XeroSyncQueueMonitor() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [isProcessingLocal, setIsProcessingLocal] = useState(false);
  const [expandedErrorId, setExpandedErrorId] = useState<string | null>(null);

  useEffect(() => {
    // Read the queue in real-time. Limiting to 50 for safety and speed.
    // We sort in-memory desc by created_at to avoid requiring a compound Firestore index.
    const q = query(collection(db, 'xero_sync_queue'), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const dbJobs = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      
      // Sort in-memory descending by created_at
      dbJobs.sort((a: any, b: any) => {
        const timeA = a.created_at?.seconds || a.created_at?.toMillis?.() || (a.created_at instanceof Date ? a.created_at.getTime() : 0);
        const timeB = b.created_at?.seconds || b.created_at?.toMillis?.() || (b.created_at instanceof Date ? b.created_at.getTime() : 0);
        return timeB - timeA;
      });
      setJobs(dbJobs);
    }, (error) => {
      console.error("Firestore listener error on sync queue:", error);
    });

    return () => unsubscribe();
  }, []);

  const handleManualProcess = async () => {
    try {
      setIsProcessingLocal(true);
      const res = await axios.post('/api/xero/sync/process');
      if (res.data?.success) {
        toast.success("Sync process ran", { description: "The server-side XeroSyncEngine finished running outstanding jobs." });
      } else {
        toast.error("Failed to run sync queue");
      }
    } catch (e: any) {
      console.error(e);
      toast.error("Process failed", { description: e.response?.data?.error || e.message });
    } finally {
      setIsProcessingLocal(false);
    }
  };

  const handleRetryJob = async (jobId: string) => {
    try {
      const jobRef = doc(db, 'xero_sync_queue', jobId);
      await updateDoc(jobRef, {
        status: 'PENDING',
        attempts: 0,
        last_error: '',
        updated_at: serverTimestamp()
      });
      toast.success("Job re-queued successfully", { description: "Set back to PENDING." });
    } catch (e: any) {
      toast.error("Failed to re-queue job", { description: e.message });
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    if (!confirm("Are you sure you want to delete this sync log from the queue?")) return;
    try {
      await deleteDoc(doc(db, 'xero_sync_queue', jobId));
      toast.success("Sync job dismissed");
    } catch (e: any) {
      toast.error("Failed to delete sync job", { description: e.message });
    }
  };

  const getEntityIcon = (type: string) => {
    switch (type) {
      case 'CUSTOMER': return <User className="w-4 h-4 text-sky-500" />;
      case 'INVOICE': return <FileText className="w-4 h-4 text-blue-500" />;
      case 'PAYMENT': return <Coins className="w-4 h-4 text-emerald-500" />;
      default: return <Database className="w-4 h-4 text-zinc-500" />;
    }
  };

  const filteredJobs = jobs.filter(job => {
    if (filter === 'all') return true;
    return job.status?.toLowerCase() === filter.toLowerCase();
  });

  return (
    <div className="mt-4 border border-zinc-200 shadow-sm rounded-2xl bg-white overflow-hidden">
      <div className="flex flex-col sm:flex-row bg-zinc-50 border-b border-zinc-200/60 p-5 items-start sm:items-center justify-between gap-4">
        <div>
          <h4 className="font-bold text-zinc-900 flex items-center gap-2">
            <RefreshCw className={`w-4 h-4 text-blue-500 ${isProcessingLocal ? 'animate-spin' : ''}`} />
            Xero Sync Queue Monitor
          </h4>
          <p className="text-zinc-500 text-xs mt-0.5">Real-time sync process logs, queue diagnostic controls, and actions.</p>
        </div>
        
        <Button 
          onClick={handleManualProcess}
          disabled={isProcessingLocal}
          size="sm"
          className="rounded-xl bg-blue-600 hover:bg-blue-700 font-bold px-4 text-xs h-9 flex items-center gap-2 text-white shadow-none"
        >
          {isProcessingLocal ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              Process Queue Now
            </>
          )}
        </Button>
      </div>

      <div className="p-5">
        <div className="flex flex-wrap items-center gap-1.5 pb-4 border-b border-zinc-100 mb-4">
          {['all', 'pending', 'processing', 'completed', 'failed'].map((s) => {
            const count = s === 'all' ? jobs.length : jobs.filter(j => j.status?.toLowerCase() === s).length;
            const isActive = filter === s;
            return (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition ${
                  isActive 
                    ? 'bg-zinc-950 text-white shadow-sm' 
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200/70'
                }`}
              >
                {s} <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs font-medium ${isActive ? 'bg-zinc-800 text-zinc-200' : 'bg-zinc-200 text-zinc-500'}`}>{count}</span>
              </button>
            );
          })}
        </div>

        {filteredJobs.length === 0 ? (
          <div className="py-12 text-center text-zinc-400 text-xs flex flex-col items-center justify-center gap-2">
            <Clock className="w-8 h-8 text-zinc-300 stroke-[1.5]" />
            <p className="font-medium text-zinc-500">No matching synchronization logs in queue</p>
            <p className="text-[11px] text-zinc-400">Updates will populate here as invoices or customer records are generated.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-zinc-100 text-zinc-400 font-semibold">
                  <th className="pb-3 w-1/4">Entity Description</th>
                  <th className="pb-3 w-1/4">Reference ID</th>
                  <th className="pb-3 w-1/8 text-center">Attempts</th>
                  <th className="pb-3 w-1/6">Sync Status</th>
                  <th className="pb-3 w-1/6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {filteredJobs.map((job) => {
                  const hasError = job.last_error && job.last_error.length > 0;
                  const isExpanded = expandedErrorId === job.id;
                  
                  return (
                    <React.Fragment key={job.id}>
                      <tr className="hover:bg-zinc-50/40 transition">
                        <td className="py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-zinc-50 flex items-center justify-center border border-zinc-200/50">
                              {getEntityIcon(job.entity_type)}
                            </div>
                            <div>
                              <div className="font-bold text-zinc-800 flex items-center gap-1.5 uppercase tracking-wide text-[10.5px]">
                                {job.entity_type}
                                <span className="text-[9px] font-semibold text-zinc-400 normal-case">({job.operation || 'CREATE'})</span>
                              </div>
                              <div className="text-xs text-zinc-400 pt-0.5 flex items-center gap-1">
                                <Clock className="w-3 h-3 text-zinc-300" />
                                {job.created_at?.seconds 
                                  ? new Date(job.created_at.seconds * 1000).toLocaleString() 
                                  : 'Draft / Timestamp pending'
                                }
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 font-mono text-[11px] text-zinc-500 font-semibold max-w-[120px] truncate">
                          {job.entity_id}
                        </td>
                        <td className="py-3 text-center font-mono text-zinc-600 font-bold">
                          {job.attempts || 0}
                          <span className="text-zinc-300 font-normal">/7</span>
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-1.5">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium uppercase tracking-wider border ${
                              job.status === 'COMPLETED' 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                                : job.status === 'FAILED'
                                  ? 'bg-rose-50 text-rose-700 border-rose-100 cursor-pointer hover:bg-rose-100/50 flex items-center gap-1'
                                  : job.status === 'PROCESSING'
                                    ? 'bg-blue-50 text-blue-700 border-blue-100 flex items-center gap-1'
                                    : 'bg-amber-50 text-amber-700 border-amber-100'
                            }`}
                            onClick={() => job.status === 'FAILED' && setExpandedErrorId(isExpanded ? null : job.id)}
                            >
                              {job.status === 'PROCESSING' && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
                              {job.status || 'PENDING'}
                              {job.status === 'FAILED' && <span className="text-[9px] font-semibold lowercase underline">(view error)</span>}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {(job.status === 'FAILED' || job.status === 'COMPLETED') && (
                              <Button 
                                onClick={() => handleRetryJob(job.id)}
                                variant="outline"
                                size="icon"
                                className="w-8 h-8 rounded-xl border-zinc-200 hover:bg-zinc-50"
                                title="Re-queue and Retry Synchronization"
                              >
                                <RefreshCw className="w-3.5 h-3.5 text-zinc-600" />
                              </Button>
                            )}
                            <Button 
                              onClick={() => handleDeleteJob(job.id)}
                              variant="outline"
                              size="icon"
                              className="w-8 h-8 rounded-xl border-zinc-200 text-rose-500 hover:bg-rose-50 hover:border-rose-100"
                              title="Delete job from queue logs"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                      {hasError && isExpanded && (
                        <tr>
                          <td colSpan={5} className="pb-3 pt-1">
                            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-100/60 text-[11px] text-rose-800 font-mono flex items-start gap-2.5">
                              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                              <div className="w-full">
                                <span className="font-bold block text-xs text-rose-950 uppercase tracking-wider mb-1">Xero API Fault Logs:</span>
                                {job.last_error}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

import { TwilioSettingsForm } from "./TwilioSettingsForm";

export function IntegrationsSettings() {
  const [zohoStatus, setZohoStatus] = useState<"syncing" | "active" | "inactive">("syncing");
  const [xeroStatus, setXeroStatus] = useState<"syncing" | "active" | "inactive">("syncing");
  const { settings, updateSettings } = useSettings();
  
  const rcsEnabled = settings?.integrations?.rcsEnabled || false;

  const handleToggleRcs = async () => {
    try {
      await updateSettings('integrations', { rcsEnabled: !rcsEnabled });
      toast.success(`RCS Business Messaging ${!rcsEnabled ? 'enabled' : 'disabled'}`);
    } catch (e) {
      // Error handled by provider
    }
  };

  const refreshIntegrationStatus = async () => {
    try {
      const [zohoRes, xeroRes] = await Promise.all([
        axios.get("/api/zoho/status", { validateStatus: () => true }),
        axios.get("/api/xero/status", { validateStatus: () => true })
      ]);
      setZohoStatus(zohoRes.status === 200 ? zohoRes.data.status : "inactive");
      setXeroStatus(xeroRes.status === 200 ? xeroRes.data.status : "inactive");
    } catch (e) {
      console.error("Failed to refresh status", e);
    }
  };

  useEffect(() => {
    refreshIntegrationStatus();
    
    const handleOAuthMessage = (event: MessageEvent) => {
      if (event.data?.type === "OAUTH_AUTH_SUCCESS") {
        toast.success(`${event.data.integration === "zoho" ? "Zoho" : "Xero"} connected successfully!`);
        refreshIntegrationStatus();
      }
    };
    
    window.addEventListener("message", handleOAuthMessage);
    return () => window.removeEventListener("message", handleOAuthMessage);
  }, []);

  const handleConnectZoho = async () => {
    try {
      const res = await axios.get("/api/auth/zoho/url");
      if (res.data.url) {
        window.open(res.data.url, "ZohoLogin", "width=800,height=600");
      }
    } catch (e: any) {
      toast.error("Failed to get Zoho auth URL", { description: e.message });
    }
  };

  const handleConnectXero = async () => {
    try {
      const res = await axios.get("/api/auth/xero/url");
      if (res.data.url) {
        window.open(res.data.url, "XeroLogin", "width=800,height=600");
      }
    } catch (e: any) {
      toast.error("Failed to get Xero auth URL", { description: e.message });
    }
  };

  return (
    <div className="space-y-4">
      {/* Xero */}
      <div>
        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
              <LinkIcon className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h3 className="font-bold text-zinc-900">Xero Accounting</h3>
              <p className="text-sm text-zinc-500">Sync invoices and payments automatically</p>
            </div>
          </div>
          <Button 
            variant={xeroStatus === 'active' ? 'outline' : 'default'} 
            className={xeroStatus === 'active' ? 'border-green-200 text-green-700 hover:bg-green-50' : ''}
            onClick={handleConnectXero}
            disabled={xeroStatus === 'active'}
          >
            {xeroStatus === 'active' ? <><CheckCircle2 className="w-4 h-4 mr-2" /> Connected</> : 'Connect'}
          </Button>
        </div>

        {/* Real-time sync queue monitor, only available or shown for admins to inspect */}
        {xeroStatus === 'active' && <XeroSyncQueueMonitor />}
      </div>

      {/* Zoho */}
      <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-yellow-50 flex items-center justify-center shrink-0">
            <LinkIcon className="w-5 h-5 text-yellow-600" />
          </div>
          <div>
            <h3 className="font-bold text-zinc-900">Zoho CRM / Mail</h3>
            <p className="text-sm text-zinc-500">Sync contacts and emails</p>
          </div>
        </div>
        <Button 
          variant={zohoStatus === 'active' ? 'outline' : 'default'} 
          className={zohoStatus === 'active' ? 'border-green-200 text-green-700 hover:bg-green-50' : ''}
          onClick={handleConnectZoho}
          disabled={zohoStatus === 'active'}
        >
          {zohoStatus === 'active' ? <><CheckCircle2 className="w-4 h-4 mr-2" /> Connected</> : 'Connect'}
        </Button>
      </div>
      
      {/* RCS Integration Settings */}
      <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
            <LinkIcon className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h3 className="font-bold text-zinc-900">RCS Business Messaging</h3>
            <p className="text-sm text-zinc-500">Enable Rich Communication Services for capable devices (Typing indicators, read receipts, rich cards)</p>
          </div>
        </div>
        <Button 
           variant={rcsEnabled ? 'outline' : 'default'} 
           className={rcsEnabled ? 'border-green-200 text-green-700 hover:bg-green-50' : ''}
           onClick={handleToggleRcs}
        >
          {rcsEnabled ? <><CheckCircle2 className="w-4 h-4 mr-2" /> Enabled</> : 'Enable RCS'}
        </Button>
      </div>

      {/* Twilio Settings */}
      <TwilioSettingsForm />
    </div>
  );
}
