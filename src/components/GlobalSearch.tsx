import React, { useState, useEffect, useRef } from "react";
import { Search, Loader2, User, Ticket as TicketIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { SearchService } from "../services/search/SearchService";
import { useDebounce } from "../hooks/useDebounce";

export interface SearchResult {
  id: string;
  type: 'customer' | 'ticket';
  title: string;
  subtitle: string;
  data: any;
}

export function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    const saved = localStorage.getItem('recent_searches');
    try {
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const wrapperRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const addToRecent = (term: string) => {
    if (!term.trim()) return;
    const updated = [term, ...recentSearches.filter(s => s !== term)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem('recent_searches', JSON.stringify(updated));
  };

  const debouncedTerm = useDebounce(searchTerm, 300);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const performSearch = async () => {
      if (!debouncedTerm.trim()) {
        setResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      try {
        const { contacts, tickets } = await SearchService.globalSearch(debouncedTerm, { limit: 15, viewName: "GlobalSearchHeader" });
        
        const formatted: SearchResult[] = [
          ...contacts.map(c => ({
            id: c.id || c.customerId || c.uid,
            type: 'customer' as const,
            title: (c.firstname || c.lastname) ? `${c.firstname || ''} ${c.lastname || ''}`.trim() : c.business_name || 'Unnamed Contact',
            subtitle: c.business_name ? `${c.business_name} • ${c.email || c.phone || ''}` : (c.email || c.phone || c.mobile || ''),
            data: c
          })),
          ...tickets.map(t => ({
            id: t.id || t.customerId || t.uid,
            type: 'ticket' as const,
            title: t.subject || t.issueDescription || `Ticket #${t.number}`,
            subtitle: `Status: ${t.status || 'Active'} • #${t.number} • ${t.customer_name || 'No Customer'}`,
            data: t
          }))
        ];

        // Sort tickets to the top when search term has a hash followed/preceded by a number
        const hasHashAndNumber = /#\d+/.test(debouncedTerm) || (debouncedTerm.includes('#') && /\d+/.test(debouncedTerm));
        if (hasHashAndNumber) {
          formatted.sort((a, b) => {
            if (a.type === 'ticket' && b.type !== 'ticket') return -1;
            if (a.type !== 'ticket' && b.type === 'ticket') return 1;
            return 0;
          });
        }
        
        setResults(formatted.slice(0, 10));
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setIsSearching(false);
      }
    };

    performSearch();
  }, [debouncedTerm]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (item: SearchResult) => {
    setIsOpen(false);
    addToRecent(searchTerm);
    setSearchTerm("");
    if (item.type === "ticket") {
      navigate(`/tickets/${item.id}`);
    } else {
      navigate(`/customers/${item.id}`);
    }
  };

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <div className="relative group">
        <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400 group-focus-within:text-zinc-600 transition-colors" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search sequence (Ctrl+K)"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && results.length > 0) {
              handleSelect(results[0]);
            }
          }}
          className="w-full pl-10 pr-4 py-2.5 text-sm bg-zinc-50 border border-zinc-200 rounded-2xl focus:bg-white focus:border-zinc-300 focus:ring-4 focus:ring-zinc-100/50 transition-all outline-none placeholder:text-zinc-400 placeholder:font-medium"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 hidden md:flex items-center gap-1 opacity-40 group-focus-within:opacity-0 transition-opacity">
           <span className="text-xs font-semibold border border-zinc-300 px-1 rounded bg-white">CTRL</span>
           <span className="text-xs font-semibold border border-zinc-300 px-1 rounded bg-white">K</span>
        </div>
        {isSearching && (
          <Loader2 className="w-3 h-3 absolute right-3 top-1/2 transform -translate-y-1/2 text-zinc-400 animate-spin" />
        )}
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-zinc-200 overflow-hidden z-50">
          {!searchTerm.trim() && recentSearches.length > 0 ? (
            <div className="py-2">
               <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Recent Searches</div>
               {recentSearches.map((term, i) => (
                 <div 
                   key={i} 
                   onClick={() => setSearchTerm(term)}
                   className="px-4 py-2 hover:bg-zinc-50 cursor-pointer flex items-center justify-between group"
                 >
                    <span className="text-sm text-zinc-600 font-medium">{term}</span>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        const next = recentSearches.filter(s => s !== term);
                        setRecentSearches(next);
                        localStorage.setItem('recent_searches', JSON.stringify(next));
                      }}
                      className="opacity-0 group-hover:opacity-100 text-xs text-zinc-400 hover:text-red-500"
                    >
                      Remove
                    </button>
                 </div>
               ))}
            </div>
          ) : searchTerm.trim() && (
            <>
              {results.length > 0 ? (
                <div className="max-h-[60vh] overflow-y-auto py-2 scrollbar-thin">
                  {results.map((item) => (
                    <div
                      key={`${item.type}-${item.id}`}
                      onClick={() => handleSelect(item)}
                      className="px-4 py-3 hover:bg-zinc-50 cursor-pointer flex flex-col border-b border-zinc-50 last:border-0"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 truncate pr-2">
                           {item.type === 'ticket' ? <TicketIcon className="w-3.5 h-3.5 text-zinc-400 shrink-0" /> : <User className="w-3.5 h-3.5 text-zinc-400 shrink-0" />}
                           <span className="font-semibold text-sm text-zinc-900 truncate">
                             {item.title}
                           </span>
                        </div>
                        {item.type === 'ticket' && item.data.number && (
                          <span className="text-xs font-semibold font-mono bg-zinc-100 px-1.5 py-0.5 rounded text-zinc-500 shrink-0">
                            #{item.data.number}
                          </span>
                        )}
                        {item.type === 'customer' && (
                          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-300">Contact</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-zinc-500 ml-5">
                        <span className="truncate">{item.subtitle}</span>
                        {item.type === 'ticket' && item.data.status && (
                          <>
                            <span className="text-zinc-300">•</span>
                            <span className="uppercase tracking-wide text-[9px] font-bold">{item.data.status}</span>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : !isSearching ? (
                <div className="px-4 py-8 text-center text-sm text-zinc-500">
                  No results found matching "{searchTerm}"
                </div>
              ) : (
                <div className="px-4 py-8 text-center text-sm text-zinc-400 italic">
                   Searching...
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
