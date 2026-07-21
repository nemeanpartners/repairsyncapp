import { onSnapshot, Unsubscribe } from "firebase/firestore";
import { CostAnalyticsEngine } from "./CostAnalyticsEngine";

interface ActiveListener {
  unsubscribe: Unsubscribe;
  callbacks: Set<(data: any) => void>;
  lastData: any;
}

export class RealtimeManager {
  private static activeStreams = new Map<string, ActiveListener>();

  /**
   * Tracks and de-duplicates standard firestore query or document listeners globally.
   * If two components subscribe to the exact same query key, only a single physical connection
   * is maintained with Firebase, cutting read billing overhead.
   */
  static subscribe(
    key: string,
    firestoreRef: any,
    onNext: (data: any) => void,
    onError?: (error: any) => void
  ): Unsubscribe {
    let existing = this.activeStreams.get(key);

    if (existing) {
      existing.callbacks.add(onNext);
      // Immediately hydrate the new subscriber with the last seen data
      if (existing.lastData !== undefined) {
        onNext(existing.lastData);
      }
      
      // Return a coordinated unsubscribe token
      return () => {
        this.unsubscribe(key, onNext);
      };
    }

    // Set up a new unified Firestore listener
    console.log(`[RealtimeManager] Setting up new live subscription for key: ${key}`);
    
    // Log the subscription registration cost
    CostAnalyticsEngine.recordListenerSpawn(key);
    
    // Reserve the key before snapshot arrives
    const newCallbacks = new Set<(data: any) => void>();
    newCallbacks.add(onNext);

    const unsubscribe = onSnapshot(
      firestoreRef,
      (snapshot: any) => {
        let docsCount = 0;
        let isDoc = false;
        let data: any;

        if (snapshot.docs) {
          docsCount = snapshot.docs.length;
          data = snapshot.docs.map((d: any) => ({ ...d.data(), id: d.id, _doc: d }));
        } else {
          isDoc = true;
          docsCount = snapshot.exists() ? 1 : 0;
          data = snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
        }

        // Trace and record Firestore Reads dynamically for cost reporting!
        CostAnalyticsEngine.recordReads(key, docsCount || 1);

        const activeStream = this.activeStreams.get(key);
        if (activeStream) {
          activeStream.lastData = data;
          activeStream.callbacks.forEach(cb => cb(data));
        }
      },
      (error: any) => {
        console.error(`[RealtimeManager] Error on listener for key: "${key}"`, error);
        if (onError) onError(error);
      }
    );

    this.activeStreams.set(key, {
      unsubscribe,
      callbacks: newCallbacks,
      lastData: undefined
    });

    return () => {
      this.unsubscribe(key, onNext);
    };
  }

  private static unsubscribe(key: string, callback: (data: any) => void) {
    const stream = this.activeStreams.get(key);
    if (!stream) return;

    stream.callbacks.delete(callback);
    
    if (stream.callbacks.size === 0) {
      stream.unsubscribe();
      this.activeStreams.delete(key);
      console.log(`[RealtimeManager] Closed empty multiplexer stream for key: ${key}`);
      CostAnalyticsEngine.recordListenerTeardown(key);
    }
  }

  /**
   * Diagnostic report on current stream allocations.
   */
  static getDiagnosticReport() {
    const report: Array<{ key: string; refs: number }> = [];
    this.activeStreams.forEach((value, key) => {
      report.push({ key, refs: value.callbacks.size });
    });
    return report;
  }
}
