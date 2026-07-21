/**
 * RepairSync Enterprise IndexedDB Cache Service
 * Provides stale-while-revalidate, local persistence, background synchronization logs,
 * and high-durability fail-safe memory structures for restricted iframe boundaries.
 */

export interface CacheMetadata {
  lastSyncedAt: string;
  totalRecordsFetched: number;
}

export class SearchCacheService {
  private static DB_NAME = "repairsync_search_cache";
  private static DB_VERSION = 1;
  private static memFallback = new Map<string, Map<string, any>>();
  private static isIndexedDBSupported = typeof window !== "undefined" && !!window.indexedDB;

  /**
   * Initializes the IndexedDB tables safely.
   */
  static initDb(): Promise<IDBDatabase | null> {
    if (!this.isIndexedDBSupported) {
      console.warn("[SearchCacheService] IndexedDB not available. Falling back to high-durability in-memory caches.");
      return Promise.resolve(null);
    }

    return new Promise((resolve) => {
      try {
        const request = window.indexedDB.open(this.DB_NAME, this.DB_VERSION);

        request.onupgradeneeded = (event: any) => {
          const db = event.target.result;
          // Create object stores for search segments if they do not exist
          if (!db.objectStoreNames.contains("contacts")) {
            db.createObjectStore("contacts", { keyPath: "id" });
          }
          if (!db.objectStoreNames.contains("tickets")) {
            db.createObjectStore("tickets", { keyPath: "id" });
          }
          if (!db.objectStoreNames.contains("conversations")) {
            db.createObjectStore("conversations", { keyPath: "id" });
          }
          if (!db.objectStoreNames.contains("recent_searches")) {
            db.createObjectStore("recent_searches", { keyPath: "query" });
          }
          if (!db.objectStoreNames.contains("metadata")) {
            db.createObjectStore("metadata", { keyPath: "key" });
          }
        };

        request.onsuccess = (event: any) => {
          resolve(event.target.result);
        };

        request.onerror = (err) => {
          console.error("[SearchCacheService] Database failed to initialize:", err);
          resolve(null);
        };
      } catch (e) {
        console.error("[SearchCacheService] Synchronous database failure:", e);
        resolve(null);
      }
    });
  }

  /**
   * Puts raw values directly inside a specified cache table. All methods support high-resiliency fallbacks.
   */
  static async put(storeName: "contacts" | "tickets" | "conversations" | "recent_searches" | "metadata", key: string, value: any): Promise<void> {
    const db = await this.initDb();
    if (!db) {
      if (!this.memFallback.has(storeName)) {
        this.memFallback.set(storeName, new Map());
      }
      this.memFallback.get(storeName)!.set(key, value);
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(storeName, "readwrite");
        const store = transaction.objectStore(storeName);
        const obj = storeName === "recent_searches" || storeName === "metadata" ? value : { ...value, id: key };
        
        const request = store.put(obj);

        request.onsuccess = () => resolve();
        request.onerror = (event: any) => {
          console.error(`[SearchCacheService] Put target failed in store "${storeName}":`, event.target.error);
          reject(event.target.error);
        };
      } catch (e) {
        reject(e);
      }
    });
  }

  /**
   * Sync writes bulk records atomically into the IndexedDB store.
   */
  static async putMany(storeName: "contacts" | "tickets" | "conversations", items: any[]): Promise<void> {
    const db = await this.initDb();
    if (!db) {
      if (!this.memFallback.has(storeName)) {
        this.memFallback.set(storeName, new Map());
      }
      const storage = this.memFallback.get(storeName)!;
      items.forEach(itm => storage.set(itm.id, itm));
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(storeName, "readwrite");
        const store = transaction.objectStore(storeName);

        items.forEach(item => {
          store.put(item);
        });

        transaction.oncomplete = () => resolve();
        transaction.onerror = (event: any) => {
          console.error(`[SearchCacheService] putMany transaction error in store "${storeName}":`, event.target.error);
          reject(event.target.error);
        };
      } catch (e) {
        reject(e);
      }
    });
  }

  /**
   * Resolves a stored database record instantly.
   */
  static async get(storeName: "contacts" | "tickets" | "conversations" | "recent_searches" | "metadata", key: string): Promise<any> {
    const db = await this.initDb();
    if (!db) {
      return this.memFallback.get(storeName)?.get(key) || null;
    }

    return new Promise((resolve) => {
      try {
        const transaction = db.transaction(storeName, "readonly");
        const store = transaction.objectStore(storeName);
        const request = store.get(key);

        request.onsuccess = (event: any) => resolve(event.target.result || null);
        request.onerror = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
  }

  /**
   * Pulls all stored records.
   */
  static async getAll(storeName: "contacts" | "tickets" | "conversations" | "recent_searches" | "metadata"): Promise<any[]> {
    const db = await this.initDb();
    if (!db) {
      const storage = this.memFallback.get(storeName);
      if (!storage) return [];
      return Array.from(storage.values());
    }

    return new Promise((resolve) => {
      try {
        const transaction = db.transaction(storeName, "readonly");
        const store = transaction.objectStore(storeName);
        const request = store.getAll();

        request.onsuccess = (event: any) => resolve(event.target.result || []);
        request.onerror = () => resolve([]);
      } catch (e) {
        resolve([]);
      }
    });
  }

  /**
   * Deletes a cached document reference.
   */
  static async delete(storeName: "contacts" | "tickets" | "conversations" | "recent_searches" | "metadata", key: string): Promise<void> {
    const db = await this.initDb();
    if (!db) {
      this.memFallback.get(storeName)?.delete(key);
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(storeName, "readwrite");
        const store = transaction.objectStore(storeName);
        const request = store.delete(key);

        request.onsuccess = () => resolve();
        request.onerror = (event: any) => reject(event.target.error);
      } catch (e) {
        reject(e);
      }
    });
  }

  /**
   * Cleans an entire store space.
   */
  static async clear(storeName: "contacts" | "tickets" | "conversations" | "recent_searches" | "metadata"): Promise<void> {
    const db = await this.initDb();
    if (!db) {
      this.memFallback.get(storeName)?.clear();
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(storeName, "readwrite");
        const store = transaction.objectStore(storeName);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = (event: any) => reject(event.target.error);
      } catch (e) {
        reject(e);
      }
    });
  }

  /**
   * Dynamic custom implementation of the stale-while-revalidate design layout.
   * Returns locally cached records immediately while fetching fresh data in the background.
   */
  static async staleWhileRevalidate<T>(
    storeName: "contacts" | "tickets" | "conversations",
    key: string,
    fetchFreshValue: () => Promise<T>,
    onUpdate: (freshData: T) => void
  ): Promise<T | null> {
    // 1. Instantly return locally cached record if it exists
    const cached = await this.get(storeName, key);
    
    // 2. Perform background synchronization immediately
    fetchFreshValue()
      .then((fresh) => {
        if (fresh) {
          this.put(storeName, key, fresh);
          onUpdate(fresh);
        }
      })
      .catch((err) => {
        console.error(`[SearchCacheService] Stale-While-Revalidate refresh failure for key: ${key}`, err);
      });

    return cached as T;
  }
}
