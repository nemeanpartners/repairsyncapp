import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Users, Search, Plus, Phone, Mail, Loader2, ArrowLeft, ArrowUpDown, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate, useLocation } from "react-router-dom";
import { useCustomerSearch } from "../../hooks/customers/useCustomerSearch";
import { NewCustomerModal } from "../../features/customers/components/NewCustomerModal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getCountFromServer, collection } from "firebase/firestore";
import { db } from "../../firebase";

export function CustomerListView() {
  const navigate = useNavigate();
  const location = useLocation();
  const { searchQuery, setSearchQuery, isLoading, searchResults } = useCustomerSearch("");
  const [isNewCustomerModalOpen, setIsNewCustomerModalOpen] = useState(false);
  const [sortBy, setSortBy] = useState<string>("alphabetical"); // alphabetical, lastName, email, phone
  const [totalCount, setTotalCount] = useState<number | null>(null);

  useEffect(() => {
    getCountFromServer(collection(db, "crm_customers"))
      .then(snap => setTotalCount(snap.data().count))
      .catch(console.error);
  }, []);

  // Handle scroll to hash
  useEffect(() => {
    if (location.hash && !isLoading && searchResults.length > 0) {
      setTimeout(() => {
        const id = location.hash.replace('#', '');
        const el = document.getElementById(id);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300);
    }
  }, [location.hash, isLoading, searchResults.length]);

  const sortedCustomers = useMemo(() => {
    if (!searchResults) return [];
    return [...searchResults].sort((a, b) => {
      if (sortBy === 'alphabetical') {
        const nameA = (a.business_then_name || a.fullname || `${a.firstname || ''} ${a.lastname || ''}`).trim().toLowerCase();
        const nameB = (b.business_then_name || b.fullname || `${b.firstname || ''} ${b.lastname || ''}`).trim().toLowerCase();
        return nameA.localeCompare(nameB);
      }
      if (sortBy === 'lastName') {
        const nameA = (a.lastname || a.fullname?.split(' ').pop() || '').toLowerCase();
        const nameB = (b.lastname || b.fullname?.split(' ').pop() || '').toLowerCase();
        return nameA.localeCompare(nameB);
      }
      if (sortBy === 'email') {
        const emailA = (a.email || '').toLowerCase();
        const emailB = (b.email || '').toLowerCase();
        return emailA.localeCompare(emailB);
      }
      if (sortBy === 'phone') {
        const phoneA = (a.phone || a.mobile || '').toLowerCase();
        const phoneB = (b.phone || b.mobile || '').toLowerCase();
        return phoneA.localeCompare(phoneB);
      }
      return 0;
    });
  }, [searchResults, sortBy]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  if (isLoading && sortedCustomers.length === 0) {
    return (
      <div className="flex flex-col h-full bg-white w-full">
        <div className="px-4 md:px-8 py-4 md:py-5 border-b border-zinc-200">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-zinc-900">Customers</h1>
        </div>
        <div className="p-8 text-center text-zinc-500 flex flex-col items-center justify-center flex-1">
          <Loader2 className="w-8 h-8 opacity-40 animate-spin mb-3 text-emerald-600" />
          <p className="font-semibold text-sm">Loading customers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white w-full">
      <div className="px-4 md:px-8 py-4 md:py-5 border-b border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
           <div className="flex items-center gap-3">
             <h1 className="text-xl md:text-2xl font-bold tracking-tight text-zinc-900">Customers</h1>
             {totalCount !== null && (
               <span className="bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-md text-xs font-semibold border border-zinc-200 shadow-sm">
                 {totalCount.toLocaleString()} total
               </span>
             )}
           </div>
           <p className="text-zinc-500 text-sm mt-1">Manage and track your customer directory</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
             <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400" />
              <input
               type="text"
               placeholder="Search customers..."
               value={searchQuery}
               onChange={handleSearchChange}
               className="w-full pl-9 pr-10 py-2 md:py-1.5 text-sm bg-zinc-100 border-none rounded-lg focus:bg-white focus:ring-0 focus:border-zinc-300 transition-colors outline-none"
             />
             {isLoading && <Loader2 className="w-4 h-4 absolute right-3 top-1/2 transform -translate-y-1/2 text-zinc-400 animate-spin" />}
          </div>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[180px] hidden sm:flex">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Sort customers" />
            </SelectTrigger>
            <SelectContent>
               <SelectItem value="alphabetical">First Name (A-Z)</SelectItem>
               <SelectItem value="lastName">Last Name (A-Z)</SelectItem>
               <SelectItem value="email">Email address</SelectItem>
               <SelectItem value="phone">Phone number</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => setIsNewCustomerModalOpen(true)} className="bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm hidden sm:flex">
             <Plus className="w-4 h-4 mr-2" /> Add Customer
          </Button>
        </div>
      </div>
      
      <div className="p-4 md:p-8 flex-none min-h-max bg-zinc-50/50 pb-20 md:pb-8 flex flex-col">
        <div className="max-w-6xl mx-auto bg-white border border-zinc-200 shadow-sm rounded-2xl overflow-hidden flex-none w-full flex flex-col">
           {sortedCustomers.length > 0 ? (
             <div className="flex-none w-full divide-y divide-zinc-100">
                {sortedCustomers.map((c, index) => {
                  if (!c) return null;
                  return (
                    <div 
                      id={`customer-${c.id}`}
                      key={c.id || index}
                      onClick={() => navigate(`/customers/${c.id}`)} 
                      className="px-6 py-4 flex items-center justify-between hover:bg-zinc-50 border-b border-zinc-100 transition-colors cursor-pointer group select-none"
                    >
                       <div className="flex items-center gap-4 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm shrink-0">
                             {c.firstname ? c.firstname.charAt(0).toUpperCase() : (c.business_name ? c.business_name.charAt(0).toUpperCase() : <Users className="w-4 h-4" />)}
                          </div>
                          <div className="min-w-0">
                             <p className="font-semibold text-zinc-900 text-sm group-hover:text-blue-600 transition-colors truncate">
                               {c.business_then_name || c.fullname || `${c.firstname || ''} ${c.lastname || ''}`.trim() || c.business_name || "Unnamed Customer"}
                             </p>
                             {(c.firstname || c.lastname) && c.business_name && (
                                <p className="text-xs text-zinc-500 truncate">{c.firstname} {c.lastname}</p>
                             )}
                          </div>
                       </div>
                       
                       <div className="md:flex hidden items-center gap-8 text-sm text-zinc-500 shrink-0">
                          {c.phone || c.mobile ? (
                             <div className="flex items-center gap-2">
                               <Phone className="w-3.5 h-3.5 text-zinc-400" />
                               {c.phone || c.mobile}
                             </div>
                          ) : null}
                          {c.email ? (
                             <div className="flex items-center gap-2 w-48 truncate">
                               <Mail className="w-3.5 h-3.5 text-zinc-400" />
                               <span className="truncate">{c.email}</span>
                             </div>
                          ) : null}
                       </div>
                    </div>
                  );
                })}
             </div>
           ) : !isLoading ? (
              <div className="p-12 text-center text-zinc-500 flex flex-col items-center justify-center h-full">
                 <Users className="w-8 h-8 opacity-20 mb-3" />
                 <p className="font-semibold text-sm">No customers found.</p>
              </div>
           ) : (
              <div className="p-12 text-center text-zinc-500 flex flex-col items-center justify-center h-full">
                 <Loader2 className="w-8 h-8 opacity-20 animate-spin mb-3" />
                 <p className="font-semibold text-sm">Searching customer index...</p>
              </div>
           )}
        </div>
      </div>

      {isNewCustomerModalOpen && (
         <NewCustomerModal
           isOpen={isNewCustomerModalOpen}
           onOpenChange={setIsNewCustomerModalOpen}
         />
      )}
    </div>
  );
}
