import React, { useState, useEffect } from "react";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";
import { format } from "date-fns";
import { Mail, ArrowRight } from "lucide-react";

export function QuotesView() {
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "quote_inquiries"), orderBy("createdAt", "desc"), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setInquiries(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setIsLoading(false);
    }, (error) => {
      console.error("QuotesView snapshot subscription error:", error);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="flex flex-col h-full w-full bg-zinc-50/50">
      <div className="px-4 md:px-8 py-4 md:py-6 border-b border-zinc-200 bg-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-zinc-900">Quotes & Inquiries</h1>
          <p className="text-zinc-500 text-sm mt-1">Review website inquiries and repair quote requests</p>
        </div>
        <button onClick={() => window.dispatchEvent(new CustomEvent('open-new-ticket'))} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-4 py-2 flex items-center gap-2 text-sm font-semibold whitespace-nowrap shadow-sm">
          <Mail className="w-4 h-4" />
          Create Quote / Ticket
        </button>
      </div>
      <div className="p-4 md:p-8 flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto w-full flex-1 bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          {isLoading ? (
            <div className="flex-1 flex text-zinc-500 items-center justify-center p-8">Loading quotes...</div>
          ) : inquiries.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-zinc-400">
               <Mail className="w-12 h-12 mb-4 text-zinc-300" />
               <p className="font-semibold text-zinc-600">No quotes yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-zinc-50 text-zinc-500 border-b border-zinc-200">
                  <tr>
                    <th className="px-6 py-4 font-medium">Date</th>
                    <th className="px-6 py-4 font-medium">Customer</th>
                    <th className="px-6 py-4 font-medium">Device & Issue</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {inquiries.map((inquiry) => (
                    <tr key={inquiry.id} className="hover:bg-zinc-50/50 transition-colors">
                      <td className="px-6 py-4">
                        {inquiry.createdAt?.toDate ? format(inquiry.createdAt.toDate(), "MMM d, h:mm a") : ''}
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-semibold text-zinc-900">{inquiry.name}</p>
                        <p className="text-xs text-zinc-500">{inquiry.email}</p>
                        <p className="text-xs text-zinc-500">{inquiry.phone}</p>
                      </td>
                      <td className="px-6 py-4 max-w-sm">
                        <p className="font-semibold text-zinc-900 truncate">{inquiry.device}</p>
                        <p className="text-xs text-zinc-500 truncate">{inquiry.issue}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium tracking-wide uppercase bg-amber-100 text-amber-800">
                          {inquiry.status || 'New'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>
      </div>
    </div>
  );
}
