import React, { useState, useEffect } from 'react';
import { addDoc, collection, serverTimestamp, query, orderBy, limit, getDocs, writeBatch, doc, getDoc } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { db } from '../../firebase';
import { Button } from '../../components/ui/button';
import { DollarSign, CreditCard, Send, CheckCircle2, AlertTriangle, FileText, Calendar, Calculator, ChevronUp, ChevronDown } from 'lucide-react';

export function EndOfDayPage() {
  const [cashTotal, setCashTotal] = useState('');
  const [eftposTotal, setEftposTotal] = useState('');
  const [expectedCash, setExpectedCash] = useState('0.00');
  const [expectedEftpos, setExpectedEftpos] = useState('0.00');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [unclosedPayments, setUnclosedPayments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [showDenominations, setShowDenominations] = useState(false);
  const [denominations, setDenominations] = useState([
    { label: '$100', value: 100, count: '' },
    { label: '$50', value: 50, count: '' },
    { label: '$20', value: 20, count: '' },
    { label: '$10', value: 10, count: '' },
    { label: '$5', value: 5, count: '' },
    { label: '$2', value: 2, count: '' },
    { label: '$1', value: 1, count: '' },
    { label: '50c', value: 0.5, count: '' },
    { label: '20c', value: 0.2, count: '' },
    { label: '10c', value: 0.1, count: '' },
    { label: '5c', value: 0.05, count: '' },
  ]);

  const handleDenominationChange = (index: number, val: string) => {
    const newDenom = [...denominations];
    newDenom[index].count = val;
    setDenominations(newDenom);
    
    let total = 0;
    newDenom.forEach(d => {
      const c = parseInt(d.count, 10) || 0;
      total += c * d.value;
    });
    setCashTotal(total.toFixed(2));
  };

  
  // Group payments by date string YYYY-MM-DD
  const [groupedPayments, setGroupedPayments] = useState<Record<string, any[]>>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    fetchUnclosedPayments();
  }, []);

  const fetchUnclosedPayments = async () => {
    setIsLoading(true);
    try {
      // 1. Get the last EOD record timestamp
      const eodQ = query(collection(db, 'end_of_day_records'), orderBy('created_at', 'desc'), limit(1));
      const eodSnap = await getDocs(eodQ);
      let lastEodTimestamp = null;
      if (!eodSnap.empty) {
        lastEodTimestamp = eodSnap.docs[0].data().created_at;
      }

      // 2. Query payments
      let payQ;
      if (lastEodTimestamp) {
        payQ = query(collection(db, 'payments'), orderBy('created_at', 'asc')); // Client side filter for simplicity, or we can use where if we have index.
      } else {
        payQ = query(collection(db, 'payments'), orderBy('created_at', 'asc'));
      }
      
      const paySnap = await getDocs(payQ);
      
      const unclosed: any[] = [];
      const customerCache: Record<string, string> = {};

      for (const d of paySnap.docs) {
        const data = d.data() as any;
        if (data.closed_in_eod) continue; // Skip already closed
        
        let customerName = 'Unknown Customer';
        if (data.customer_id) {
          if (customerCache[data.customer_id]) {
            customerName = customerCache[data.customer_id];
          } else {
            const cSnap = await getDoc(doc(db, 'crm_customers', data.customer_id));
            if (cSnap.exists()) {
              const cData = cSnap.data();
              customerName = cData.firstname || cData.fullname || cData.name || 'Unknown Customer';
            }
            customerCache[data.customer_id] = customerName;
          }
        }

        unclosed.push({ id: d.id, customerName, ...data });
      }
      
      setUnclosedPayments(unclosed);
      
      // Group by date
      const groups: Record<string, any[]> = {};
      unclosed.forEach(p => {
        // Use the date field from the payment, or created_at
        let dateStr = '';
        if (p.date) {
           dateStr = p.date.split('T')[0];
        } else if (p.created_at) {
           dateStr = new Date(p.created_at.toDate()).toISOString().split('T')[0];
        } else {
           dateStr = new Date().toISOString().split('T')[0];
        }
        
        if (!groups[dateStr]) groups[dateStr] = [];
        groups[dateStr].push(p);
      });
      
      setGroupedPayments(groups);
      
      // Select the oldest date by default
      const sortedDates = Object.keys(groups).sort();
      if (sortedDates.length > 0) {
        setSelectedDate(sortedDates[0]);
      } else {
        setSelectedDate(new Date().toISOString().split('T')[0]);
      }
      
    } catch (err) {
      console.error("Failed to fetch payments", err);
      setError("Failed to load unclosed payments.");
    } finally {
      setIsLoading(false);
    }
  };

  // When selected date changes, auto-calculate the expected totals
  useEffect(() => {
    if (selectedDate && groupedPayments[selectedDate]) {
      const payments = groupedPayments[selectedDate];
      let cash = 0;
      let eftpos = 0;
      payments.forEach(p => {
        const amt = parseFloat(p.amount) || 0;
        const method = (p.method || '').toLowerCase();
        if (method === 'cash') {
          cash += amt;
        } else if (method === 'eftpos' || method === 'card' || method === 'credit card') {
          eftpos += amt;
        } else {
          // Default other types to eftpos or ignore? We'll put them in EFTPOS for now, or just ignore.
          // Let's assume standard is Cash and EFTPOS.
        }
      });
      setCashTotal(cash.toFixed(2));
      setEftposTotal(eftpos.toFixed(2));
      setExpectedCash(cash.toFixed(2));
      setExpectedEftpos(eftpos.toFixed(2));
    } else {
      setCashTotal('0.00');
      setEftposTotal('0.00');
      setExpectedCash('0.00');
      setExpectedEftpos('0.00');
    }
  }, [selectedDate, groupedPayments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate) return;
    
    setIsSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const parsedCash = parseFloat(cashTotal) || 0;
      const parsedEftpos = parseFloat(eftposTotal) || 0;
      const paymentsToClose = groupedPayments[selectedDate] || [];

      if (parsedCash === 0 && parsedEftpos === 0 && paymentsToClose.length === 0) {
        throw new Error('No payments to close and totals are zero.');
      }

      // 1. Create EOD Record
      const eodRef = await addDoc(collection(db, 'end_of_day_records'), {
        date: selectedDate,
        cash_total: parsedCash,
        eftpos_total: parsedEftpos,
        payment_ids: paymentsToClose.map(p => p.id),
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      });

      // 2. Queue for Xero
      await addDoc(collection(db, 'xero_sync_queue'), {
        entity_type: 'END_OF_DAY',
        entity_id: eodRef.id,
        operation: 'CREATE',
        status: 'PENDING',
        attempts: 0,
        payload: {
          cash: parsedCash,
          eftpos: parsedEftpos,
          date: selectedDate
        },
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      });

      // 3. Mark payments as closed (in batches of 500)
      if (paymentsToClose.length > 0) {
        const batch = writeBatch(db);
        paymentsToClose.forEach(p => {
          batch.update(doc(db, 'payments', p.id), {
            closed_in_eod: true,
            eod_record_id: eodRef.id,
            updated_at: serverTimestamp()
          });
        });
        await batch.commit();
      }

      setSuccess(true);
      
      // Refresh
      await fetchUnclosedPayments();
      
      // Auto-hide success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to submit End of Day totals');
    } finally {
      setIsSubmitting(false);
    }
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const hasForgottenDays = Object.keys(groupedPayments).some(d => d < todayStr);

  return (
    <div className="flex-1 overflow-y-auto bg-zinc-50/50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">End of Day Till Balance</h1>
          <p className="text-zinc-500 mt-1">
            Review the day's payments, confirm the totals, and sync them to Xero.
          </p>
        </div>
        
        {hasForgottenDays && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-amber-900">Previous days not closed</h3>
              <p className="text-sm text-amber-700 mt-1">
                You have payments from previous days that haven't been closed off. Please close them first to keep Xero up to date.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Left Column: Dates and Payments */}
          <div className="md:col-span-1 space-y-4">
            <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">Unclosed Days</h3>
            {isLoading ? (
               <div className="text-sm text-zinc-500">Loading...</div>
            ) : Object.keys(groupedPayments).length === 0 ? (
               <div className="text-sm text-zinc-500 bg-white p-4 rounded-xl border border-zinc-200">
                 No unclosed payments found. All caught up!
               </div>
            ) : (
              <div className="space-y-2">
                {Object.keys(groupedPayments).sort().map(date => {
                  const pCount = groupedPayments[date].length;
                  const isSelected = selectedDate === date;
                  const isPast = date < todayStr;
                  return (
                    <button
                      key={date}
                      type="button"
                      onClick={() => setSelectedDate(date)}
                      className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                        isSelected 
                          ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-500' 
                          : 'bg-white border-zinc-200 hover:border-zinc-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Calendar className={`w-4 h-4 ${isSelected ? 'text-blue-600' : 'text-zinc-400'}`} />
                        <div>
                          <div className={`text-sm font-bold ${isSelected ? 'text-blue-900' : 'text-zinc-900'}`}>
                            {date === todayStr ? 'Today' : date}
                          </div>
                          {isPast && (
                             <div className="text-[10px] font-bold text-amber-600 uppercase">Forgotten</div>
                          )}
                        </div>
                      </div>
                      <div className={`text-xs font-semibold px-2 py-1 rounded-full ${isSelected ? 'bg-blue-100 text-blue-700' : 'bg-zinc-100 text-zinc-600'}`}>
                        {pCount} payments
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Totals and Submit */}
          <div className="md:col-span-2">
            <div className="bg-white border border-zinc-200 rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-bold text-zinc-900 mb-4">
                {selectedDate === todayStr ? 'Close Today' : `Close ${selectedDate || 'Day'}`}
              </h3>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-4">
                  {/* Denominations Counter */}
                  <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4">
                    <div 
                      className="flex justify-between items-center cursor-pointer select-none"
                      onClick={() => setShowDenominations(!showDenominations)}
                    >
                      <h4 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                        <Calculator className="w-4 h-4 text-zinc-500" />
                        Cash Denomination Counter
                      </h4>
                      {showDenominations ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
                    </div>
                    
                    {showDenominations && (
                      <div className="mt-4 pt-4 border-t border-zinc-200 grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {denominations.map((d, idx) => (
                          <div key={d.label} className="flex items-center gap-2">
                            <label className="text-xs font-medium text-zinc-600 w-8 shrink-0 text-right pr-1">{d.label}</label>
                            <input
                              type="number"
                              min="0"
                              value={d.count}
                              onChange={(e) => handleDenominationChange(idx, e.target.value)}
                              className="block w-full px-2 py-1.5 border border-zinc-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500 text-sm bg-white"
                              placeholder="0"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-sm font-medium text-zinc-700">
                        Cash Total ($)
                      </label>
                      <span className="text-xs font-medium text-zinc-500">
                        Expected: ${expectedCash}
                      </span>
                    </div>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <DollarSign className="h-5 w-5 text-zinc-400" />
                      </div>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={cashTotal}
                        onChange={(e) => setCashTotal(e.target.value)}
                        className="block w-full pl-10 pr-3 py-2 border border-zinc-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm transition-colors"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-sm font-medium text-zinc-700">
                        EFTPOS Total ($)
                      </label>
                      <span className="text-xs font-medium text-zinc-500">
                        Expected: ${expectedEftpos}
                      </span>
                    </div>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <CreditCard className="h-5 w-5 text-zinc-400" />
                      </div>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={eftposTotal}
                        onChange={(e) => setEftposTotal(e.target.value)}
                        className="block w-full pl-10 pr-3 py-2 border border-zinc-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm transition-colors"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg border border-red-100">
                    {error}
                  </div>
                )}

                {success && (
                  <div className="p-3 text-sm text-emerald-700 bg-emerald-50 rounded-lg border border-emerald-100 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    End of Day totals submitted to Xero successfully!
                  </div>
                )}

                <div className="pt-2">
                  <Button
                    type="submit"
                    disabled={isSubmitting || !selectedDate}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-11 font-medium"
                  >
                    {isSubmitting ? (
                      "Processing..."
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Close Day & Sync to Xero
                      </>
                    )}
                  </Button>
                </div>
              </form>
              
              {/* Payment List Preview */}
              {selectedDate && groupedPayments[selectedDate] && (
                 <div className="mt-8 pt-6 border-t border-zinc-100">
                    <h4 className="text-sm font-bold text-zinc-900 mb-3 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-zinc-400" />
                      Included Payments ({groupedPayments[selectedDate].length})
                    </h4>
                    <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
                      {groupedPayments[selectedDate].map(p => (
                        <div key={p.id} className="flex justify-between items-center p-2 rounded-lg bg-zinc-50 border border-zinc-100 text-sm">
                          <div className="flex flex-col gap-1">
                            <div className="font-medium text-zinc-900">{p.customerName || 'Unknown Customer'}</div>
                            <div className="font-medium text-zinc-700 flex gap-2 items-center">
                              {p.invoice_id ? (
                                <Link to={`/invoice/${p.invoice_id}`} className="text-xs text-blue-600 hover:text-blue-800 hover:underline">
                                  {p.invoice_number ? p.invoice_number.replace(/\D/g, '') : p.invoice_id?.replace(/\D/g, '').substring(0, 8) || p.invoice_id?.substring(0, 8)}
                                </Link>
                              ) : (
                                <span className="w-16 truncate block text-xs text-zinc-500">{p.invoice_number ? p.invoice_number.replace(/\D/g, '') : 'N/A'}</span>
                              )}
                              <span className="bg-white px-2 py-0.5 rounded border border-zinc-200 text-xs font-bold uppercase tracking-wider">{p.method}</span>
                            </div>
                          </div>
                          <div className="font-bold text-zinc-900">
                             ${parseFloat(p.amount).toFixed(2)}
                           </div>
                        </div>
                      ))}
                    </div>
                 </div>
              )}
              
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
