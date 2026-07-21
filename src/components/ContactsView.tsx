import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, limit, deleteDoc, doc, addDoc, getCountFromServer, startAfter, getDocs } from 'firebase/firestore';
import { Search, Plus, RefreshCw, Zap, Trash2, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { DebouncedInput } from '@/components/ui/debounced-input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import axios from 'axios';
import { toast } from 'sonner';
import { normalizeString, stripPhone, generateSearchableString } from '../lib/search-utils';
import { SearchIndexService } from '../services/search/SearchIndexService';
import { CustomerSearchEngine } from '../services/search/CustomerSearchEngine';
import { ContactRow } from '../features/customers/components/ContactRow';
import { CustomerDuplicateMergeTool } from '../features/customers/components/CustomerDuplicateMergeTool';

export const ContactsView = ({ onNavigate, onSelectContact }: { onNavigate: (view: string, id?: string) => void; onSelectContact?: (contact: any) => void }) => {
  const [contacts, setContacts] = useState<any[]>([]);
  const [totalContacts, setTotalContacts] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [showDedupConfirm, setShowDedupConfirm] = useState(false);
  const [lastVisible, setLastVisible] = useState<any>(null);
  
  const [isAddContactOpen, setIsAddContactOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState<{
    key: 'firstname' | 'updated_at' | 'created_at';
    direction: 'asc' | 'desc';
  }>({
    key: 'updated_at',
    direction: 'desc'
  });

  const [newContactData, setNewContactData] = useState({
    firstname: '',
    lastname: '',
    email: '',
    phone: '',
    mobile: ''
  });

  const pollIntervalRef = React.useRef<NodeJS.Timeout | null>(null);

  const startPolling = () => {
    if (pollIntervalRef.current) return;
    setIsSyncing(true);
    pollIntervalRef.current = setInterval(async () => {
      try {
        const statusRes = await axios.get('/api/repairshopr/migrate/status');
        const data = statusRes.data;
        
        if (data.status === 'completed') {
          setIsSyncing(false);
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
          toast.success("Migration complete!", { description: `Synced ${data.counts.customers} customers/contacts and ${data.counts.tickets} tickets.` });
          fetchContacts();
        } else if (data.status === 'error') {
          setIsSyncing(false);
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
          toast.error("Migration failed", { description: data.error });
        }
      } catch (e) {
        console.error("Poll error", e);
      }
    }, 5000);

    setTimeout(() => {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
    }, 3600000);
  };
  
  useEffect(() => {
      const checkInitialSync = async () => {
          try {
              const statusRes = await axios.get('/api/repairshopr/migrate/status');
              if (statusRes.data.status !== 'idle' && statusRes.data.status !== 'completed' && statusRes.data.status !== 'error') {
                  startPolling();
              }
          } catch (e) {}
      };
      checkInitialSync();
      return () => {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      }
  }, []);

  const syncRepairShoprContacts = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    toast.info("Migration started on server!", { duration: 5000 });

    try {
      await axios.post('/api/repairshopr/migrate');
      startPolling();
    } catch (e: any) {
      console.error("Sync failed to start", e);
      toast.error('Sync failed to start', { description: e.response?.data?.error || e.message });
      setIsSyncing(false);
    }
  };

  const fetchContacts = async (append = false) => {
    setLoading(true);
    try {
      if (totalContacts === null) {
        try {
          const countSnap = await getCountFromServer(collection(db, 'crm_customers'));
          const c = countSnap.data().count;
          setTotalContacts(c);
        } catch (e) {}
      }

      let results: any[] = [];
      let newLastVisible = null;

      if (debouncedSearch.trim()) {
        const searchOutcome = await CustomerSearchEngine.search(debouncedSearch.trim(), 100);
        results = searchOutcome.results;
      } else {
         let q;
         if (append && lastVisible) {
           q = query(collection(db, 'crm_customers'), orderBy(sortConfig.key, sortConfig.direction), startAfter(lastVisible), limit(50));
         } else {
           q = query(collection(db, 'crm_customers'), orderBy(sortConfig.key, sortConfig.direction), limit(50));
         }
         
         const snapshot = await getDocs(q);
         newLastVisible = snapshot.docs[snapshot.docs.length - 1] || null;
         results = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
      }

      if (append && !debouncedSearch.trim()) {
        setContacts(prev => [...prev, ...results]);
      } else {
        setContacts(results);
      }
      
      if (!debouncedSearch.trim()) {
         setLastVisible(newLastVisible);
      }
    } catch (e) {
      console.error("Failed to fetch contacts", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    fetchContacts();
  }, [debouncedSearch, sortConfig]);

  const toggleSelect = useCallback((id: string, checked: boolean) => {
    setSelectedIds(prev => checked ? [...prev, id] : prev.filter(i => i !== id));
  }, []);

  const [isRebuilding, setIsRebuilding] = useState(false);
  const [rebuildProgress, setRebuildProgress] = useState(0);

  const rebuildSearchIndex = async () => {
    setIsRebuilding(true);
    setRebuildProgress(0);
    try {
      const { performIndexRebuild } = await import('../lib/search-utils');
      await performIndexRebuild(db, (progress) => {
        setRebuildProgress(progress);
      });
      
      toast.success("Search index rebuilt successfully!");
      fetchContacts();
    } catch (e: any) {
      console.error("Rebuild failed", e);
      toast.error("Failed to rebuild search index");
    } finally {
      setIsRebuilding(false);
      setRebuildProgress(0);
    }
  };

  const handleDeleteSelected = async () => {
    setIsDeleting(true);
    setIsDeleteDialogOpen(false);
    try {
      await Promise.all(selectedIds.map(async (id) => {
        await deleteDoc(doc(db, 'crm_customers', id));
        await SearchIndexService.recordDeleted(id, 'contacts');
      }));
      toast.success(`${selectedIds.length} contact(s) deleted successfully`);
      setSelectedIds([]);
      fetchContacts();
    } catch (e: any) {
      console.error("Failed to delete contacts", e);
      toast.error('Failed to delete contacts');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContactData.firstname) {
      toast.error('First name is required');
      return;
    }
    
    try {
      const data = {
        ...newContactData,
        normalizedName: normalizeString(`${newContactData.firstname} ${newContactData.lastname}`),
        strippedPhone: stripPhone(newContactData.mobile || newContactData.phone),
        searchContent: generateSearchableString(newContactData),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      const docRef = await addDoc(collection(db, 'crm_customers'), data);
      await SearchIndexService.recordModified({ id: docRef.id, ...data }, 'contacts');
      toast.success('Contact added successfully');
      setIsAddContactOpen(false);
      setNewContactData({ firstname: '', lastname: '', email: '', phone: '', mobile: '' });
      fetchContacts();
    } catch (e: any) {
      console.error("Failed to add contact", e);
      toast.error('Failed to add contact');
    }
  };

  return (
    <section className="flex-1 flex flex-col glass-panel min-h-0 bg-white">
      <div className="p-3 md:p-4 border-b border-zinc-200 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold tracking-tight text-zinc-900">Contacts</h2>
            {!loading && totalContacts !== null && (
              <span className="bg-zinc-100 text-zinc-500 text-xs font-semibold px-2 py-0.5 rounded border border-zinc-200">
                {totalContacts.toLocaleString()}
              </span>
            )}
          </div>
        </div>

        <div className="w-full flex flex-col lg:flex-row gap-3 items-start lg:items-center">
          <div className="relative w-full lg:w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
            <DebouncedInput 
               placeholder="Search people, phone or email..."
               className="pl-9 bg-zinc-100 border-none h-10 text-xs font-bold rounded-xl focus:ring-0 focus:border-zinc-300 w-full"
               value={searchQuery}
               onChange={v => setSearchQuery(v)}
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto lg:ml-auto">
            <Button onClick={() => setIsAddContactOpen(true)} size="sm" variant="outline" className="h-9 px-3 text-xs font-medium bg-white text-zinc-700">
              <Plus className="w-3 h-3 mr-1.5" />
              Add
            </Button>
            <Button variant="outline" size="sm" onClick={syncRepairShoprContacts} disabled={isSyncing} className="h-9 px-3 text-xs font-medium bg-white text-zinc-700">
              <RefreshCw className={`w-3 h-3 mr-1.5 ${isSyncing ? 'animate-spin' : ''}`} />
              Sync
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowDedupConfirm(true)} className="h-9 px-3 text-xs font-medium bg-white text-red-500">
              De-dup
            </Button>
            <Button 
              variant="default" 
              size="sm" 
              onClick={rebuildSearchIndex} 
              disabled={isRebuilding} 
              className={`h-9 px-4 text-xs font-medium shadow-md transition-all ${isRebuilding ? 'bg-blue-100 text-blue-700' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
            >
              <Zap className={`w-3 h-3 mr-1.5 ${isRebuilding ? 'animate-pulse' : ''}`} />
              {isRebuilding ? `Indexing ${rebuildProgress}%` : 'Fix Search Index'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setIsDeleteDialogOpen(true)} disabled={isDeleting || selectedIds.length === 0} className="h-9 w-9 p-0 text-red-500 hover:bg-red-50">
              <Trash2 className="w-4 h-4" />
            </Button>
            
            <div className="w-[140px]">
              <Select
                value={`${sortConfig.key}-${sortConfig.direction}`}
                onValueChange={(val) => {
                  const [key, direction] = val.split('-') as [any, any];
                  setSortConfig({ key, direction });
                }}
              >
                <SelectTrigger className="h-9 w-full text-xs font-semibold uppercase tracking-wide bg-zinc-50 border-zinc-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="firstname-asc">Name (A-Z)</SelectItem>
                  <SelectItem value="firstname-desc">Name (Z-A)</SelectItem>
                  <SelectItem value="updated_at-desc">Recent Activity</SelectItem>
                  <SelectItem value="created_at-desc">Newest Added</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex-1 min-h-0 relative">
        <div className="flex items-center px-3 py-2 bg-zinc-50 border-b border-zinc-200 text-xs font-medium text-zinc-400 uppercase tracking-wide sticky top-0 z-10 w-full">
          <div className="w-[48px] shrink-0">
             <Checkbox
                checked={selectedIds.length === contacts.length && contacts.length > 0}
                onCheckedChange={(checked) => setSelectedIds(checked ? contacts.map(c => c.id) : [])}
                className="w-4 h-4"
              />
          </div>
          <div className="flex-1 pr-4">Customer Name</div>
          <div className="hidden lg:block flex-1 pr-4">Contact Details</div>
          <div className="w-[100px] md:w-[150px] text-right pr-4">Action</div>
        </div>

        <div className="h-full w-full">
           {loading && contacts.length === 0 ? (
              <div className="p-20 flex flex-col items-center justify-center text-zinc-400 gap-4">
                 <Loader2 className="w-10 h-10 animate-spin" />
                 <p className="text-sm font-bold uppercase tracking-wide">Warming Search Index...</p>
              </div>
           ) : contacts.length === 0 ? (
              <div className="p-20 text-center flex flex-col items-center justify-center opacity-40">
                 <Search className="w-12 h-12 mb-4 text-zinc-200" />
                 <p className="text-lg font-bold text-zinc-500">No matches found</p>
                 <p className="text-xs uppercase tracking-wide mt-2 text-zinc-400">Try a different name or number</p>
              </div>
            ) : (
             <div className="h-full w-full overflow-y-auto  relative">
               {contacts.map((contact, index) => (
                 <div key={contact.id || contact.customerId || index} className="w-full absolute" style={{ top: index * 64, height: 64 }}>
                   <ContactRow 
                     index={index}
                     style={{}}
                     contact={contact}
                     
                     isSelected={selectedIds.includes(contact.id || contact.customerId)}
                     onToggleSelect={toggleSelect}
                     onNavigate={onNavigate}
                     onSelectContact={onSelectContact}
                   />
                 </div>
               ))}
               <div style={{ height: contacts.length * 64 }} />
             </div>
           )}
        </div>
      </div>

      {contacts.length > 0 && totalContacts && contacts.length < totalContacts && !debouncedSearch && (
        <div className="p-3 border-t border-zinc-100 bg-zinc-50/50 flex items-center justify-between">
           <p className="text-xs text-zinc-500 font-bold">
             Showing {contacts.length.toLocaleString()} of {totalContacts.toLocaleString()}
           </p>
           <Button variant="ghost" size="sm" onClick={() => fetchContacts(true)} disabled={loading} className="h-8 text-xs font-semibold uppercase tracking-wide text-blue-600">
             Load More
           </Button>
        </div>
      )}
      
      <Dialog open={isAddContactOpen} onOpenChange={setIsAddContactOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add New Customer</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddContact} className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name</Label>
                <Input value={newContactData.firstname} onChange={e => setNewContactData({...newContactData, firstname: e.target.value})} required className="h-10 rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>Last Name</Label>
                <Input value={newContactData.lastname} onChange={e => setNewContactData({...newContactData, lastname: e.target.value})} className="h-10 rounded-xl" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={newContactData.email} onChange={e => setNewContactData({...newContactData, email: e.target.value})} className="h-10 rounded-xl" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Mobile</Label>
                <Input value={newContactData.mobile} onChange={e => setNewContactData({...newContactData, mobile: e.target.value})} className="h-10 rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>Landline</Label>
                <Input value={newContactData.phone} onChange={e => setNewContactData({...newContactData, phone: e.target.value})} className="h-10 rounded-xl" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsAddContactOpen(false)} className="rounded-xl h-10 px-6">Cancel</Button>
              <Button type="submit" className="rounded-xl h-10 px-6 bg-zinc-900 text-white hover:bg-zinc-800">Save Customer</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Selected</DialogTitle>
            <DialogDescription>Permanently remove {selectedIds.length} contact(s)?</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} className="rounded-xl h-10">Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteSelected} className="rounded-xl h-10">Delete</Button>
          </div>
        </DialogContent>
      </Dialog>

      <CustomerDuplicateMergeTool 
         isOpen={showDedupConfirm}
         onOpenChange={setShowDedupConfirm}
         onSuccess={fetchContacts}
      />
    </section>
  );
};
