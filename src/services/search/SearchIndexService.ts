/**
 * RepairSync Enterprise Search Indexing Service
 * Coordinates pre-normalized indexing fields (lowercase fields, token stripping, IMEITokens)
 * and incremental hydration of caches (Firestore to IndexedDB to Web Worker).
 */

import { Firestore, collection, getDocs, query, limit, orderBy } from "firebase/firestore";
import { SearchCacheService } from "./SearchCacheService";
import { SearchWorkerService } from "./SearchWorkerService";

export class SearchIndexService {
  /**
   * Generates exact, lowercased, whitespace-stripped normalization for quick comparison keys.
   */
  static normalize(str: string): string {
    if (!str) return "";
    return str.toLowerCase().trim();
  }

  /**
   * Strips all non-digit characters from direct dials to enable index-friendly prefix matches.
   */
  static stripPhoneNum(phone: string): string {
    if (!phone) return "";
    return phone.replace(/\D/g, "");
  }

  /**
   * Cuts text into precise prefix searchable array chunks etc.
   */
  static getSearchTokens(data: any): string[] {
    const tokens = new Set<string>();
    
    const targetFields = [
      data.firstname,
      data.lastname,
      data.business_name,
      data.email,
      data.phone,
      data.mobile,
      data.device_serial,
      data.device_imei,
      data.number?.toString()
    ];

    targetFields.forEach(f => {
      if (f) {
        const val = this.normalize(String(f));
        // Split by standard delineators
        val.split(/[\s\-_.\/@]+/).forEach(token => {
          if (token.length > 0) {
            tokens.add(token);
          }
        });
        // Extra digits concatenation for numbers
        if (val.match(/\d/)) {
          tokens.add(val.replace(/\s+/g, ""));
        }
      }
    });

    return Array.from(tokens);
  }

  /**
   * Pre-generates normalizations dictionary ready for Firestore database transactions.
   */
  static prepareCustomerIndexData(data: any) {
    const firstName = this.normalize(data.firstname || "");
    const lastName = this.normalize(data.lastname || "");
    const email = this.normalize(data.email || "");
    const parentNotes = this.normalize(data.notes || "");
    const bName = this.normalize(data.business_name || "");

    return {
      lowercaseName: `${firstName} ${lastName}`.trim(),
      lowercaseEmail: email,
      strippedPhone: this.stripPhoneNum(data.mobile || data.phone || ""),
      searchableTerms: this.getSearchTokens(data),
      searchContent: [firstName, lastName, bName, email, parentNotes].join(" ").trim()
    };
  }

  /**
   * Pre-generates normalizations for diagnostic tickets.
   */
  static prepareTicketIndexData(data: any) {
    const sub = this.normalize(data.subject || "");
    const num = data.number?.toString() || "";
    const imei = this.stripPhoneNum(data.device_imei || "");
    const ser = this.normalize(data.device_serial || "");
    const desc = this.normalize(data.issueDescription || "");
    const cName = this.normalize(data.customer_name || "");

    return {
      ticketTokens: this.getSearchTokens(data),
      deviceTokens: ser.split(/[\s\-_.]+/).filter(Boolean),
      IMEITokens: imei ? [imei] : []
    };
  }

  /**
   * Background process that primes local stores using records from Firestore,
   * then updates the Search Cache database and warms the Web Worker thread cache.
   */
  static async warmGlobalSearchIndexes(db: Firestore): Promise<void> {
    try {
      console.log("[SearchIndexService] Warming search indexes...");

      // 1. Double check cached metadata values to evaluate full vs partial synchronization loads
      const meta = await SearchCacheService.get("metadata", "sync_metadata");
      let cachedContacts = await SearchCacheService.getAll("contacts");
      let cachedTickets = await SearchCacheService.getAll("tickets");

      const cacheIsCold = cachedContacts.length === 0 && cachedTickets.length === 0;

      // Limit initial pre-population scopes to prevent document load spikes in firestore
      if (cacheIsCold) {
        console.log("[SearchIndexService] Cache is cold. Hydrating from Firestore collection windows...");

        // Fire parallel shallow reads with tight limit clauses to prevent massive Firestore read overhead
        const [contactsSnap, crmTicketsSnap, newTicketsSnap] = await Promise.all([
          getDocs(query(collection(db, "crm_customers"), orderBy("updated_at", "desc"), limit(100))),
          getDocs(query(collection(db, "crm_tickets"), orderBy("created_at", "desc"), limit(100))),
          getDocs(query(collection(db, "tickets"), orderBy("created_at", "desc"), limit(100)))
        ]);

        const pulledContacts = contactsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const pulledTickets = [...crmTicketsSnap.docs.map(d => ({ id: d.id, ...d.data() })), ...newTicketsSnap.docs.map(d => ({ id: d.id, ...d.data() }))];

        // Commit fetched sets to local IndexedDB
        if (pulledContacts.length > 0) {
          await SearchCacheService.putMany("contacts", pulledContacts);
          cachedContacts = pulledContacts;
        }

        if (pulledTickets.length > 0) {
          await SearchCacheService.putMany("tickets", pulledTickets);
          cachedTickets = pulledTickets;
        }

        // Save progress indicators
        await SearchCacheService.put("metadata", "sync_metadata", {
          key: "sync_metadata",
          lastSyncedAt: new Date().toISOString(),
          totalRecordsFetched: pulledContacts.length + pulledTickets.length
        });
      }

      // 2. Hydrate the background fuzzy worker space
      SearchWorkerService.initWorker(cachedContacts, cachedTickets);

      console.log(`[SearchIndexService] Search indexes warmed. Contacts: ${cachedContacts.length}, Tickets: ${cachedTickets.length}`);
    } catch (e) {
      console.error("[SearchIndexService] Index priming crashed:", e);
    }
  }

  /**
   * Smoothly synchronizes single modified items without triggering index recalculation storms.
   */
  static async recordModified(item: any, itemType: "contacts" | "tickets"): Promise<void> {
    try {
      // 1. Commit modifications into IndexedDB
      await SearchCacheService.put(itemType, item.id, item);

      // 2. Incremental update across to the Worker thread space
      SearchWorkerService.updateStoredIndices([item], itemType);
    } catch (e) {
      console.error("[SearchIndexService] Record update exception:", e);
    }
  }

  /**
   * Synchronizes delete transactions across to worker state pools.
   */
  static async recordDeleted(id: string, itemType: "contacts" | "tickets"): Promise<void> {
    try {
      await SearchCacheService.delete(itemType, id);
      SearchWorkerService.deleteStoredIndex(id, itemType);
    } catch (e) {
      console.error("[SearchIndexService] Record deleting failure:", e);
    }
  }
}
