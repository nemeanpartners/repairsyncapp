import { SearchCacheService } from "./SearchCacheService";
import { SearchWorkerService } from "./SearchWorkerService";
import { SearchAnalyticsService } from "./SearchAnalyticsService";
import { CostAnalyticsEngine } from "../CostAnalyticsEngine";
import { db } from "../../firebase";
import { collection, query as fsQuery, where, limit as fsLimit, getDocs } from "firebase/firestore";
import axios from "axios";

export interface NormalizedCustomer {
  customerId: string;
  firstName: string;
  lastName: string;
  phone: string;
  strippedPhone: string;
  email: string;
  businessName: string;
  searchableTerms: string;
  searchTermsArray: string[];
  updatedAt: string;

  // Compatibility fields
  id: string;
  firstname: string;
  lastname: string;
  address?: string;
  fullname?: string;
  business_name?: string;
  business_then_name?: string;
  business_and_full_name?: string;
  mobile?: string;
  created_at?: string;
  updated_at?: string;
}

function getIsoString(val: any): string {
  if (!val) return new Date().toISOString();
  if (typeof val === "string") {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d.toISOString();
    return new Date().toISOString();
  }
  if (val instanceof Date) {
    return val.toISOString();
  }
  if (typeof val.toDate === "function") {
    try {
      return val.toDate().toISOString();
    } catch (e) {}
  }
  if (typeof val.seconds === "number") {
    return new Date(val.seconds * 1000).toISOString();
  }
  if (typeof val._seconds === "number") {
    return new Date(val._seconds * 1000).toISOString();
  }
  const d = new Date(val);
  if (!isNaN(d.getTime())) return d.toISOString();
  return new Date().toISOString();
}

export function normalizeCustomer(c: any): NormalizedCustomer {
  if (!c) {
    return {
      customerId: "",
      firstName: "",
      lastName: "",
      phone: "",
      strippedPhone: "",
      email: "",
      businessName: "",
      searchableTerms: "",
      searchTermsArray: [],
      updatedAt: new Date().toISOString(),
      id: "",
      firstname: "",
      lastname: ""
    } as any;
  }

  const rawId = String(c.customerId || c.id || c.uid || "");
  const firstName = String(c.firstName || c.firstname || c.first_name || "").trim();
  const lastName = String(c.lastName || c.lastname || c.last_name || "").trim();
  const phone = String(c.phone || c.mobile || "").trim();
  const strippedPhone = phone.replace(/\D/g, "");
  const email = String(c.email || "").trim();
  const address = String(c.address || "").trim();
  const businessName = String(c.businessName || c.business_name || c.business_then_name || c.business_and_full_name || "").trim();

  const generatedTerms = [
    firstName.toLowerCase(),
    lastName.toLowerCase(),
    strippedPhone,
    email.toLowerCase(),
    businessName.toLowerCase()
  ].filter(Boolean);

  const searchableTermsStr = c.searchableTerms || generatedTerms.join(" ");
  const searchTermsArray = Array.isArray(c.searchTermsArray) ? c.searchTermsArray : generatedTerms;

  const updatedAt = getIsoString(c.updatedAt || c.updated_at);

  const normalized: NormalizedCustomer = {
    customerId: rawId,
    id: rawId,
    firstName,
    firstname: firstName,
    lastName,
    lastname: lastName,
    phone,
    strippedPhone,
    email,
    businessName,
    address,
    fullname: `${firstName} ${lastName}`.trim() || businessName || "Unnamed Contact",
    business_name: businessName,
    business_then_name: businessName || `${firstName} ${lastName}`.trim(),
    business_and_full_name: `${firstName} ${lastName}`.trim() || businessName,
    searchableTerms: String(searchableTermsStr).toLowerCase(),
    searchTermsArray,
    updatedAt,
    mobile: c.mobile || phone,
    created_at: getIsoString(c.createdAt || c.created_at),
    updated_at: updatedAt
  };

  return normalized;
}

export class CustomerSearchEngine {
  private static memoryCache = new Map<string, NormalizedCustomer[]>();
  private static inMemoryPool: NormalizedCustomer[] = [];
  private static isHydrated = false;

  /**
   * Proactively hydrates local memories with IndexedDB contacts cache
   */
  static async prepool(): Promise<NormalizedCustomer[]> {
    if (this.isHydrated && this.inMemoryPool.length > 0) {
      return this.inMemoryPool;
    }
    try {
      const cached = await SearchCacheService.getAll("contacts");
      if (cached && cached.length > 0) {
        this.inMemoryPool = cached.map(normalizeCustomer);
        this.isHydrated = true;
      }
    } catch (err) {
      console.warn("[CustomerSearchEngine] IDB prepool failed, falling back safely:", err);
    }
    return this.inMemoryPool;
  }

