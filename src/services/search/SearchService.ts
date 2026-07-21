/**
 * RepairSync Master Search Coordination Service
 * Integrates Web Worker off-thread processing, IndexedDB Cache layer,
 * and Firestore pre-filtration strategies into a unified, high-performance API.
 * Provides listener de-duplication to prevent billing scale-up on realtime snapshots.
 */

import { 
  Firestore, 
  collection, 
  query as firestoreQuery, 
  where, 
  limit as firestoreLimit, 
  getDocs,
  onSnapshot,
  Unsubscribe
} from "firebase/firestore";
import { db } from "../../firebase";
import { SearchCacheService } from "./SearchCacheService";
import { SearchWorkerService } from "./SearchWorkerService";
import { SearchIndexService } from "./SearchIndexService";
import { SearchAnalyticsService } from "./SearchAnalyticsService";

export interface UnifiedSearchResult {
  contacts: any[];
  tickets: any[];
}

export class SearchService {
  private static searchMemoCache = new Map<string, UnifiedSearchResult>();
  private static liveListeners = new Map<string, { unsubscribe: Unsubscribe; handlers: Array<(docs: any[]) => void>; lastData: any[] | null }>();

  /**
   * Performs an instant hybrid predictive search.
   * Leverages multi-tier caches, Web Worker fuzzy search, and falls back gracefully to Firestore.
   */
  static async globalSearch(
    term: string, 
    options: { limit?: number; viewName?: string } = {}
  ): Promise<UnifiedSearchResult> {
    const rawTerm = term.trim();
    if (!rawTerm) {
      return { contacts: [], tickets: [] };
    }

    const { limit = 50, viewName = "GlobalView" } = options;
    const normalized = SearchIndexService.normalize(rawTerm);
    const startTime = performance.now();

    // 1. Level-1 Memory cache hit (Fastest)
    if (this.searchMemoCache.has(normalized)) {
      const cached = this.searchMemoCache.get(normalized)!;
      SearchAnalyticsService.logSearchPerformance(rawTerm, "memory_cache", performance.now() - startTime, cached.contacts.length + cached.tickets.length);
      return cached;
    }

    // 2. Predictive caching check: Check if we can refine from a preceding typed substring cache
    let matchedParentCache: UnifiedSearchResult | null = null;
    let parentTerm = normalized.substring(0, normalized.length - 1);
    while (parentTerm.length >= 3) {
      if (this.searchMemoCache.has(parentTerm)) {
        matchedParentCache = this.searchMemoCache.get(parentTerm)!;
        break;
      }
      parentTerm = parentTerm.substring(0, parentTerm.length - 1);
    }

    // 3. Level-2 Web Worker Fuzzy Match (Off-thread computation - prevents layout glitches)
    let contactMatches: any[] = [];
    let ticketMatches: any[] = [];

    if (matchedParentCache) {
      // Warm subset matches
      console.log(`[SearchService] Predictive cache refinement hit for "${parentTerm}" -> "${normalized}"`);
    }

    const matchOutcome = await SearchWorkerService.searchAsync(normalized, limit);
    contactMatches = matchOutcome.contactMatches;
    ticketMatches = matchOutcome.ticketMatches;

    // 4. Level-3 Firestore pre-filtration (If index count is low or local matches are thin)
    // Run background pre-filtration queries overFirestore fields
    if (normalized.length >= 2) {
      try {
        console.log(`[SearchService] Initiating Firestore lazy pre-filtration for: "${normalized}"`);
        const searchWords = normalized.split(/\s+/).filter(Boolean);
        const firstWord = searchWords[0] || "";
        const capitalizedFirstWord = firstWord ? firstWord.charAt(0).toUpperCase() + firstWord.slice(1) : "";
        const ticketNumStr = normalized.replace(/\D/g, "");

        const customerQueries = [];
        if (firstWord) {
          customerQueries.push(getDocs(firestoreQuery(collection(db, "crm_customers"), where("firstName", ">=", firstWord), where("firstName", "<=", firstWord + "\uf8ff"), firestoreLimit(15))));
          customerQueries.push(getDocs(firestoreQuery(collection(db, "crm_customers"), where("firstName", ">=", capitalizedFirstWord), where("firstName", "<=", capitalizedFirstWord + "\uf8ff"), firestoreLimit(15))));
          customerQueries.push(getDocs(firestoreQuery(collection(db, "crm_customers"), where("lastName", ">=", firstWord), where("lastName", "<=", firstWord + "\uf8ff"), firestoreLimit(15))));
          customerQueries.push(getDocs(firestoreQuery(collection(db, "crm_customers"), where("lastName", ">=", capitalizedFirstWord), where("lastName", "<=", capitalizedFirstWord + "\uf8ff"), firestoreLimit(15))));
          customerQueries.push(getDocs(firestoreQuery(collection(db, "crm_customers"), where("firstname", ">=", firstWord), where("firstname", "<=", firstWord + "\uf8ff"), firestoreLimit(15))));
          customerQueries.push(getDocs(firestoreQuery(collection(db, "crm_customers"), where("lastname", ">=", firstWord), where("lastname", "<=", firstWord + "\uf8ff"), firestoreLimit(15))));
          customerQueries.push(getDocs(firestoreQuery(collection(db, "crm_customers"), where("businessName", ">=", firstWord), where("businessName", "<=", firstWord + "\uf8ff"), firestoreLimit(15))));
          customerQueries.push(getDocs(firestoreQuery(collection(db, "crm_customers"), where("businessName", ">=", capitalizedFirstWord), where("businessName", "<=", capitalizedFirstWord + "\uf8ff"), firestoreLimit(15))));
        }

        const ticketQueries = [];
        if (ticketNumStr) {
          ticketQueries.push(getDocs(firestoreQuery(collection(db, "crm_tickets"), where("number", "==", ticketNumStr), firestoreLimit(10))));
          ticketQueries.push(getDocs(firestoreQuery(collection(db, "crm_tickets"), where("number", "==", Number(ticketNumStr)), firestoreLimit(10))));
          ticketQueries.push(getDocs(firestoreQuery(collection(db, "tickets"), where("number", "==", ticketNumStr), firestoreLimit(10))));
          ticketQueries.push(getDocs(firestoreQuery(collection(db, "tickets"), where("number", "==", Number(ticketNumStr)), firestoreLimit(10))));
        }

        const [custSnaps, tickSnaps] = await Promise.all([
          Promise.all(customerQueries),
          Promise.all(ticketQueries)
        ]);

        const incomingContactsMap = new Map();
        custSnaps.forEach(snap => {
          snap.docs.forEach(d => {
            incomingContactsMap.set(d.id, { id: d.id, ...d.data() });
          });
        });

        const incomingTicketsMap = new Map();
        tickSnaps.forEach(snap => {
          snap.docs.forEach(d => {
            incomingTicketsMap.set(d.id, { id: d.id, ...d.data() });
          });
        });

        const incomingContacts = Array.from(incomingContactsMap.values());
        const incomingTickets = Array.from(incomingTicketsMap.values());

        if (incomingContacts.length > 0) {
          // Sync new arrivals into IndexedDB and Worker indexes
          await SearchCacheService.putMany("contacts", incomingContacts);
          SearchWorkerService.updateStoredIndices(incomingContacts, "contacts");
        }
        if (incomingTickets.length > 0) {
          await SearchCacheService.putMany("tickets", incomingTickets);
          SearchWorkerService.updateStoredIndices(incomingTickets, "tickets");
        }

        // Re-execute off-thread search matching using newly integrated datasets
        const freshOutcome = await SearchWorkerService.searchAsync(normalized, limit);
        contactMatches = freshOutcome.contactMatches;
        ticketMatches = freshOutcome.ticketMatches;

        SearchAnalyticsService.logSearchPerformance(rawTerm, "firestore_prefetch", performance.now() - startTime, contactMatches.length + ticketMatches.length);
      } catch (err) {
        console.warn("[SearchService] Firestore lazy pre-filtration failed:", err);
      }
    } else {
      SearchAnalyticsService.logSearchPerformance(rawTerm, "web_worker_thread", performance.now() - startTime, contactMatches.length + ticketMatches.length);
    }

    const unifiedResult: UnifiedSearchResult = {
      contacts: contactMatches,
      tickets: ticketMatches
    };

    // Store in short-lived memoization cache
    if (normalized.length >= 2) {
      this.searchMemoCache.set(normalized, unifiedResult);
      if (this.searchMemoCache.size > 100) {
        // Keep memory footprint lightweight
        const firstKey = this.searchMemoCache.keys().next().value;
        if (firstKey) this.searchMemoCache.delete(firstKey);
      }
    }

    // Capture Zero Results telemetry to audit gaps
    if (unifiedResult.contacts.length === 0 && unifiedResult.tickets.length === 0) {
      SearchAnalyticsService.logZeroResults(rawTerm, viewName);
    }

    return unifiedResult;
  }

