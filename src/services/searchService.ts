import { 
  collection, 
  query, 
  where, 
  limit, 
  getDocs 
} from "firebase/firestore";
import { db } from "../firebase";
import Fuse from "fuse.js";
import { normalizeString, stripPhone } from "../lib/search-utils";

export interface SearchResult {
  id: string;
  type: 'customer' | 'ticket';
  title: string;
  subtitle: string;
  data: any;
}

export class SearchService {
  private static localCache = new Map<string, SearchResult[]>();
  private static activeQueries = new Set<string>();

  /**
   * Performs an optimized, cached hybrid prefix/fuzzy search.
   * Leverages local memory cache, query prefix refinement to avoid redundant Firestore reads.
   */
  static async globalSearch(term: string, abortSignal?: { aborted: boolean }): Promise<SearchResult[]> {
    const normalized = normalizeString(term);
    if (!normalized) return [];

    // 1. Memory Cache check
    if (this.localCache.has(normalized)) {
      console.log(`[SearchService] Cache hit for "${normalized}"`);
      return this.localCache.get(normalized)!;
    }

    // 2. Refinement optimization: check if we can filter from a shorter parent query cache
    let parentTerm = normalized.substring(0, normalized.length - 1);
    while (parentTerm.length >= 2) {
      if (this.localCache.has(parentTerm)) {
        const parentResults = this.localCache.get(parentTerm)!;
        const refined = this.refineLocalResults(parentResults, normalized);
        console.log(`[SearchService] Prefetched refinement parent hit for "${parentTerm}" -> "${normalized}"`);
        this.localCache.set(normalized, refined);
        return refined;
      }
      parentTerm = parentTerm.substring(0, parentTerm.length - 1);
    }

    // Handle duplicate active pending requests
    if (this.activeQueries.has(normalized)) {
      // Small sleep to await cache or complete
      await new Promise(r => setTimeout(r, 150));
      if (this.localCache.has(normalized)) {
        return this.localCache.get(normalized)!;
      }
    }

    this.activeQueries.add(normalized);

    try {
      if (abortSignal?.aborted) return [];

      // 3. Dual-channel prefix/exact search
      const [customers, tickets] = await Promise.all([
        this.searchCustomers(normalized, abortSignal),
        this.searchTickets(normalized, abortSignal)
      ]);

      if (abortSignal?.aborted) return [];

      const results: SearchResult[] = [
        ...customers.map(c => ({
          id: c.id,
          type: 'customer' as const,
          title: (c.firstname || c.lastname) ? `${c.firstname || ''} ${c.lastname || ''}`.trim() : c.business_name || 'Unnamed Customer',
          subtitle: c.business_name ? `${c.business_name} • ${c.email || c.phone || ''}` : (c.email || c.phone || c.mobile || ''),
          data: c
        })),
        ...tickets.map(t => ({
          id: t.id,
          type: 'ticket' as const,
          title: t.subject || t.issueDescription || `Ticket #${t.number}`,
          subtitle: `Status: ${t.status || 'Active'} • #${t.number} • ${t.customer_name || 'No Customer'}`,
          data: t
        }))
      ];

      // Store in memory cache
      if (results.length > 0 && normalized.length >= 2) {
        this.localCache.set(normalized, results);
      }

      return results;
    } finally {
      this.activeQueries.delete(normalized);
    }
  }

  private static refineLocalResults(results: SearchResult[], term: string): SearchResult[] {
    const rawData = results.map(r => r.data);
    const fuse = new Fuse(rawData, {
      keys: [
        'firstname',
        'lastname',
        'fullname',
        'business_name',
        'email',
        'phone',
        'mobile',
        'number',
        'subject',
        'device_imei',
        'device_serial'
      ],
      threshold: 0.4
    });

    const matches = fuse.search(term).map(r => r.item);
    return results.filter(res => matches.some((m: any) => m.id === res.id));
  }

  private static async searchCustomers(term: string, abortSignal?: { aborted: boolean }) {
    if (abortSignal?.aborted) return [];
    const stripped = stripPhone(term);
    const results: any[] = [];
    const queries = [];
    
    if (stripped.length >= 4) {
      queries.push(getDocs(query(collection(db, "crm_customers"), where("strippedPhone", ">=", stripped), where("strippedPhone", "<=", stripped + '\uf8ff'), limit(15))));
    }

    queries.push(getDocs(query(collection(db, "crm_customers"), where("normalizedName", ">=", term), where("normalizedName", "<=", term + '\uf8ff'), limit(15))));

    if (!/^\d+$/.test(term)) {
      queries.push(getDocs(query(collection(db, "crm_customers"), where("firstname", ">=", term), where("firstname", "<=", term + '\uf8ff'), limit(10))));
    }

    const snapshots = await Promise.all(queries);
    if (abortSignal?.aborted) return [];

    const seen = new Set();
    const rawResults: any[] = [];
    
    snapshots.forEach(snap => {
      snap.forEach(d => {
        if (!seen.has(d.id)) {
          seen.add(d.id);
          rawResults.push({ id: d.id, ...d.data() });
        }
      });
    });

    if (rawResults.length > 1) {
      const fuse = new Fuse(rawResults, {
        keys: ['firstname', 'lastname', 'business_name', 'email', 'mobile', 'phone'],
        threshold: 0.4
      });
      return fuse.search(term).map(r => r.item);
    }

    return rawResults;
  }

  private static async searchTickets(term: string, abortSignal?: { aborted: boolean }) {
    if (abortSignal?.aborted) return [];
    const queries = [];

    if (/^\d+$/.test(term)) {
      queries.push(getDocs(query(collection(db, "crm_tickets"), where("number", "==", parseInt(term)), limit(5))));
    }

    if (term.length >= 6) {
      queries.push(getDocs(query(collection(db, "crm_tickets"), where("device_imei", ">=", term), where("device_imei", "<=", term + '\uf8ff'), limit(10))));
    }

    const snapshots = await Promise.all(queries);
    if (abortSignal?.aborted) return [];

    const seen = new Set();
    const rawResults: any[] = [];
    
    snapshots.forEach(snap => {
      snap.forEach(d => {
        if (!seen.has(d.id)) {
          seen.add(d.id);
          rawResults.push({ id: d.id, ...d.data() });
        }
      });
    });

    if (rawResults.length > 1 && term.length > 2) {
      const fuse = new Fuse(rawResults, {
        keys: ['number', 'subject', 'device_imei', 'device_serial'],
        threshold: 0.3
      });
      return fuse.search(term).map(r => r.item);
    }

    return rawResults;
  }
}
