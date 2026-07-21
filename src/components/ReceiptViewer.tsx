import React, { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Loader2, AlertCircle, FileText } from 'lucide-react';
import { Button } from './ui/button';

export const ReceiptViewer = ({ receiptId }: { receiptId: string }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);

  useEffect(() => {
    const fetchReceipt = async () => {
      try {
        const docRef = doc(db, 'receipts', receiptId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          setPdfBase64(docSnap.data().pdfBase64);
        } else {
          setError('Receipt not found.');
        }
      } catch (err: any) {
        console.error('Error fetching receipt:', err);
        setError('Failed to load receipt.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchReceipt();
  }, [receiptId]);

  if (loading) {
    return (
      <div className="min-h-dvh bg-secondary/30 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
        <p className="text-zinc-600 font-medium">Loading receipt...</p>
      </div>
    );
  }

  if (error || !pdfBase64) {
    return (
      <div className="min-h-dvh bg-secondary/30 flex flex-col items-center justify-center p-4">
        <div className="bg-white/40 p-8 rounded-2xl sm:rounded-2xl shadow-sm border border-border/30 text-center max-w-md w-full">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 text-red-600 rounded-full mb-4">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Unavailable</h2>
          <p className="text-muted-foreground">{error || 'This receipt is no longer available.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-100 flex flex-col">
      <div className="bg-white/40 border-b border-border/30 p-4 shrink-0 flex items-center justify-between">
         <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <h1 className="font-bold text-lg text-foreground">Receipt</h1>
         </div>
         <Button 
            onClick={() => {
              const link = document.createElement('a');
              link.href = pdfBase64;
              link.download = `Receipt_${receiptId.replace('receipt_', '')}.pdf`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}
            variant="default"
         >
           Download PDF
         </Button>
      </div>
      <div className="flex-1 overflow-hidden p-4 md:p-8 flex items-center justify-center">
         <iframe 
           src={pdfBase64} 
           className="w-full h-full max-w-4xl bg-white/40 shadow-xl rounded-xl border border-border/30"
           title="Receipt PDF"
         />
      </div>
    </div>
  );
};
