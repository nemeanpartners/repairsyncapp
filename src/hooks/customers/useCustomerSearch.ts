import { useState, useEffect, useCallback } from "react";
import { CustomerSearchEngine, NormalizedCustomer, normalizeCustomer } from "../../services/search/CustomerSearchEngine";

export type { NormalizedCustomer };
export { normalizeCustomer };

export function useCustomerSearch(initialQuery = "") {
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<NormalizedCustomer[]>([]);
  const [localRecentCustomers, setLocalRecentCustomers] = useState<NormalizedCustomer[]>([]);
  const [searchMethod, setSearchMethod] = useState<string>("none");

  // Load initial hot cache items
  useEffect(() => {
    let active = true;
    const fetchRecentPool = async () => {
      const pool = await CustomerSearchEngine.prepool();
      if (active) {
        setLocalRecentCustomers(pool.slice(0, 50));
      }
    };
    fetchRecentPool();
    return () => {
      active = false;
    };
  }, []);

  // Orchestrate timed debounce queries
  useEffect(() => {
    const term = searchQuery.trim();
    if (!term) {
      setSearchResults([]);
      setIsLoading(false);
      return;
    }

    const handler = setTimeout(async () => {
      setIsLoading(true);
      setError(null);

      try {
        const outcome = await CustomerSearchEngine.search(term);
        setSearchResults(outcome.results);
        setSearchMethod(outcome.source);
        if (outcome.apiFailed) {
          setError("API currently unresponsive. Operating in offline cached search mode.");
        }
      } catch (err: any) {
        console.error("[useCustomerSearch] Orchestrator subscription exception:", err);
        setError(err.message || "An error occurred during customer searching.");
      } finally {
        setIsLoading(false);
      }
    }, 400);

    return () => clearTimeout(handler);
  }, [searchQuery]);

  const selectCustomCustomer = useCallback((customerItem: NormalizedCustomer) => {
    CustomerSearchEngine.updateLocalContact(customerItem);
    setLocalRecentCustomers(prev => {
      const filtered = prev.filter(c => c.customerId !== customerItem.customerId);
      return [customerItem, ...filtered].slice(0, 50);
    });
  }, []);

  return {
    searchQuery,
    setSearchQuery,
    isLoading,
    error,
    searchResults: searchQuery.trim() ? searchResults : localRecentCustomers,
    localRecentCustomers,
    searchMethod,
    selectCustomCustomer,
  };
}
