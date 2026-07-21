/**
 * RepairSync Enterprise Search Telemetry Service
 * Measures index lookups speeds (Worker vs Database vs Cache),
 * tracks cache hits/miss ratios, captures zero-result search terms for inventory audits,
 * and records memory footprint estimates.
 */

import { doc, getDoc, setDoc, increment } from 'firebase/firestore';
import { db } from '../../firebase';

export interface SearchLatencyMetrics {
  term: string;
  source: "memory_cache" | "indexeddb_cache" | "web_worker_thread" | "firestore_prefetch" | "hybrid_fallback" | "hybrid_fallback_error";
  durationMs: number;
  resultsCount: number;
  timestamp: string;
}

export interface SearchAuditAlert {
  query: string;
  timestamp: string;
  contextView: string;
}

export class SearchAnalyticsService {
  private static latencyLogs: SearchLatencyMetrics[] = [];
  private static zeroResultsAudits: SearchAuditAlert[] = [];
  private static cacheQueriesCount = 0;
  private static cacheHitsCount = 0;
  
  private static pendingFirestoreSync = {
    totalSearches: 0,
    zeroResults: 0,
    cacheHits: 0,
    workerHits: 0,
    firestoreFallbackHits: 0,
    fallbackErrors: 0,
    totalLatencyMs: 0
  };
  
  private static syncTimeout: any = null;

  static logSearchPerformance(
    term: string, 
    source: SearchLatencyMetrics["source"], 
    durationMs: number, 
    resultsCount: number
  ): void {
    const log: SearchLatencyMetrics = {
      term,
      source,
      durationMs,
      resultsCount,
      timestamp: new Date().toISOString()
    };

    this.latencyLogs.push(log);
    
    if (this.latencyLogs.length > 500) {
      this.latencyLogs.shift();
    }

    this.cacheQueriesCount++;
    this.pendingFirestoreSync.totalSearches++;
    this.pendingFirestoreSync.totalLatencyMs += durationMs;

    if (source === "memory_cache" || source === "indexeddb_cache") {
      this.cacheHitsCount++;
      this.pendingFirestoreSync.cacheHits++;
    } else if (source === "web_worker_thread") {
      this.pendingFirestoreSync.workerHits++;
    } else if (source === "hybrid_fallback" || source === "firestore_prefetch") {
      this.pendingFirestoreSync.firestoreFallbackHits++;
    } else if (source === "hybrid_fallback_error") {
      this.pendingFirestoreSync.fallbackErrors++;
    }

    if (resultsCount === 0) {
      this.pendingFirestoreSync.zeroResults++;
    }

    console.debug(`[Telemetry-Search] Term: "${term}" | Source: ${source} | Latency: ${durationMs.toFixed(1)}ms | Count: ${resultsCount}`);
    
    this.scheduleSync();
  }

  static logZeroResults(queryStr: string, viewContext: string): void {
    if (!queryStr.trim()) return;

    this.zeroResultsAudits.push({
      query: queryStr,
      timestamp: new Date().toISOString(),
      contextView: viewContext
    });

    if (this.zeroResultsAudits.length > 200) {
      this.zeroResultsAudits.shift();
    }

    console.warn(`[Telemetry-ZeroResults] Search yielded no matches for "${queryStr}" in view: ${viewContext}`);
  }

  private static scheduleSync() {
    if (this.syncTimeout) return;
    this.syncTimeout = setTimeout(() => {
      this.syncTimeout = null;
      this.flushToFirestore();
    }, 15000); // Batch writes every 15 seconds max
  }

  private static async flushToFirestore() {
    if (this.pendingFirestoreSync.totalSearches === 0) return;
    
    const statsToPush = { ...this.pendingFirestoreSync };
    
    // Reset pending immediately so we can capture new ones during await
    this.pendingFirestoreSync = {
      totalSearches: 0,
      zeroResults: 0,
      cacheHits: 0,
      workerHits: 0,
      firestoreFallbackHits: 0,
      fallbackErrors: 0,
      totalLatencyMs: 0
    };

    try {
      const todayString = new Date().toISOString().split('T')[0];
      const docRef = doc(db, 'system_telemetry', `search_analytics_${todayString}`);
      
      const updatePayload = {
        totalSearches: increment(statsToPush.totalSearches),
        zeroResults: increment(statsToPush.zeroResults),
        cacheHits: increment(statsToPush.cacheHits),
        workerHits: increment(statsToPush.workerHits),
        firestoreFallbackHits: increment(statsToPush.firestoreFallbackHits),
        fallbackErrors: increment(statsToPush.fallbackErrors),
        totalLatencyMs: increment(statsToPush.totalLatencyMs),
        updatedAt: new Date().toISOString()
      };

      const snap = await getDoc(docRef);
      if (!snap.exists()) {
        await setDoc(docRef, {
           ...updatePayload, 
           totalSearches: statsToPush.totalSearches,
           zeroResults: statsToPush.zeroResults,
           cacheHits: statsToPush.cacheHits,
           workerHits: statsToPush.workerHits,
           firestoreFallbackHits: statsToPush.firestoreFallbackHits,
           fallbackErrors: statsToPush.fallbackErrors,
           totalLatencyMs: statsToPush.totalLatencyMs,
        });
      } else {
        await setDoc(docRef, updatePayload, { merge: true });
      }
    } catch (e) {
      console.warn("[Telemetry-Search] Failed to persist analytics block", e);
      // Optional: push statsToPush back to pending on fail, but let's just drop them to avoid death loop
    }
  }

  static getMetricsSummary() {
    const total = this.latencyLogs.length;
    const avgLatency = total > 0 
      ? this.latencyLogs.reduce((acc, log) => acc + log.durationMs, 0) / total 
      : 0;

    const hitRate = this.cacheQueriesCount > 0 
      ? (this.cacheHitsCount / this.cacheQueriesCount) * 100 
      : 0;

    return {
      totalSearchesTracked: this.cacheQueriesCount,
      cacheHitRatePercent: hitRate,
      averageSearchLatencyMs: avgLatency,
      zeroResultsCount: this.zeroResultsAudits.length,
      zeroResultsList: [...this.zeroResultsAudits],
      detailedLogs: [...this.latencyLogs]
    };
  }

  static clearMetricsLogs(): void {
    this.latencyLogs = [];
    this.zeroResultsAudits = [];
    this.cacheQueriesCount = 0;
    this.cacheHitsCount = 0;
  }
}
