import React, { useEffect, useState } from "react";
import { collection, query, orderBy, limit, getDocs, where } from "firebase/firestore";
import { db } from "../../../firebase";
import { AlertCircle, AlertTriangle, Info, CheckCircle2, History, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function SyncLogsPanel() {
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const q = query(
        collection(db, "system_logs"),
        where("service", "==", "repairshopr_sync"),
        orderBy("timestamp", "desc"),
        limit(15)
      );
      const snap = await getDocs(q);
      const data = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date()
      }));
      setLogs(data);
    } catch (e) {
      console.error("Failed to load sync logs", e);
    } finally {
      setIsLoading(false);
    }
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'error': return <AlertCircle className="w-4 h-4 text-rose-500" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'success': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'info':
      default: return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const getLevelBadge = (level: string) => {
    switch (level) {
      case 'error': return <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100 border-none">Failed</Badge>;
      case 'warning': return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-none">Discrepancy</Badge>;
      case 'success': return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none">Success</Badge>;
      case 'info':
      default: return null;
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden flex flex-col h-full h-[400px]">
      <div className="p-4 bg-zinc-50/80 border-b border-zinc-200 flex justify-between items-center">
        <div className="flex items-center gap-2">
           <History className="w-4 h-4 text-zinc-500" />
           <h3 className="font-bold text-zinc-800">RepairShopr Sync Logs</h3>
        </div>
        <button 
          onClick={fetchLogs}
          disabled={isLoading}
          className="p-1 hover:bg-zinc-200 rounded text-zinc-500 transition-colors"
          title="Refresh Logs"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2">
        {isLoading && logs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-zinc-400 text-sm">
             Loading logs...
          </div>
        ) : logs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-zinc-400 text-sm">
             No recent sync activities found.
          </div>
        ) : (
          <div className="space-y-1">
            {logs.map((log) => (
              <div 
                key={log.id} 
                className={`p-3 rounded-lg border flex gap-3 items-start transition-colors ${
                  log.level === 'error' ? 'bg-rose-50/50 border-rose-100 hover:bg-rose-50' : 
                  log.level === 'warning' ? 'bg-amber-50/50 border-amber-100 hover:bg-amber-50' : 
                  'bg-white border-transparent hover:bg-zinc-50'
                }`}
              >
                <div className="shrink-0 mt-0.5">
                  {getLevelIcon(log.level)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between items-start gap-2">
                    <p className={`text-sm font-semibold ${
                      log.level === 'error' ? 'text-rose-900' :
                      log.level === 'warning' ? 'text-amber-900' :
                      'text-zinc-900'
                    }`}>
                      {log.message}
                    </p>
                    <div className="shrink-0">
                      {getLevelBadge(log.level)}
                    </div>
                  </div>
                  {log.details && (
                    <p className={`text-xs mt-1 truncate ${
                      log.level === 'error' ? 'text-rose-600' :
                      log.level === 'warning' ? 'text-amber-600' :
                      'text-zinc-500'
                    }`} title={log.details}>
                      {log.details}
                    </p>
                  )}
                  <p className="text-xs text-zinc-400 mt-2">
                    {new Date(log.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
