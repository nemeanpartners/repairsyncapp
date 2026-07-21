import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs, addDoc, serverTimestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { ScrollArea } from './ui/scroll-area';
import { format } from 'date-fns';
import { Loader2, Plus, Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface CallLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: {
    customerName: string;
    phoneNumber: string;
  } | null;
}

export function CallLogModal({ isOpen, onClose, initialData }: CallLogModalProps) {
  const [logs, setLogs] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [search, setSearch] = useState('');
  const [maxotelLogs, setMaxotelLogs] = useState<any[]>([]);
  const [isFetchingMaxotel, setIsFetchingMaxotel] = useState(false);

  const [newLog, setNewLog] = useState({
    customerName: '',
    phoneNumber: '',
    direction: 'Incoming',
    status: 'Answered',
    notes: ''
  });

  const fetchLogsAndCustomers = async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, 'call_logs'), orderBy('createdAt', 'desc'), limit(100));
      const snap = await getDocs(q);
      setLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      
      const cSnap = await getDocs(collection(db, 'crm_customers'));
      setCustomers(cSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load call logs");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMaxotelLogs = async () => {
    setIsFetchingMaxotel(true);
    try {
      // Fetch last 7 days
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - 7);
      
      const startTime = format(start, 'yyyy-MM-dd 00:00:00');
      const endTime = format(end, 'yyyy-MM-dd 23:59:59');

      const res = await fetch(`/api/maxotel/calls?startTime=${encodeURIComponent(startTime)}&endTime=${encodeURIComponent(endTime)}`);
      const data = await res.json();
      
      if (data && data.status === 'error') {
        toast.error("Maxotel API Error: " + data.message);
      } else if (data && Array.isArray(data)) {
         // Assuming root array
         setMaxotelLogs(data.filter((c: any) => c.caller_id === '0733681772' || c.destination === '0733681772' || c.src === '0733681772' || c.dst === '0733681772'));
      } else if (data && data.calls && Array.isArray(data.calls)) {
         setMaxotelLogs(data.calls.filter((c: any) => JSON.stringify(c).includes('0733681772')));
      } else if (data && Array.isArray(data.data)) {
        setMaxotelLogs(data.data.filter((c: any) => JSON.stringify(c).includes('0733681772')));
      } else if (Array.isArray(data)) {
        setMaxotelLogs(data.filter((c: any) => JSON.stringify(c).includes('0733681772')));
      } else if (typeof data === 'object') {
        // Find any array property and filter
        const logs = Object.values(data).find(Array.isArray) || [];
        setMaxotelLogs(logs.filter((c: any) => JSON.stringify(c).includes('0733681772')));
      }
      toast.success("Fetched Maxotel calls");
    } catch (error) {
       console.error("Error fetching Maxotel logs", error);
       toast.error("Failed to fetch Maxotel logs");
    } finally {
      setIsFetchingMaxotel(false);
    }
  }

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setIsAdding(true);
        setNewLog(prev => ({
          ...prev,
          customerName: initialData.customerName,
          phoneNumber: initialData.phoneNumber,
        }));
      } else {
        setNewLog({ customerName: '', phoneNumber: '', direction: 'Incoming', status: 'Answered', notes: '' });
      }
      fetchLogsAndCustomers();
    } else {
      setIsAdding(false);
    }
  }, [isOpen, initialData]);

  const handleCreateLog = async () => {
    if (!newLog.customerName && !newLog.phoneNumber) {
      toast.error("Please provide at least a name or phone number");
      return;
    }
    
    try {
      await addDoc(collection(db, 'call_logs'), {
        ...newLog,
        createdAt: serverTimestamp(),
        userId: auth.currentUser?.uid
      });
      toast.success("Call logged successfully");
      setIsAdding(false);
      setNewLog({ customerName: '', phoneNumber: '', direction: 'Incoming', status: 'Answered', notes: '' });
      fetchLogsAndCustomers();
    } catch (error) {
      console.error("Error adding call log:", error);
      toast.error("Failed to add call log");
    }
  };

  const handleDeleteLog = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    toast('Delete this call log?', {
      description: 'This action cannot be undone.',
      action: {
        label: 'Confirm',
        onClick: async () => {
          try {
            await deleteDoc(doc(db, 'call_logs', id));
            toast.success("Call log deleted");
            fetchLogsAndCustomers();
          } catch (error) {
            console.error("Error deleting call log:", error);
            toast.error("Failed to delete log");
          }
        }
      },
      cancel: { label: 'Cancel', onClick: () => {} }
    });
  };

  const getDirectionIcon = (direction: string, status: string) => {
    if (status === 'Missed') return <PhoneMissed className="w-4 h-4 text-red-500" />;
    return direction === 'Incoming' ? <PhoneIncoming className="w-4 h-4 text-primary" /> : <PhoneOutgoing className="w-4 h-4 text-emerald-500" />;
  };

  const filteredLogs = logs.filter(log => 
    (log.customerName?.toLowerCase() || '').includes(search.toLowerCase()) || 
    (log.phoneNumber || '').includes(search) ||
    (log.notes?.toLowerCase() || '').includes(search.toLowerCase())
  );

  const mergedLogs = [
    ...filteredLogs,
    ...maxotelLogs.map(mLog => {
       // Best effort parse
       const pDate = new Date(mLog.start_time || mLog.startTime || mLog.date || mLog.datetime || Date.now());
       const source = mLog.caller_id || mLog.src || mLog.from || mLog.origin;
       const dest = mLog.destination || mLog.dst || mLog.to;
       let dir = 'Incoming';
       if (mLog.direction) {
          dir = String(mLog.direction).toUpperCase() === 'IN' ? 'Incoming' : 'Outgoing';
       } else if (source === '0733681772' || source === 'PBX' || source === '100') {
          dir = 'Outgoing';
       }
       
       const cPhone = typeof source === 'string' && source.length > 5 ? source : String(dest);
       const matchedCustomer = customers.find(c => {
         const cleanPhone = (c.phone || '').replace(/\s+/g, '');
         return cleanPhone && cleanPhone.includes(cPhone.replace(/\s+/g, ''));
       });
       
       return {
         id: mLog.uniqueid || mLog.id || mLog.callid || Math.random().toString(),
         customerName: matchedCustomer ? `${matchedCustomer.firstname} ${matchedCustomer.lastname || ''}`.trim() : 'Maxotel Call',
         phoneNumber: cPhone,
         direction: String(dir).charAt(0).toUpperCase() + String(dir).slice(1),
         status: mLog.status || mLog.disposition || 'Completed',
         notes: `Duration: ${mLog.duration || mLog.billsec || 0}s`,
         createdAt: { toDate: () => pDate },
         isMaxotel: true
       };
    })
  ].sort((a, b) => b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime());

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl bg-white/40 border border-border/30 shadow-xl rounded-2xl sm:rounded-2xl h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b border-border/30 flex-shrink-0 bg-secondary/30 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center border border-orange-200">
                <Phone className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-foreground">Call Log</DialogTitle>
                <div className="text-sm text-muted-foreground">Track incoming and outgoing calls</div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchMaxotelLogs}
              disabled={isFetchingMaxotel}
              className="ml-auto"
            >
              {isFetchingMaxotel && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Fetch Maxotel (0733681772)
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col bg-white/40">
          <div className="p-4 border-b border-border/30 space-y-4 flex-shrink-0">
            {isAdding ? (
              <div className="bg-secondary/30 p-4 rounded-xl border border-border/30 space-y-3">
                <h4 className="font-bold text-sm text-zinc-800">New Call Log</h4>
                <div className="grid grid-cols-2 gap-3">
                  <Input 
                    placeholder="Customer Name" 
                    value={newLog.customerName}
                    onChange={(e) => setNewLog({...newLog, customerName: e.target.value})}
                    className="bg-white/40 border-border/30"
                  />
                  <Input 
                    placeholder="Phone Number" 
                    value={newLog.phoneNumber}
                    onChange={(e) => setNewLog({...newLog, phoneNumber: e.target.value})}
                    className="bg-white/40 border-border/30"
                  />
                  <Select value={newLog.direction} onValueChange={(v) => setNewLog({...newLog, direction: v})}>
                    <SelectTrigger className="bg-white/40 border-border/30"><SelectValue placeholder="Direction" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Incoming">Incoming</SelectItem>
                      <SelectItem value="Outgoing">Outgoing</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={newLog.status} onValueChange={(v) => setNewLog({...newLog, status: v})}>
                    <SelectTrigger className="bg-white/40 border-border/30"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Answered">Answered</SelectItem>
                      <SelectItem value="Missed">Missed</SelectItem>
                      <SelectItem value="Voicemail">Voicemail</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Textarea 
                  placeholder="Notes / Summary of call" 
                  value={newLog.notes}
                  onChange={(e) => setNewLog({...newLog, notes: e.target.value})}
                  className="bg-white/40 min-h-[80px] border-border/30"
                />
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="ghost" size="sm" onClick={() => setIsAdding(false)}>Cancel</Button>
                  <Button size="sm" onClick={handleCreateLog} className="bg-primary/90 hover:bg-primary/90 text-white">Save Log</Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <Input 
                    placeholder="Search logs by name, number, or notes..." 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 h-10 bg-secondary/30 border-border/30 rounded-xl"
                  />
                </div>
                <Button onClick={() => setIsAdding(true)} className="h-10 bg-orange-600 hover:bg-orange-700 text-white rounded-xl shadow-sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Log Call
                </Button>
              </div>
            )}
          </div>

          <div className="flex-1 min-h-0 min-w-0 overflow-y-auto">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center p-12 text-zinc-400">
                <Loader2 className="w-8 h-8 animate-spin mb-2" />
                <p>Loading calls...</p>
              </div>
            ) : mergedLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-muted-foreground text-center">
                <Phone className="w-12 h-12 mb-3 text-zinc-300" />
                <p className="font-medium text-foreground">No call logs found</p>
                <p className="text-sm">Log your first call using the button above.</p>
              </div>
            ) : (
              <div className="p-4 space-y-2">
                {mergedLogs.map((log: any) => (
                  <div key={log.id} className="p-4 bg-white/40 border border-border/30 hover:border-primary/10 hover:shadow-md transition-all rounded-xl group relative">
                    {!log.isMaxotel && (
                      <div className="absolute right-4 top-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={(e) => handleDeleteLog(log.id, e)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                    <div className="flex items-start gap-4">
                      <div className="mt-1 flex-shrink-0">
                        {getDirectionIcon(log.direction, log.status)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-bold text-foreground truncate">
                            {log.customerName || 'Unknown Caller'} {log.isMaxotel && <span className="ml-2 text-xs bg-blue-100 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded">Maxotel</span>}
                          </h4>
                          <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                            {log.createdAt ? format(log.createdAt.toDate(), 'MMM d, h:mm a') : 'Just now'}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-zinc-600 mb-2">
                          <span className="font-medium font-mono">{log.phoneNumber || 'No number'}</span>
                          <span className="w-1 h-1 rounded-full bg-zinc-300"></span>
                          <span className={`${log.status === 'Missed' ? 'text-red-600 font-semibold' : ''}`}>{log.status}</span>
                        </div>
                        {log.notes && (
                          <div className="text-sm text-zinc-700 bg-secondary/30 p-2.5 rounded-lg border border-border/30">
                            {log.notes}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
