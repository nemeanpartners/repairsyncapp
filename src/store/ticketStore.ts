import { create } from 'zustand';

interface TicketState {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  // This will store tickets being viewed or cached
  cachedTickets: Record<string, any>;
  setCachedTickets: (tickets: any[]) => void;
  addCachedTicket: (ticket: any) => void;
  updateCachedTicket: (id: string, updates: any) => void;
}

export const useTicketStore = create<TicketState>((set) => ({
  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),
  cachedTickets: {},
  setCachedTickets: (tickets) => set((state) => {
    const newCache = { ...state.cachedTickets };
    tickets.forEach(t => newCache[t.id] = t);
    return { cachedTickets: newCache };
  }),
  addCachedTicket: (ticket) => set((state) => ({
    cachedTickets: { ...state.cachedTickets, [ticket.id]: ticket }
  })),
  updateCachedTicket: (id, updates) => set((state) => ({
    cachedTickets: {
      ...state.cachedTickets,
      [id]: { ...state.cachedTickets[id], ...updates }
    }
  }))
}));
