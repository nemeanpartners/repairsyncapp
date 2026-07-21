import React, { useState, useEffect, useRef } from "react";
import { collection, query, orderBy, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, isWithinInterval, subYears, subMonths, isSameDay } from "date-fns";
import { TrendingUp, TrendingDown, DollarSign, Calendar, BarChart3, Activity, Download, Printer, PieChart, Users, CreditCard } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RePieChart, Pie, Cell, Legend } from 'recharts';
import { Button } from "./ui/button";

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b'];

export function FinancialReportsView() {
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<any[]>([]);
  const [customers, setCustomers] = useState<Record<string, string>>({});
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const q = query(collection(db, "payments"), orderBy("created_at", "desc"));
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPayments(data);

      // Fetch basic customer info for top customers insight
      const custSnap = await getDocs(collection(db, "crm_customers"));
      const custMap: Record<string, string> = {};
      custSnap.forEach(c => {
        const cData = c.data();
        custMap[c.id] = cData.fullname || `${cData.firstname || ''} ${cData.lastname || ''}`.trim() || 'Unknown';
      });
      setCustomers(custMap);
    } catch (error) {
      console.error("Error fetching data for reports:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const headers = ["ID,Date,Amount,Method,Customer ID,Status"];
    const rows = payments.map(p => {
      const d = p.created_at?.toDate ? p.created_at.toDate() : new Date(p.date || p.created_at);
      return `"${p.id}","${format(d, 'yyyy-MM-dd HH:mm')}","${p.amount}","${p.method || 'Unknown'}","${p.customer_id || ''}","${p.status || ''}"`;
    });
    const csv = headers.concat(rows).join("\n");
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `financial_report_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-zinc-500">
        Loading reports...
      </div>
    );
  }

  const now = new Date();
  const todayStart = new Date(now.setHours(0, 0, 0, 0));
  const todayEnd = new Date(now.setHours(23, 59, 59, 999));
  const yesterdayStart = subDays(todayStart, 1);
  const yesterdayEnd = subDays(todayEnd, 1);

  const thisWeekStart = startOfWeek(new Date());
  const thisWeekEnd = endOfWeek(new Date());
  const lastWeekStart = subDays(thisWeekStart, 7);
  const lastWeekEnd = subDays(thisWeekEnd, 7);

  const thisMonthStart = startOfMonth(new Date());
  const thisMonthEnd = endOfMonth(new Date());
  const lastMonthStart = subMonths(thisMonthStart, 1);
  const lastMonthEnd = subMonths(thisMonthEnd, 1);

  const thisYearStart = startOfYear(new Date());
  const thisYearEnd = endOfYear(new Date());
  const lastYearStart = subYears(thisYearStart, 1);
  const lastYearEnd = subYears(thisYearEnd, 1);

  const calculateTotal = (startDate: Date, endDate: Date) => {
    return payments.reduce((sum, p) => {
      const d = p.created_at?.toDate ? p.created_at.toDate() : new Date(p.date || p.created_at);
      if (isWithinInterval(d, { start: startDate, end: endDate })) {
        return sum + (Number(p.amount) || 0);
      }
      return sum;
    }, 0);
  };

  const todayTotal = calculateTotal(todayStart, todayEnd);
  const yesterdayTotal = calculateTotal(yesterdayStart, yesterdayEnd);
  
  const wtdTotal = calculateTotal(thisWeekStart, thisWeekEnd);
  const lastWtdTotal = calculateTotal(lastWeekStart, lastWeekEnd);

  const mtdTotal = calculateTotal(thisMonthStart, thisMonthEnd);
  const lastMtdTotal = calculateTotal(lastMonthStart, lastMonthEnd);

  const ytdTotal = calculateTotal(thisYearStart, thisYearEnd);
  const lastYtdTotal = calculateTotal(lastYearStart, lastYearEnd);

  const calculateGrowth = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  const DoD = calculateGrowth(todayTotal, yesterdayTotal);
  const WoW = calculateGrowth(wtdTotal, lastWtdTotal);
  const MoM = calculateGrowth(mtdTotal, lastMtdTotal);
  const YoY = calculateGrowth(ytdTotal, lastYtdTotal);

  // Chart data for last 7 days
  const last7DaysData = Array.from({ length: 7 }).map((_, i) => {
    const d = subDays(todayStart, 6 - i);
    const end = new Date(d);
    end.setHours(23, 59, 59, 999);
    return {
      name: format(d, 'EEE'),
      total: calculateTotal(d, end)
    };
  });

  // Insights: Payment Methods (This Month)
  const methodTotals: Record<string, number> = {};
  payments.forEach(p => {
    const d = p.created_at?.toDate ? p.created_at.toDate() : new Date(p.date || p.created_at);
    if (isWithinInterval(d, { start: thisMonthStart, end: thisMonthEnd })) {
      const m = (p.method || 'Unknown').toUpperCase();
      methodTotals[m] = (methodTotals[m] || 0) + (Number(p.amount) || 0);
    }
  });
  const methodData = Object.keys(methodTotals).map(k => ({ name: k, value: methodTotals[k] })).sort((a,b) => b.value - a.value);

  // Insights: Top Customers (This Month)
  const customerTotals: Record<string, number> = {};
  payments.forEach(p => {
    const d = p.created_at?.toDate ? p.created_at.toDate() : new Date(p.date || p.created_at);
    if (isWithinInterval(d, { start: thisMonthStart, end: thisMonthEnd }) && p.customer_id) {
      customerTotals[p.customer_id] = (customerTotals[p.customer_id] || 0) + (Number(p.amount) || 0);
    }
  });
  const topCustomers = Object.keys(customerTotals)
    .map(k => ({ id: k, name: customers[k] || 'Unknown', total: customerTotals[k] }))
    .sort((a,b) => b.total - a.total)
    .slice(0, 5);

  const MetricCard = ({ title, current, previous, growth, subtitle }: any) => (
    <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm flex flex-col gap-2">
      <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider">{title}</h3>
      <div className="flex items-end justify-between mt-2">
        <div className="text-3xl font-black text-zinc-900 tracking-tight">
          ${current.toFixed(2)}
        </div>
        <div className={`flex items-center gap-1 text-sm font-bold px-2 py-1 rounded-md ${growth >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
          {growth >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {Math.abs(growth).toFixed(1)}%
        </div>
      </div>
      <div className="text-xs font-medium text-zinc-400 mt-1">
        vs. ${previous.toFixed(2)} {subtitle}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full w-full bg-zinc-50/50" ref={printRef}>
      <div className="px-4 md:px-8 py-4 md:py-6 border-b border-zinc-200 bg-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shrink-0 print:hidden">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-zinc-900">Financial Reports</h1>
          <p className="text-zinc-500 text-sm mt-1">Key metrics and revenue breakdown</p>
        </div>
        <div className="flex gap-2">
           <Button onClick={handleExportCSV} variant="outline" className="bg-white">
             <Download className="w-4 h-4 mr-2" />
             Export CSV
           </Button>
           <Button onClick={handlePrint} variant="outline" className="bg-white">
             <Printer className="w-4 h-4 mr-2" />
             Print Report
           </Button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 md:p-8 animate-in fade-in zoom-in-95 duration-500 print:p-0">
        <div className="max-w-6xl mx-auto w-full flex flex-col space-y-6 pb-20 print:pb-0">
          
          <div className="hidden print:block mb-6">
            <h1 className="text-2xl font-bold text-zinc-900">Financial Report</h1>
            <p className="text-zinc-500">Generated on {format(new Date(), "PPP")}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard 
              title="Today (DoD)" 
              current={todayTotal} 
              previous={yesterdayTotal} 
              growth={DoD} 
              subtitle="yesterday" 
            />
            <MetricCard 
              title="Week to Date (WoW)" 
              current={wtdTotal} 
              previous={lastWtdTotal} 
              growth={WoW} 
              subtitle="last week" 
            />
            <MetricCard 
              title="Month to Date (MoM)" 
              current={mtdTotal} 
              previous={lastMtdTotal} 
              growth={MoM} 
              subtitle="last month" 
            />
            <MetricCard 
              title="Year to Date (YoY)" 
              current={ytdTotal} 
              previous={lastYtdTotal} 
              growth={YoY} 
              subtitle="last year" 
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white border border-zinc-200 rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-bold text-zinc-900 flex items-center gap-2 mb-6">
                  <Activity className="w-5 h-5 text-emerald-500" />
                  Last 7 Days Revenue
              </h3>
              <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={last7DaysData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#71717a', fontSize: 12}} dy={10} />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{fill: '#71717a', fontSize: 12}}
                        tickFormatter={(value) => `$${value}`}
                      />
                      <Tooltip 
                        cursor={{fill: '#f4f4f5'}}
                        contentStyle={{borderRadius: '8px', border: '1px solid #e4e4e7', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                        formatter={(value: number) => [`$${value.toFixed(2)}`, 'Revenue']}
                      />
                      <Bar dataKey="total" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white border border-zinc-200 rounded-xl p-6 shadow-sm flex flex-col">
              <h3 className="text-lg font-bold text-zinc-900 flex items-center gap-2 mb-2">
                  <PieChart className="w-5 h-5 text-blue-500" />
                  Payment Methods
              </h3>
              <p className="text-xs text-zinc-500 mb-6">Month to Date Breakdown</p>
              
              {methodData.length > 0 ? (
                <div className="flex-1 min-h-[250px] relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <RePieChart>
                      <Pie
                        data={methodData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {methodData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
                      <Legend verticalAlign="bottom" height={36} />
                    </RePieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-sm text-zinc-400">
                  No payment data this month
                </div>
              )}
            </div>
          </div>

          <div className="bg-white border border-zinc-200 rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-bold text-zinc-900 flex items-center gap-2 mb-2">
                <Users className="w-5 h-5 text-purple-500" />
                Top Customers
            </h3>
            <p className="text-xs text-zinc-500 mb-6">By Revenue (Month to Date)</p>

            {topCustomers.length > 0 ? (
              <div className="space-y-4">
                {topCustomers.map((c, i) => (
                  <div key={c.id} className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg border border-zinc-100">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-zinc-200 text-zinc-700 font-bold flex items-center justify-center text-xs">
                        #{i + 1}
                      </div>
                      <span className="font-medium text-zinc-900">{c.name}</span>
                    </div>
                    <span className="font-bold text-zinc-900">${c.total.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-zinc-400">No customer data this month</div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