  /**
   * Updates a single contact in cache & pool
   */
  static updateLocalContact(customer: any) {
    const norm = normalizeCustomer(customer);
    const existingIndex = this.inMemoryPool.findIndex(c => c.customerId === norm.customerId);
    if (existingIndex > -1) {
      this.inMemoryPool[existingIndex] = norm;
    } else {
      this.inMemoryPool.push(norm);
    }
    this.memoryCache.clear();
  }

  /**
   * Orchestrates multi-tier optimized customer search
   */
  static async search(
    term: string,
    limitThreshold = 80
  ): Promise<{
    results: NormalizedCustomer[];
    source: "memory" | "worker_fuzzy" | "hybrid_api" | "firestore_fallback" | "offline_degraded" | "empty";
    latencyMs: number;
    apiFailed: boolean;
    firestoreFallbackUsed: boolean;
  }> {
    const rawQuery = term.trim();
    const startTime = performance.now();

    if (!rawQuery) {
      const recent = await this.prepool();
      return {
        results: recent.slice(0, 30),
        source: "memory",
        latencyMs: performance.now() - startTime,
        apiFailed: false,
        firestoreFallbackUsed: false
      };
    }

    const normQuery = rawQuery.toLowerCase();

    // Tier 1: Check In-Memory Deduplicated Query Cache
    if (this.memoryCache.has(normQuery)) {
      const cachedMatches = this.memoryCache.get(normQuery)!;
      const duration = performance.now() - startTime;
      SearchAnalyticsService.logSearchPerformance(rawQuery, "memory_cache", duration, cachedMatches.length);
      return {
        results: cachedMatches,
        source: "memory",
        latencyMs: duration,
        apiFailed: false,
        firestoreFallbackUsed: false
      };
    }

    let results: NormalizedCustomer[] = [];
    let source: any = "empty";
    let apiFailed = false;
    let firestoreFallbackUsed = false;

    // Ensure our local IndexedDB pool is hydrated in memory
    await this.prepool();

    // Tier 2: Run fuzzy search via Worker (runs Fuse.js off main thread)
    try {
      const workerResponse = await SearchWorkerService.searchAsync(rawQuery, limitThreshold);
      const contactMatches = workerResponse?.contactMatches || [];
      if (contactMatches.length > 0) {
        results = contactMatches.map(normalizeCustomer);
        source = "worker_fuzzy";
      }
    } catch (e) {
      console.warn("[CustomerSearchEngine] Worker fuzzy search exception:", e);
    }

    // Tier 3: API Enhanced Server Queries (gives the absolute ground truth)
    try {
      const apiResponse = await axios.get("/api/crm/customers/search", { 
        params: { q: rawQuery },
        timeout: 4000
      });
      const rawResults = Array.isArray(apiResponse.data) ? apiResponse.data : (apiResponse.data?.data || []);

      if (rawResults.length > 0) {
        const normalizedApi = rawResults.map(normalizeCustomer);
        
        // Merge & deduplicate keeping server priority
        const mergMap = new Map<string, NormalizedCustomer>();
        results.forEach(c => mergMap.set(c.customerId, c));
        normalizedApi.forEach(c => mergMap.set(c.customerId, c));
        
        results = Array.from(mergMap.values()).slice(0, limitThreshold);
        source = "hybrid_api";

        // Proactively synchronize server results into offline IndexedDB cache and local search pool
        SearchCacheService.putMany("contacts", rawResults).catch(err => console.error(err));
        
        // Update in-memory pool
        rawResults.forEach(c => {
          const norm = normalizeCustomer(c);
          const idx = this.inMemoryPool.findIndex(p => p.customerId === norm.customerId);
          if (idx > -1) {
            this.inMemoryPool[idx] = norm;
          } else {
            this.inMemoryPool.push(norm);
          }
        });
        SearchWorkerService.updateStoredIndices(rawResults, "contacts");
      }
    } catch (apiErr) {
      console.error("[CustomerSearchEngine] External API Enhanced search failed. Entering custom failover:", apiErr);
      apiFailed = true;

      // Tier 4: Direct Firestore prefix queries fallback (Under strict Cost analytics)
      try {
        console.log("[CustomerSearchEngine] API failed. Attempting Firestore Fallback...");
        firestoreFallbackUsed = true;

        const lowQuery = rawQuery.toLowerCase();
        
        // Attempt array-contains if we have indexed terms, otherwise prefix match on firstName
        const qFirst = fsQuery(collection(db, "crm_customers"), where("firstName", ">=", rawQuery), where("firstName", "<=", rawQuery + "\uf8ff"), fsLimit(20));
        const qTerms = fsQuery(collection(db, "crm_customers"), where("searchTermsArray", "array-contains", lowQuery), fsLimit(20));
        
        const [snapFirst, snapTerms] = await Promise.all([getDocs(qFirst), getDocs(qTerms)]);
        const totalReadsTracked = snapFirst.size + snapTerms.size;
        
        // Track the reads securely via CostAnalyticsEngine
        CostAnalyticsEngine.recordReads(`firestore_search_fallback_${rawQuery}`, totalReadsTracked || 1);

        const fsMatches: any[] = [];
        const seen = new Set<string>();
        [...snapFirst.docs, ...snapTerms.docs].forEach(doc => {
          if (!seen.has(doc.id)) {
            seen.add(doc.id);
            fsMatches.push({ id: doc.id, ...doc.data() });
          }
        });

        if (fsMatches.length > 0) {
          const normalizedFs = fsMatches.map(normalizeCustomer);
          const mergMap = new Map<string, NormalizedCustomer>();
          results.forEach(c => mergMap.set(c.customerId, c));
          normalizedFs.forEach(c => mergMap.set(c.customerId, c));
          
          results = Array.from(mergMap.values()).slice(0, limitThreshold);
          source = "firestore_fallback";
          SearchCacheService.putMany("contacts", fsMatches).catch(err => console.error(err));
        }
      } catch (fsErr) {
        console.error("[CustomerSearchEngine] Firestore Fallback Prefix-matching also failed:", fsErr);
      }
    }

    // Tier 5: Local Offline Degradation Matcher (as absolute final failsafe)
    if (results.length === 0 && this.inMemoryPool.length > 0) {
      // Direct in-memory text search fallback matching against normalized pool
      const lowerSearch = rawQuery.toLowerCase();
      results = this.inMemoryPool.filter(c => {
        return c.firstName.toLowerCase().includes(lowerSearch) ||
               c.lastName.toLowerCase().includes(lowerSearch) ||
               c.phone.includes(lowerSearch) ||
               c.email.toLowerCase().includes(lowerSearch) ||
               c.searchableTerms.toLowerCase().includes(lowerSearch);
      }).slice(0, limitThreshold);
      
      if (results.length > 0) {
        source = "offline_degraded";
      }
    }

    // Sort the results by relevance to the query
    if (results.length > 0) {
      const lowerQuery = rawQuery.toLowerCase();
      results.sort((a, b) => {
        const aName = `${a.firstName} ${a.lastName}`.toLowerCase().trim();
        const bName = `${b.firstName} ${b.lastName}`.toLowerCase().trim();
        
        const aEmail = (a.email || "").toLowerCase().trim();
        const bEmail = (b.email || "").toLowerCase().trim();
        
        const aPhone = (a.phone || "").toLowerCase().trim();
        const bPhone = (b.phone || "").toLowerCase().trim();

        // Exact name match
        if (aName === lowerQuery && bName !== lowerQuery) return -1;
        if (aName !== lowerQuery && bName === lowerQuery) return 1;

        // Exact email match
        if (aEmail === lowerQuery && bEmail !== lowerQuery) return -1;
        if (aEmail !== lowerQuery && bEmail === lowerQuery) return 1;

        // Exact phone match
        if (aPhone === lowerQuery && bPhone !== lowerQuery) return -1;
        if (aPhone !== lowerQuery && bPhone === lowerQuery) return 1;

        // Starts with name match
        if (aName.startsWith(lowerQuery) && !bName.startsWith(lowerQuery)) return -1;
        if (!aName.startsWith(lowerQuery) && bName.startsWith(lowerQuery)) return 1;

        // Includes name match
        if (aName.includes(lowerQuery) && !bName.includes(lowerQuery)) return -1;
        if (!aName.includes(lowerQuery) && bName.includes(lowerQuery)) return 1;

        // Includes email or phone match
        const aIncludesOther = aEmail.includes(lowerQuery) || aPhone.includes(lowerQuery);
        const bIncludesOther = bEmail.includes(lowerQuery) || bPhone.includes(lowerQuery);
        if (aIncludesOther && !bIncludesOther) return -1;
        if (!aIncludesOther && bIncludesOther) return 1;

        return 0;
      });
    }

    if (results.length === 0) {
      source = "empty";
      SearchAnalyticsService.logZeroResults(rawQuery, "CustomerSearchEngine");
    }

    const duration = performance.now() - startTime;
    
    // Map Engine sources to SearchAnalyticsService keys
    let telemetrySource: any = "web_worker_thread";
    if (source === "memory") telemetrySource = "memory_cache";
    else if (source === "hybrid_api") telemetrySource = "web_worker_thread";
    else if (source === "firestore_fallback") telemetrySource = "firestore_prefetch";
    else if (source === "offline_degraded") telemetrySource = "indexeddb_cache";

    SearchAnalyticsService.logSearchPerformance(rawQuery, telemetrySource, duration, results.length);

    // Save into memoization cache
    if (results.length > 0 && normQuery.length >= 2) {
      this.memoryCache.set(normQuery, results);
      if (this.memoryCache.size > 200) {
        const oldestKey = this.memoryCache.keys().next().value;
        if (oldestKey) this.memoryCache.delete(oldestKey);
      }
    }

    return {
      results,
      source,
      latencyMs: Number(duration.toFixed(1)),
      apiFailed,
      firestoreFallbackUsed
    };
  }
}
