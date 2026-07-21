import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle, Search, Terminal, AlertTriangle, Activity } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SearchAnalyticsService } from '../../../services/search/SearchAnalyticsService';

export const SearchHealthDashboard = () => {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = () => {
      const summary = SearchAnalyticsService.getMetricsSummary();
      // compute hits breakdown from detailed logs
      let memoryCacheHits = 0;
      let indexeddbCacheHits = 0;
      let workerHits = 0;
      let firestoreHits = 0;
      let hybridFailover = 0;

      summary.detailedLogs.forEach(log => {
        if (log.source === "memory_cache") memoryCacheHits++;
        if (log.source === "indexeddb_cache") indexeddbCacheHits++;
        if (log.source === "web_worker_thread") workerHits++;
        if (log.source === "firestore_prefetch") firestoreHits++;
        if (log.source === "hybrid_fallback") hybridFailover++;
      });
      
      setMetrics({
        totalSearches: summary.totalSearchesTracked,
        zeroResultSearches: summary.zeroResultsCount,
        cacheHits: memoryCacheHits + indexeddbCacheHits,
        workerHits: workerHits,
        apiSearches: 0, // In this model, handled inside hybrid
        firestoreFallbackHits: firestoreHits + hybridFailover,
        averageLatencyMs: summary.averageSearchLatencyMs.toFixed(1),
        apiFailures: hybridFailover,
        detailedLogs: summary.detailedLogs
      });
      setLoading(false);
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 2000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div className="p-10 text-center"><Activity className="w-8 h-8 animate-pulse text-purple-500 mx-auto" /></div>;

  const hitRates = [
    { label: "Memory/IDB Cache", val: metrics.cacheHits, color: "bg-emerald-500" },
    { label: "Worker Search", val: metrics.workerHits, color: "bg-blue-500" },
    { label: "Firestore Fallback", val: metrics.firestoreFallbackHits, color: "bg-amber-500" }
  ];

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-zinc-900 tracking-tight">Search Health Metrics</h1>
          <p className="text-sm text-zinc-500 font-medium">Monitoring predictive search, failover sources, and resolution latencies.</p>
        </div>
        <div className="flex items-center gap-2">
           <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
           <span className="text-xs font-semibold uppercase text-zinc-400 tracking-wide">OS Core Engine OK</span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-zinc-200/60 shadow-sm overflow-hidden relative">
          <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
          <CardHeader className="pb-2">
             <CardTitle className="text-xs font-semibold uppercase text-zinc-400">Total Queries (Live run)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-mono font-black text-zinc-800">{metrics.totalSearches.toLocaleString()}</p>
          </CardContent>
        </Card>
        
        <Card className="rounded-2xl border-zinc-200/60 shadow-sm overflow-hidden relative">
           <div className="absolute top-0 left-0 w-1 h-full bg-rose-500" />
          <CardHeader className="pb-2">
             <CardTitle className="text-xs font-semibold uppercase text-zinc-400">Zero-Result Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-mono font-black text-zinc-800">{metrics.totalSearches > 0 ? ((metrics.zeroResultSearches / metrics.totalSearches) * 100).toFixed(1) : 0}%</p>
          </CardContent>
        </Card>
        
        <Card className="rounded-2xl border-zinc-200/60 shadow-sm overflow-hidden relative">
          <div className="absolute top-0 left-0 w-1 h-full bg-purple-500" />
          <CardHeader className="pb-2">
             <CardTitle className="text-xs font-semibold uppercase text-zinc-400">Average Latency</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-mono font-black text-zinc-800">{metrics.averageLatencyMs}ms</p>
          </CardContent>
        </Card>
        
        <Card className="rounded-2xl border-zinc-200/60 shadow-sm overflow-hidden relative">
          <div className="absolute top-0 left-0 w-1 h-full bg-amber-500" />
          <CardHeader className="pb-2">
             <CardTitle className="text-xs font-semibold uppercase text-zinc-400">API Failures & Fallbacks</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-mono font-black text-zinc-800">{metrics.apiFailures}</p>
            <p className="text-xs text-zinc-500 font-bold mt-1">Triggers standard degradation protocols</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
         <Card className="rounded-2xl border-zinc-200/60 shadow-sm p-6 space-y-6">
            <h3 className="text-sm font-black text-zinc-900 border-b border-zinc-100 pb-3">Source Resolution Breakdown</h3>
            <div className="space-y-4">
              {hitRates.map((h, i) => (
                <div key={i} className="space-y-1.5">
                   <div className="flex justify-between items-center text-xs font-bold text-zinc-600">
                     <span>{h.label}</span>
                     <span>{h.val} hits ({metrics.totalSearches > 0 ? ((h.val / metrics.totalSearches) * 100).toFixed(0) : 0}%)</span>
                   </div>
                   <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
                      <div className={`h-full ${h.color}`} style={{ width: `${metrics.totalSearches > 0 ? (h.val / metrics.totalSearches) * 100 : 0}%`}} />
                   </div>
                </div>
              ))}
            </div>
         </Card>

         <Card className="rounded-2xl border-zinc-200/60 shadow-sm p-6 bg-zinc-900 border-zinc-800 text-white">
            <h3 className="text-sm font-black text-white border-b border-zinc-800 pb-3 flex items-center gap-2">
               <Terminal className="w-4 h-4 text-purple-400" /> Diagnostics Stream
            </h3>
            <ScrollArea className="h-[200px] w-full mt-4 bg-black/40 rounded-xl border border-zinc-800 p-4">
               <div className="space-y-3 font-mono text-xs">
                  {metrics.detailedLogs.length === 0 && <span className="text-zinc-500">Awaiting search events...</span>}
                  {[...metrics.detailedLogs].reverse().map((log: any, i: number) => {
                     const timeStr = new Date(log.timestamp).toLocaleTimeString();
                     let color = "text-emerald-400";
                     if (log.source === "web_worker_thread") color = "text-blue-400";
                     if (log.source.includes("fallback")) color = "text-amber-400";
                     if (log.durationMs > 200) color = "text-rose-400";
                     
                     return (
                        <div key={i} className="flex gap-3">
                           <span className="text-zinc-500 shrink-0">{timeStr}</span>
                           <span className={color}>[{log.source.toUpperCase()}] Resolved '{log.term}' in {log.durationMs.toFixed(0)}ms - {log.resultsCount} matches</span>
                        </div>
                     )
                  })}
               </div>
            </ScrollArea>
         </Card>
      </div>
    </div>
  );
};
