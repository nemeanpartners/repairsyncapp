import React, { useRef, useEffect, useState } from "react";
import { useCustomerSearch, NormalizedCustomer } from "../../../hooks/customers/useCustomerSearch";
import { Search, Loader2, ChevronRight, Check, AlertCircle, Sparkles, Database, WifiOff } from "lucide-react";
import { DebouncedInput } from "../../../components/ui/debounced-input";
import { Badge } from "@/components/ui/badge";

interface CustomerSearchBoxProps {
  onSelectCustomer: (customer: NormalizedCustomer) => void;
  selectedCustomerId: string | null;
}

export function CustomerSearchBox({
  onSelectCustomer,
  selectedCustomerId,
}: CustomerSearchBoxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [keyboardIndex, setKeyboardIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<any>(null);

  const {
    searchQuery,
    setSearchQuery,
    isLoading,
    error,
    searchResults,
    searchMethod,
  } = useCustomerSearch();

  // Reset highlighted keyboard index when searchResults change
  useEffect(() => {
    if (searchResults.length > 0) {
      setKeyboardIndex(0);
    } else {
      setKeyboardIndex(-1);
    }
  }, [searchResults]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle key navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter") {
        setIsOpen(true);
      }
      return;
    }

    if (searchResults.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setKeyboardIndex(prev => {
        const next = Math.min(prev + 1, searchResults.length - 1);
        scrollIntoView(next);
        return next;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setKeyboardIndex(prev => {
        const next = Math.max(prev - 1, 0);
        scrollIntoView(next);
        return next;
      });
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (keyboardIndex >= 0 && keyboardIndex < searchResults.length) {
        const selected = searchResults[keyboardIndex];
        onSelectCustomer(selected);
        setIsOpen(false);
        setSearchQuery("");
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  // Map searching indicators
  const getSearchModeBadge = () => {
    switch (searchMethod) {
      case "memory":
        return (
          <Badge variant="outline" className="text-xs font-semibold uppercase tracking-wide bg-zinc-50 border-zinc-200 text-zinc-700 h-6 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-emerald-500 animate-pulse" /> Memory Cache Hot
          </Badge>
        );
      case "worker_fuzzy":
        return (
          <Badge variant="outline" className="text-xs font-semibold uppercase tracking-wide bg-emerald-50 border-emerald-100 text-emerald-700 h-6 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-emerald-500 animate-pulse" /> Off-Thread Fuzzy Worker
          </Badge>
        );
      case "hybrid_api":
        return (
          <Badge variant="outline" className="text-xs font-semibold uppercase tracking-wide bg-blue-50 border-blue-100 text-blue-700 h-6 flex items-center gap-1">
            <Database className="w-3 h-3 text-blue-500" /> Fuzzy API Search
          </Badge>
        );
      case "firestore_fallback":
        return (
          <Badge variant="outline" className="text-xs font-semibold uppercase tracking-wide bg-yellow-50 border-yellow-100 text-yellow-700 h-6 flex items-center gap-1">
            <Database className="w-3 h-3 text-yellow-500" /> Firestore Fallback
          </Badge>
        );
      case "offline_degraded":
        return (
          <Badge variant="outline" className="text-xs font-semibold uppercase tracking-wide bg-amber-50 border-amber-100 text-amber-700 h-6 flex items-center gap-1">
            <WifiOff className="w-3 h-3 text-amber-500" /> Local Offline Sync
          </Badge>
        );
      default:
        return null;
    }
  };

  // Keyboard navigation mapping
  const scrollIntoView = (index: number) => {
    const el = document.getElementById(`search-item-${index}`);
    if (el && listRef.current) {
      el.scrollIntoView({ block: 'nearest' });
    }
  };

  return (
    <div ref={containerRef} className="relative w-full space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wide pl-1">
            Search Contact Directory
          </label>
          <span className="text-[9px] text-zinc-400 font-extrabold bg-zinc-100 px-1.5 rounded uppercase tracking-wide">
            ↑↓ Nav
          </span>
        </div>
        {searchQuery.trim() && getSearchModeBadge()}
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 pointer-events-none" />
        <DebouncedInput
          placeholder="Search name, phone, email, business..."
          className="pl-12 h-14 rounded-2xl bg-zinc-100 border-none focus-visible:ring-0 focus-visible:border-zinc-300 text-base font-bold shadow-inner w-full"
          value={searchQuery}
          onChange={(v) => {
            setSearchQuery(v);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
        />
        {isLoading && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
          </div>
        )}
      </div>

      {isOpen && (searchResults.length > 0 || isLoading || error) && (
        <div className="absolute left-0 mt-2 w-full bg-white border border-zinc-100 shadow-2xl rounded-2xl max-h-[380px] overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
          {error && (
            <div className="p-3 bg-amber-50 text-amber-700 text-xs font-bold border-b border-amber-100 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {isLoading && searchResults.length === 0 ? (
            <div className="p-12 text-sm text-zinc-400 text-center font-bold flex flex-col items-center justify-center">
              <Loader2 className="w-7 h-7 animate-spin text-zinc-300 mb-3" />
              <span>Querying client indexes...</span>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="p-12 text-sm text-zinc-400 text-center font-bold">
              No matching records found.
            </div>
          ) : (
            <div className="py-2">
              <div 
                className="max-h-[300px] overflow-y-auto"
                ref={listRef} // Keeping the ref so keyboard navigation auto-scroll won't break if we adapt it or just let it be loosely coupled
              >
                {searchResults.map((item, index) => {
                  const isSelected = item.customerId === selectedCustomerId;
                  const isKeyboardFocused = index === keyboardIndex;

                  return (
                    <div
                      key={item.customerId || index}
                      id={`search-item-${index}`}
                      className={`flex items-center justify-between p-4 border-b border-zinc-100 cursor-pointer transition-colors ${
                        isSelected ? "bg-emerald-50/50 hover:bg-emerald-50" : ""
                      } ${isKeyboardFocused ? "bg-zinc-100 ring-1 ring-zinc-300 ring-inset" : "hover:bg-zinc-50"}`}
                      onClick={() => {
                        onSelectCustomer(item);
                        setIsOpen(false);
                        setSearchQuery("");
                      }}
                    >
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm text-zinc-900 truncate">
                            {item.firstName} {item.lastName}
                          </span>
                          {item.business_name && (
                            <Badge variant="secondary" className="text-[9px] font-bold uppercase tracking-wider bg-zinc-100 text-zinc-600 h-4 px-1.5 rounded">
                              {item.business_name}
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-zinc-500 font-bold mt-0.5 flex items-center gap-2 truncate">
                          {item.phone && <span>{item.phone}</span>}
                          {item.phone && item.email && <span>•</span>}
                          {item.email && <span className="truncate">{item.email}</span>}
                        </div>
                      </div>
                      <div className="flex items-center">
                        {isSelected ? (
                          <div className="bg-emerald-500 rounded-full p-1 text-white">
                            <Check className="w-3.5 h-3.5" />
                          </div>
                        ) : (
                          <ChevronRight className="w-4 h-4 text-zinc-300" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="p-2.5 bg-zinc-50 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-400 font-extrabold uppercase tracking-wide px-4">
                <span>Showing {searchResults.length} results</span>
                <span>Press Enter to select</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
