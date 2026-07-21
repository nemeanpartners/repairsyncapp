import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Download, AlertTriangle, Loader2 } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../../firebase';

export function DatabaseSettings() {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const ticketsSnap = await getDocs(collection(db, 'tickets'));
      
      let csv = "ID,Customer Name,Device,Status,Created At\n";
      
      ticketsSnap.docs.forEach(doc => {
        const data = doc.data();
        csv += `"${doc.id}","${data.customer?.name || ''}","${data.device?.brand} ${data.device?.model}","${data.status}","${data.created_at ? new Date(data.created_at.seconds * 1000).toISOString() : ''}"\n`;
      });
      
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `repairsync_export_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success("Data export completed successfully.");
    } catch (e) {
      console.error(e);
      toast.error("Failed to export data.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleReset = () => {
    if (window.confirm("Are you sure? This cannot be undone.")) {
      toast.error("Factory reset is restricted in this environment.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-red-200 bg-red-50/30 shadow-sm space-y-4">
        <h3 className="text-lg font-bold text-red-900 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" /> Danger Zone
        </h3>
        <div className="space-y-4 pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="font-semibold text-sm text-red-900">Export All Data</div>
              <div className="text-xs text-red-700/80 mt-1">Download all tickets as CSV</div>
            </div>
            <Button variant="outline" onClick={handleExport} disabled={isExporting} className="border-red-200 text-red-700 hover:bg-red-50 shrink-0">
              {isExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              Export CSV
            </Button>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-red-100 pt-4">
            <div>
              <div className="font-semibold text-sm text-red-900">Factory Reset</div>
              <div className="text-xs text-red-700/80 mt-1">Permanently delete all workspace data</div>
            </div>
            <Button variant="destructive" onClick={handleReset} className="bg-red-600 hover:bg-red-700 text-white shrink-0">
              Reset Workspace
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
