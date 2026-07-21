import React, { useEffect, useState, useRef } from 'react';
import { doc, getDoc, updateDoc, addDoc, collection, serverTimestamp, onSnapshot, query, where } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Loader2, AlertCircle, Printer, Download, ArrowLeft, Mail, DollarSign, RefreshCw, CheckCircle2, HelpCircle, FileText, Layout, MessageSquare } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { format } from 'date-fns';
import axios from 'axios';
import * as htmlToImage from 'html-to-image';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'sonner';

export const InvoiceViewer = ({ invoiceId, onBack }: { invoiceId: string, onBack?: () => void }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invoice, setInvoice] = useState<any>(null);
  const [customer, setCustomer] = useState<any>(null);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [previewMode, setPreviewMode] = useState<"html" | "pdf">("html");
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const invoiceRef = useRef<HTMLDivElement>(null);
  
  const isAdmin = !!auth.currentUser;
  const [paymentTender, setPaymentTender] = useState<string>("Card");
  const [isApplyingPayment, setIsApplyingPayment] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [orgDetails, setOrgDetails] = useState({
    name: "Phone Medic",
    address_line_1: "123 Tech Lane",
    address_line_2: "Sydney, NSW 2000",
    abn: "12 345 678 901",
  });

  const [isSendingSms, setIsSendingSms] = useState(false);
  const [isXeroConnected, setIsXeroConnected] = useState(false);
  const [syncJob, setSyncJob] = useState<any>(null);
  const [isSyncingLocal, setIsSyncingLocal] = useState(false);

  // 1. Subscribe to Xero connection state
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'crm_integrations', 'xero'), (snap) => {
      setIsXeroConnected(snap.exists());
    }, (error) => {
      console.error("InvoiceViewer xero integrations snap error:", error);
    });
    return unsub;
  }, []);

  // 2. Subscribe to latest Xero sync logs for this Invoice
  useEffect(() => {
    const q = query(
      collection(db, 'xero_sync_queue'),
      where('entity_id', '==', invoiceId),
      where('entity_type', '==', 'INVOICE')
    );
    const unsub = onSnapshot(q, (snap) => {
      const jobs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      jobs.sort((a: any, b: any) => {
        const timeA = a.created_at?.seconds || a.created_at?.toMillis?.() || 0;
        const timeB = b.created_at?.seconds || b.created_at?.toMillis?.() || 0;
        return timeB - timeA;
      });
      setSyncJob(jobs[0] || null);
    }, (error) => {
      console.error("InvoiceViewer sync queue snap error:", error);
    });
    return unsub;
  }, [invoiceId]);

  // 3. Real-time active invoice subscription
  useEffect(() => {
    const unsubInvoice = onSnapshot(doc(db, 'invoices', invoiceId), async (docSnap) => {
      if (docSnap.exists()) {
        const invData = docSnap.data();
        setInvoice({ id: docSnap.id, ...invData });
        
        if (invData.customer_id) {
          try {
            const customerSnap = await getDoc(doc(db, 'crm_customers', invData.customer_id));
            if (customerSnap.exists()) {
               setCustomer({ id: customerSnap.id, ...customerSnap.data() });
            }
          } catch (e) {
            console.error("Failed to load customer details", e);
          }
        }
      } else {
        setError('Invoice not found.');
      }
      setLoading(false);
    }, (err) => {
      console.error('Error listening to invoice:', err);
      setError('Failed to load invoice.');
      setLoading(false);
    });

    // Fetch Org Details once
    getDoc(doc(db, "settings", "organization")).then((orgSnap) => {
      if (orgSnap.exists()) {
        setOrgDetails((prev) => ({ ...prev, ...orgSnap.data() }));
      }
    }).catch(console.error);

    return () => unsubInvoice();
  }, [invoiceId]);

  const handleXeroInvoiceSync = async () => {
    try {
      setIsSyncingLocal(true);
      const res = await axios.post('/api/xero/sync/invoice', { invoiceId });
      if (res.data?.success) {
        toast.success("Sync job queued!", { description: "The background worker is now syncing this invoice." });
      } else {
        toast.error("Failed to queue synchronization request.");
      }
    } catch (e: any) {
      console.error(e);
      toast.error("Sync request failed", { description: e.response?.data || e.message });
    } finally {
      setIsSyncingLocal(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 w-full flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
        <p className="text-zinc-600 font-medium">Loading invoice...</p>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="flex-1 w-full flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl sm:rounded-2xl shadow-sm border border-border/30 text-center max-w-md w-full">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 text-red-600 rounded-full mb-4">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Unavailable</h2>
          <p className="text-muted-foreground">{error || 'This invoice is no longer available.'}</p>
          {onBack && (
             <Button onClick={onBack} variant="outline" className="mt-6 font-bold w-full">
               Go Back
             </Button>
          )}
        </div>
      </div>
    );
  }

  const handlePrint = async () => {
    window.print();
  };

  const handleSendSms = async () => {
    if (!customer?.phone && !customer?.mobile) {
      toast.error("Customer phone number is missing.");
      return;
    }
    const phone = customer.phone || customer.mobile;
    setIsSendingSms(true);
    try {
      const summaryItems = (invoice.line_items || []).slice(0, 2).map((i: any) => i.description).join(", ");
      const moreStr = (invoice.line_items?.length || 0) > 2 ? `... and more` : ``;
      const invLink = `${window.location.origin}/invoice/${invoiceId}`;
      const msg = `Hi ${customer.firstname || customer.fullname || 'there'}, your invoice #${invoice.invoice_number ? invoice.invoice_number.replace(/\D/g, '') : 'Receipt'} for ${summaryItems}${moreStr} is ready. Total: $${Number(invoice.total || 0).toFixed(2)}. View & pay online: ${invLink}`;
      
      const { mobileMessage } = await import("../lib/api");
      await mobileMessage.sendSms(phone, msg, invoiceId, invoiceId);
      toast.success("Invoice SMS sent to customer!");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to send SMS");
    } finally {
      setIsSendingSms(false);
    }
  };

  const generatePdfDoc = () => {
    const doc = new jsPDF();
    
    // Document Settings
    doc.setFontSize(22);
    doc.setTextColor(33, 33, 33);
    doc.text("INVOICE", 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Invoice Number: ${invoice.invoice_number ? invoice.invoice_number.replace(/\D/g, '') : ''}`, 14, 30);
    doc.text(`Issue Date: ${invoice.issue_date ? format(new Date(invoice.issue_date), 'dd MMM yyyy') : 'N/A'}`, 14, 35);
    doc.text(`Due Date: ${invoice.due_date ? format(new Date(invoice.due_date), 'dd MMM yyyy') : 'N/A'}`, 14, 40);

    // Organization Details (Top Right)
    const rightColX = 140;
    doc.setFontSize(12);
    doc.setTextColor(33, 33, 33);
    doc.setFont(undefined, 'bold');
    doc.text(orgDetails.name || "Phone Medic", rightColX, 22);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    if (orgDetails.address_line_1) doc.text(orgDetails.address_line_1, rightColX, 27);
    if (orgDetails.address_line_2) doc.text(orgDetails.address_line_2, rightColX, 32);
    if (orgDetails.abn) doc.text(`ABN: ${orgDetails.abn}`, rightColX, 37);

    // Customer Details
    doc.setFontSize(10);
    doc.setTextColor(150, 150, 150);
    doc.text("BILL TO", 14, 55);
    
    doc.setFontSize(12);
    doc.setTextColor(33, 33, 33);
    doc.setFont(undefined, 'bold');
    const customerName = customer ? (customer.business_then_name || customer.fullname || `${customer.firstname || customer.first_name || ''} ${customer.lastname || customer.last_name || ''}`.trim() || 'Unknown Customer') : 'Unknown Customer';
    doc.text(customerName, 14, 62);
    
    doc.setFont(undefined, 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    let customerY = 67;
    if (customer?.email) { doc.text(customer.email, 14, customerY); customerY += 5; }
    if (customer?.phone) { doc.text(customer.phone, 14, customerY); customerY += 5; }
    if (customer?.address) { doc.text(customer.address, 14, customerY); customerY += 5; }

    // Line Items Table
    const tableColumn = ["Description", "Qty", "Unit Price", "Total"];
    const tableRows: any[] = [];

    (invoice.line_items || []).forEach((item: any) => {
      const itemData = [
        item.description || 'Item',
        item.quantity?.toString() || '1',
        `$${Number(item.unit_amount || item.price || 0).toFixed(2)}`,
        `$${(Number(item.quantity || 1) * Number(item.unit_amount || item.price || 0)).toFixed(2)}`
      ];
      tableRows.push(itemData);
    });

    autoTable(doc, {
      startY: customerY + 10,
      head: [tableColumn],
      body: tableRows,
      theme: 'striped',
      styles: { fontSize: 10, cellPadding: 3 },
      headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      columnStyles: {
          0: { cellWidth: 80 },
          1: { halign: 'center' },
          2: { halign: 'right' },
          3: { halign: 'right' }
      }
    });

    // Totals
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text("Subtotal:", 140, finalY);
    doc.text(`$${Number(invoice.subtotal || 0).toFixed(2)}`, 180, finalY, { align: 'right' });
    
    const hasTax = invoice.line_amount_types === 'Exclusive';
    doc.text(`Tax${hasTax ? ' (Exclusive)' : ''}:`, 140, finalY + 7);
    doc.text(`$${Number(invoice.total_tax || 0).toFixed(2)}`, 180, finalY + 7, { align: 'right' });

    doc.setFontSize(12);
    doc.setTextColor(33, 33, 33);
    doc.setFont(undefined, 'bold');
    doc.text("Total:", 140, finalY + 17);
    doc.text(`$${Number(invoice.total || 0).toFixed(2)}`, 180, finalY + 17, { align: 'right' });

    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text("Amount Paid:", 140, finalY + 27);
    doc.text(`$${Number(invoice.amount_paid || 0).toFixed(2)}`, 180, finalY + 27, { align: 'right' });

    doc.setFontSize(12);
    doc.setTextColor(200, 50, 50); // Amber/Reddish for Amount Due
    doc.setFont(undefined, 'bold');
    doc.text("Amount Due:", 140, finalY + 37);
    doc.text(`$${Number(invoice.amount_due || (invoice.total - (invoice.amount_paid || 0))).toFixed(2)}`, 180, finalY + 37, { align: 'right' });

    // Footer
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(150, 150, 150);
    doc.text("THANK YOU FOR YOUR BUSINESS", 105, pageHeight - 20, { align: 'center' });
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.text("Payment is due within 7 days.", 105, pageHeight - 15, { align: 'center' });
    
    return doc;
  };

  const handleDownloadPdf = () => {
    setIsGeneratingPdf(true);
    try {
      const doc = generatePdfDoc();
      doc.save(`Invoice_${invoice?.invoice_number ? invoice.invoice_number.replace(/\D/g, '') : "Receipt"}.pdf`);
      toast.success("PDF Downloaded successfully.");
    } catch (err: any) {
      console.error("Failed to generate PDF:", err);
      toast.error("Failed to generate PDF.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleTogglePreview = () => {
    if (previewMode === "html") {
      setIsGeneratingPdf(true);
      setTimeout(() => {
        try {
          const doc = generatePdfDoc();
          const blob = doc.output('blob');
          const url = URL.createObjectURL(blob);
          if (pdfPreviewUrl) {
            URL.revokeObjectURL(pdfPreviewUrl);
          }
          setPdfPreviewUrl(url);
          setPreviewMode("pdf");
        } catch (err: any) {
             console.error("Failed to generate PDF preview:", err);
             toast.error("Failed to generate preview.");
        } finally {
             setIsGeneratingPdf(false);
        }
      }, 50);
    } else {
      setPreviewMode("html");
    }
  };

  const handleSendZohoEmail = async () => {
    if (!customer?.email) {
      toast.error('Customer email is missing.');
      return;
    }
    
    setIsSendingEmail(true);
    try {
      const doc = generatePdfDoc();
      const base64Data = doc.output("datauristring");
      
      const subject = `Invoice #${invoice?.invoice_number ? invoice.invoice_number.replace(/\D/g, '') : 'Receipt'} from Phone Medic`;
      const body = `Hi ${customer?.firstname || customer?.fullname || ''},<br><br>Here is your invoice for a recent repair/purchase.<br><br>You can view it online here: <a href="${window.location.origin}/invoice/${invoiceId}">${window.location.origin}/invoice/${invoiceId}</a><br><br>Kind regards,<br>Phone Medic Team`;

      await axios.post("/api/zoho/send", {
        toAddress: customer.email,
        subject,
        content: body,
        attachmentBase64: base64Data,
        attachmentName: `Invoice_${invoice?.invoice_number ? invoice.invoice_number.replace(/\D/g, '') : "Receipt"}.pdf`
      });

      toast.success("Email sent successfully via Zoho.");
    } catch (err: any) {
      console.error("Failed to send Zoho email:", err);
      toast.error(err.response?.data?.error || err.message || "Failed to send email.");
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleProcessPayment = async () => {
    if (!invoice) return;
    setIsApplyingPayment(true);
    try {
      await updateDoc(doc(db, "invoices", invoice.id), {
        status: "PAID",
        amount_paid: invoice.total,
        amount_due: 0,
        sync_status: "PENDING",
        paid_at: serverTimestamp(),
        tender_type: paymentTender,
      });
      
      const pDoc = await addDoc(collection(db, "payments"), {
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number || null,
        customer_id: invoice.customer_id,
        amount: invoice.total,
        date: new Date().toISOString(),
        method: paymentTender,
        status: 'PENDING',
        sync_status: 'PENDING',
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
        uid: auth.currentUser?.uid || 'system'
      });
      
      try {
        await axios.post("/api/xero/sync/payment", { paymentId: pDoc.id });
      } catch (xeroErr) {
         console.warn("Queue to Xero Payment Failed", xeroErr);
      }
      
      toast.success(`Payment Received via ${paymentTender}!`);
      setIsPaymentModalOpen(false);
      
      // Reload UI
      setInvoice({
        ...invoice,
        status: "PAID",
        amount_paid: invoice.total,
        amount_due: 0
      });
    } catch (e) {
      console.error(e);
      toast.error("Failed to process payment");
    } finally {
      setIsApplyingPayment(false);
    }
  };

  const getStatusColor = (s: string) => {
    if (!s) return 'bg-zinc-100 text-zinc-700';
    s = s.toLowerCase();
    if (s === 'paid' || s === 'completed' || s === 'synced') {
      return 'bg-emerald-100 text-emerald-700';
    }
    if (s === 'partially_paid' || s === 'partially paid' || s === 'pending' || s === 'local_draft' || s === 'unpaid') {
      return 'bg-amber-100 text-amber-700';
    }
    return 'bg-zinc-100 text-zinc-700';
  };

  return (
    <div className="flex-1 w-full flex flex-col bg-zinc-50 overflow-hidden h-full relative">
      <div className="bg-white border-b border-border/50 p-4 shrink-0 flex items-center justify-between shadow-sm z-10 sticky top-0 md:static print:hidden">
         <div className="flex items-center gap-3">
            {onBack && (
               <Button variant="ghost" size="icon" onClick={onBack} className="mr-2 h-9 w-9 text-zinc-500 hover:text-zinc-900 rounded-lg">
                 <ArrowLeft className="w-4 h-4" />
               </Button>
            )}
            <h1 className="font-black text-xl text-foreground hidden sm:block">Invoice {invoice.invoice_number ? invoice.invoice_number.replace(/\D/g, '') : ''}</h1>
            <h1 className="font-black text-lg text-foreground sm:hidden">{invoice.invoice_number ? invoice.invoice_number.replace(/\D/g, '') : ''}</h1>
         </div>
         <div className="flex items-center gap-2">
           <Button 
              onClick={handleTogglePreview}
              disabled={isGeneratingPdf}
              variant="outline"
              className="font-bold border-zinc-200 text-zinc-700 bg-white hover:bg-zinc-50 hover:text-zinc-900"
           >
             {isGeneratingPdf && previewMode === "html" ? <Loader2 className="w-4 h-4 sm:mr-2 animate-spin" /> : previewMode === "html" ? <FileText className="w-4 h-4 sm:mr-2" /> : <Layout className="w-4 h-4 sm:mr-2" />}
             <span className="hidden sm:inline">{previewMode === "html" ? 'PDF Preview' : 'Interactive View'}</span>
           </Button>
           <Button 
              onClick={handleSendZohoEmail}
              disabled={isSendingEmail}
              variant="outline"
              className="font-bold border-zinc-200 text-zinc-700 bg-white hover:bg-zinc-50 hover:text-zinc-900"
           >
             {isSendingEmail ? <Loader2 className="w-4 h-4 sm:mr-2 animate-spin" /> : <Mail className="w-4 h-4 sm:mr-2" />}
             <span className="hidden sm:inline">{isSendingEmail ? 'Sending...' : 'Email Copy'}</span>
           </Button>
           <Button 
              onClick={handleSendSms}
              disabled={isSendingSms}
              variant="outline"
              className="font-bold border-zinc-200 text-zinc-700 bg-white hover:bg-zinc-50 hover:text-zinc-900"
           >
             {isSendingSms ? <Loader2 className="w-4 h-4 sm:mr-2 animate-spin" /> : <MessageSquare className="w-4 h-4 sm:mr-2" />}
             <span className="hidden sm:inline">{isSendingSms ? 'Sending...' : 'SMS Copy'}</span>
           </Button>
           <Button 
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              variant="outline"
              className="font-bold border-zinc-200 text-zinc-700 bg-white hover:bg-zinc-50 hover:text-zinc-900"
           >
             {isGeneratingPdf ? <Loader2 className="w-4 h-4 sm:mr-2 animate-spin" /> : <Download className="w-4 h-4 sm:mr-2" />}
             <span className="hidden sm:inline">{isGeneratingPdf ? 'Generating...' : 'Download PDF'}</span>
           </Button>
           <Button 
              onClick={handlePrint}
              variant="outline"
              className="font-bold border-zinc-200 text-zinc-700 bg-white hover:bg-zinc-50 hover:text-zinc-900"
           >
             <Printer className="w-4 h-4 sm:mr-2" />
             <span className="hidden sm:inline">Print</span>
           </Button>
           
           {isAdmin && invoice?.status?.toLowerCase() !== "paid" && (
             <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
               <DialogTrigger render={
                 <Button className="font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md">
                   <DollarSign className="w-4 h-4 sm:mr-2" />
                   <span className="hidden sm:inline">Apply Payment</span>
                 </Button>
               } />
               <DialogContent className="sm:max-w-[425px] bg-white rounded-2xl sm:rounded-2xl">
                 <DialogHeader>
                   <DialogTitle className="text-2xl font-black">Process Payment</DialogTitle>
                 </DialogHeader>
                 <div className="py-6 space-y-4">
                    <div className="p-4 bg-zinc-50 rounded-xl border border-border/50 text-center">
                       <p className="text-xs font-semibold uppercase text-zinc-400 mb-1">Balance Due</p>
                       <p className="text-4xl font-black text-emerald-600">${Number(invoice.amount_due || invoice.total).toFixed(2)}</p>
                    </div>
                    
                    <div className="space-y-4">
                      <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500 pl-1">Payment Method</label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <Button
                          type="button"
                          onClick={() => setPaymentTender("Card")}
                          className={`h-14 font-bold border-2 rounded-xl transition-all ${paymentTender === "Card" ? 'bg-emerald-50 border-emerald-600 text-emerald-700' : 'bg-white border-zinc-200 text-zinc-600 hover:border-emerald-300'}`}
                          variant="outline"
                        >
                          Card
                        </Button>
                        <Button
                          type="button"
                          onClick={() => setPaymentTender("Cash")}
                          className={`h-14 font-bold border-2 rounded-xl transition-all ${paymentTender === "Cash" ? 'bg-emerald-50 border-emerald-600 text-emerald-700' : 'bg-white border-zinc-200 text-zinc-600 hover:border-emerald-300'}`}
                          variant="outline"
                        >
                          Cash
                        </Button>
                        <Button
                          type="button"
                          onClick={() => setPaymentTender("Bank Transfer")}
                          className={`h-14 font-bold border-2 rounded-xl transition-all ${paymentTender === "Bank Transfer" ? 'bg-emerald-50 border-emerald-600 text-emerald-700' : 'bg-white border-zinc-200 text-zinc-600 hover:border-emerald-300'}`}
                          variant="outline"
                        >
                          Bank Deposit
                        </Button>
                      </div>
                    </div>
                 </div>
                 <DialogFooter>
                   <Button 
                      onClick={handleProcessPayment} 
                      disabled={isApplyingPayment}
                      className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-lg shadow-xl shadow-emerald-600/20"
                   >
                     {isApplyingPayment ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Mark as Paid'}
                   </Button>
                 </DialogFooter>
               </DialogContent>
             </Dialog>
           )}
         </div>
      </div>
      
      <div className="flex-1 min-h-0 min-w-0 overflow-y-auto p-4 sm:p-8 flex flex-col lg:flex-row gap-6 justify-center items-start print:p-0 print:overflow-visible print:bg-white print:block">
         {previewMode === "html" ? (
           <div ref={invoiceRef} className="max-w-3xl w-full bg-white shadow-xl rounded-2xl sm:rounded-2xl border border-border/50 p-8 sm:p-12 print:shadow-none print:border-none print:p-0 shrink-0">
             
             {/* Header */}
             <div className="flex justify-between items-start border-b border-border/50 pb-8 mb-8">
               <div>
                 <h2 className="text-4xl font-black tracking-tighter text-primary">INVOICE</h2>
                 <p className="text-sm font-bold text-muted-foreground mt-2 uppercase tracking-wide">{invoice.invoice_number ? invoice.invoice_number.replace(/\D/g, '') : ''}</p>
               </div>
               <div className="text-right">
                 <p className="font-extrabold text-xl text-foreground">{orgDetails.name}</p>
                 {orgDetails.address_line_1 && <p className="text-sm font-medium text-muted-foreground mt-1">{orgDetails.address_line_1}</p>}
                 {orgDetails.address_line_2 && <p className="text-sm font-medium text-muted-foreground">{orgDetails.address_line_2}</p>}
                 {orgDetails.abn && <p className="text-sm font-medium text-muted-foreground mt-1">ABN: {orgDetails.abn}</p>}
               </div>
             </div>
  
             {/* Info Grid */}
             <div className="grid grid-cols-2 gap-8 mb-10">
               <div className="space-y-1">
                 <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">Bill To</p>
                 <p className="font-bold text-lg text-foreground">
                   {customer ? (customer.business_then_name || customer.fullname || `${customer.firstname || customer.first_name || ''} ${customer.lastname || customer.last_name || ''}`.trim() || 'Unknown Customer') : 'Unknown Customer'}
                 </p>
                 {customer?.email && <p className="text-sm font-medium text-muted-foreground">{customer.email}</p>}
                 {customer?.phone && <p className="text-sm font-medium text-muted-foreground">{customer.phone}</p>}
                 {customer?.address && <p className="text-sm font-medium text-muted-foreground mt-1">{customer.address}</p>}
               </div>
               <div className="space-y-4 text-right">
                 <div className="space-y-1">
                   <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1">Issue Date</p>
                   <p className="text-sm font-bold text-foreground">
                     {invoice.issue_date ? format(new Date(invoice.issue_date), 'dd MMM yyyy') : 'N/A'}
                   </p>
                 </div>
                 <div className="space-y-1">
                   <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1">Due Date</p>
                   <p className="text-sm font-bold text-foreground">
                     {invoice.due_date ? format(new Date(invoice.due_date), 'dd MMM yyyy') : 'N/A'}
                   </p>
                 </div>
                 {invoice.ticket_id && (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1">Ticket #</p>
                      <p className="text-sm font-bold text-foreground">{invoice.ticket_id}</p>
                    </div>
                 )}
                 <div className="pt-2">
                   <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${getStatusColor(invoice.status)}`}>
                     {invoice.status?.replace('_', ' ') || 'DRAFT'}
                   </span>
                 </div>
               </div>
             </div>
  
             {/* Line Items */}
             <div className="mb-8">
               <div className="grid grid-cols-12 gap-4 pb-2 border-b-2 border-zinc-100 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                 <div className="col-span-6">Description</div>
                 <div className="col-span-2 text-center">Qty</div>
                 <div className="col-span-2 text-right">Unit Price</div>
                 <div className="col-span-2 text-right">Total</div>
               </div>
               <div className="divide-y divide-zinc-50 border-b border-zinc-100 mb-8">
                 {(invoice.line_items || []).map((item: any, idx: number) => (
                   <div key={idx} className="grid grid-cols-12 gap-4 py-4 text-sm items-center">
                     <div className="col-span-6 font-semibold text-foreground">{item.description || 'Item'}</div>
                     <div className="col-span-2 text-center font-medium text-muted-foreground">{item.quantity}</div>
                     <div className="col-span-2 text-right font-medium text-muted-foreground">${Number(item.unit_amount || item.price || 0).toFixed(2)}</div>
                     <div className="col-span-2 text-right font-bold text-foreground">${(Number(item.quantity || 1) * Number(item.unit_amount || item.price || 0)).toFixed(2)}</div>
                   </div>
                 ))}
                 {!(invoice.line_items?.length) && (
                   <div className="py-8 text-center text-sm font-medium text-muted-foreground">
                     No items included.
                   </div>
                 )}
               </div>
  
               {/* Totals */}
               <div className="flex justify-end">
                 <div className="w-64 space-y-3">
                   <div className="flex justify-between text-sm font-semibold text-muted-foreground">
                     <span>Subtotal</span>
                     <span>${Number(invoice.subtotal || 0).toFixed(2)}</span>
                   </div>
                   <div className="flex justify-between text-sm font-semibold text-muted-foreground">
                     <span>Tax {invoice.line_amount_types === 'Exclusive' ? '(Exclusive)' : ''}</span>
                     <span>${Number(invoice.total_tax || 0).toFixed(2)}</span>
                   </div>
                   <div className="pt-3 border-t-2 border-zinc-900 flex justify-between items-center text-lg">
                     <span className="font-extrabold text-foreground tracking-tight">Total</span>
                     <span className="font-black text-primary">${Number(invoice.total || 0).toFixed(2)}</span>
                   </div>
                   
                   <div className="pt-3 border-t border-zinc-100 flex justify-between text-sm font-semibold text-muted-foreground">
                     <span>Amount Paid</span>
                     <span>${Number(invoice.amount_paid || 0).toFixed(2)}</span>
                   </div>
                   <div className="flex justify-between items-center text-lg">
                     <span className="font-extrabold text-foreground tracking-tight">Amount Due</span>
                     <span className="font-black text-amber-600">${Number(invoice.amount_due || (invoice.total - (invoice.amount_paid || 0))).toFixed(2)}</span>
                   </div>
                 </div>
               </div>
             </div>
  
             {/* Footer */}
             <div className="border-t border-border/50 pt-8 mt-12 text-center text-xs font-medium text-muted-foreground">
               <p className="uppercase tracking-wide font-black mb-1 text-zinc-300">Thank you for your business</p>
               <p>Payment is due within 7 days. Please direct any inquiries to repairs.phonemedic.au@gmail.com.</p>
              </div>
            </div>
         ) : (
           <div className="max-w-4xl w-full bg-zinc-800 shadow-xl rounded-2xl overflow-hidden shrink-0 h-[500px] md:h-[800px] max-h-[85vh] border border-border/50 flex flex-col items-center justify-center">
             {pdfPreviewUrl && !isGeneratingPdf ? (
               <object data={pdfPreviewUrl} type="application/pdf" className="w-full h-full border-none">
                 <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-4">
                    <p className="text-zinc-300">Your browser is blocking the inline PDF preview.</p>
                    <a href={pdfPreviewUrl} download={`Invoice_${invoice?.invoice_number ? invoice.invoice_number.replace(/\D/g, '') : "Receipt"}.pdf`} className="px-6 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700">Download PDF Instead</a>
                 </div>
               </object>
             ) : (
               <div className="text-zinc-400 flex flex-col items-center">
                 <Loader2 className="w-8 h-8 animate-spin mb-4 text-zinc-500" />
                 <p className="font-medium text-sm">Generating PDF Preview...</p>
               </div>
             )}
           </div>
         )}

          {/* Xero Status Block */}
          {previewMode === "pdf" && isXeroConnected && (
            <div className="w-full lg:w-64 bg-white border border-zinc-200 shadow-sm rounded-2xl p-4 space-y-3 shrink-0 print:hidden">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-zinc-900 flex items-center gap-2 text-xs">
                  <RefreshCw className={`w-3 h-3 text-blue-500 ${isSyncingLocal ? 'animate-spin' : ''}`} />
                  Xero Sync
                </h3>
                {invoice.xero_invoice_id ? (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center gap-1">
                    <CheckCircle2 className="w-2.5 h-2.5" />
                    Linked
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-zinc-50 text-zinc-500 border border-zinc-200">
                    Not Linked
                  </span>
                )}
              </div>
              <div className="pt-2 border-t border-zinc-100">
                <div className="text-xs font-medium text-zinc-500 flex justify-between items-center mb-2">
                  <span>Status:</span>
                  <span className={syncJob?.status === 'COMPLETED' ? 'text-emerald-600 font-bold font-mono' : 'text-zinc-700 font-mono'}>
                    {syncJob ? syncJob.status : 'IDLE'}
                  </span>
                </div>
                <Button
                  onClick={handleXeroInvoiceSync}
                  disabled={isSyncingLocal}
                  variant="outline"
                  size="sm"
                  className="w-full text-xs font-medium rounded-lg h-7"
                >
                  {isSyncingLocal ? 'Syncing...' : (invoice.xero_invoice_id ? 'Force Re-sync' : 'Sync to Xero')}
                </Button>
              </div>
            </div>
          )}
          <div style={{ display: "none" }}>
            <div>
           </div>
         </div>
      </div>
    </div>
  );
};