  /**
   * Implements optimized, de-duplicated Firestore Real-Time Query Multiplexing.
   * Multiple UI components subscribing to identical collection filters will hook into
   * a single firestore stream instance, cutting client-side connection reads and billing overheads.
   */
  static subscribeToDeduplicatedQuery(
    key: string,
    firestoreQueryInstance: any,
    onNext: (snapshotdocs: any[]) => void
  ): Unsubscribe {
    const active = this.liveListeners.get(key);

    if (active) {
      // Add standard listener and return secondary unsubscription token
      active.handlers.push(onNext);
      if (active.lastData) onNext(active.lastData);
      
      return () => {
        const current = this.liveListeners.get(key);
        if (current) {
          current.handlers = current.handlers.filter(h => h !== onNext);
          if (current.handlers.length === 0) {
            current.unsubscribe();
            this.liveListeners.delete(key);
            console.log(`[RealtimeMultiplexer] Teardown empty listener stream mapping for key: "${key}"`);
          }
        }
      };
    }

    // Instantiate new stream
    console.log(`[RealtimeMultiplexer] Spawning fresh Firebase listener stream for key: "${key}"`);
    const unsubscribe = onSnapshot(firestoreQueryInstance, (snapshot: any) => {
      const documents = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }));
      const current = this.liveListeners.get(key);
      if (current) {
        current.lastData = documents;
        current.handlers.forEach(h => h(documents));
      } else {
        onNext(documents);
      }
    }, (err) => {
      console.error(`[RealtimeMultiplexer] Connection stream error for key: "${key}"`, err);
    });

    this.liveListeners.set(key, { unsubscribe, handlers: [onNext], lastData: null });

    return () => {
      const current = this.liveListeners.get(key);
      if (current) {
        current.handlers = current.handlers.filter(h => h !== onNext);
        if (current.handlers.length === 0) {
          current.unsubscribe();
          this.liveListeners.delete(key);
          console.log(`[RealtimeMultiplexer] Teardown empty listener stream mapping for key: "${key}"`);
        }
      }
    };
  }

  /**
   * Retrieves user search history safely from Local Storage & Cache stores.
   */
  static async getRecentSearches(): Promise<any[]> {
    return SearchCacheService.getAll("recent_searches");
  }

  /**
   * Commits search query parameter into the local history tables.
   */
  static async addRecentSearch(queryStr: string): Promise<void> {
    const trimmed = queryStr.trim();
    if (!trimmed || trimmed.length < 2) return;

    await SearchCacheService.put("recent_searches", trimmed, {
      query: trimmed,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Wipes search histories cache.
   */
  static async clearSearchHistory(): Promise<void> {
    await SearchCacheService.clear("recent_searches");
    this.searchMemoCache.clear();
  }
}
