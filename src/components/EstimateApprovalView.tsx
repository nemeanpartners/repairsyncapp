import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, addDoc, collection, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Button } from './ui/button';
import { Loader2, CheckCircle2, AlertTriangle, AlertCircle, FileText, Mail, MessageSquare } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';

export const EstimateApprovalView = ({ estimateId, onBack }: { estimateId: string, onBack?: () => void }) => {
  const [loading, setLoading] = useState(true);
  const [estimate, setEstimate] = useState<any>(null);
  const [ticket, setTicket] = useState<any>(null);
  const [customer, setCustomer] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [orgDetails, setOrgDetails] = useState({
    name: "Phone Medic",
    address_line_1: "123 Tech Lane",
    address_line_2: "Sydney, NSW 2000",
    abn: "12 345 678 901",
  });

  useEffect(() => {
    const fetchEstimate = async () => {
      try {
        let estDoc = await getDoc(doc(db, 'estimates', estimateId));
        if (!estDoc.exists()) {
          estDoc = await getDoc(doc(db, 'crm_estimates', estimateId));
        }
        
        if (estDoc.exists()) {
          const estData = estDoc.data();
          setEstimate({ id: estDoc.id, ...estData });

          if (estData.ticket_id) {
            const ticDoc = await getDoc(doc(db, 'crm_tickets', estData.ticket_id));
            if (ticDoc.exists()) {
              setTicket({ id: ticDoc.id, ...ticDoc.data() });
            }
          }
          if (estData.customer_id) {
            const custDoc = await getDoc(doc(db, 'crm_customers', estData.customer_id));
            if (custDoc.exists()) {
              setCustomer({ id: custDoc.id, ...custDoc.data() });
            }
          }
          
          try {
            const orgSnap = await getDoc(doc(db, "settings", "organization"));
            if (orgSnap.exists()) {
              setOrgDetails((prev) => ({ ...prev, ...orgSnap.data() }));
            }
          } catch (e) {
            console.error("Failed to load org details", e);
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchEstimate();
  }, [estimateId]);

  const handleSendEmailRequest = async () => {
    if (!customer?.email) {
      toast.error("Customer has no email address.");
      return;
    }
    setActionLoading(true);
    try {
      const url = `${window.location.origin}/estimate/${estimate.id}`;
      const subject = `Repair Estimate for your device`;
      const body = `Hi ${customer?.firstname || customer?.fullname || 'there'},<br><br>We've prepared a repair estimate for your device.<br><br>Please review and approve or decline by clicking the link below:<br><a href="${url}">${url}</a><br><br>Thank you,<br>Phone Medic Team`;
      
      const { default: axios } = await import("axios");
      await axios.post("/api/zoho/send", {
        toAddress: customer.email,
        subject,
        content: body,
      });
      toast.success("Email approval request sent!");
    } catch (e) {
      console.error(e);
      toast.error("Failed to send email request.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendSmsRequest = async () => {
    if (!customer?.phone && !customer?.mobile) {
      toast.error("Customer has no phone number.");
      return;
    }
    const phone = customer.phone || customer.mobile;
    setActionLoading(true);
    try {
      const { mobileMessage } = await import("../lib/api");
      const url = `${window.location.origin}/estimate/${estimate.id}`;
      const msg = `Hi ${customer?.firstname || customer?.fullname || 'there'}, we've prepared a repair estimate for your device. Please review and reply YES to approve or NO to decline. You can view the details here: ${url}`;
      await mobileMessage.sendSms(phone, msg, estimate.id, ticket?.id);
      toast.success("SMS approval request sent!");
    } catch (e) {
      console.error(e);
      toast.error("Failed to send SMS request.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAction = async (status: 'approved' | 'declined') => {
    if (!estimate) return;
    setActionLoading(true);
    try {
      try {
        await updateDoc(doc(db, 'estimates', estimate.id), {
          status,
          updated_at: new Date()
        });
      } catch(e) {}
      
      try {
        await updateDoc(doc(db, 'crm_estimates', estimate.id), {
          status,
          updated_at: new Date()
        });
      } catch(e) {}
      
      setEstimate({ ...estimate, status });

      if (status === 'approved' && ticket) {
        await updateDoc(doc(db, 'crm_tickets', ticket.id), {
          status: 'Waiting for Parts',
          priority: 'Urgent',
          is_approved: true,
          updated_at: new Date()
        });
        
        // Auto-add line items as charges to the ticket
        const existingItemsSnap = await getDocs(
          query(collection(db, "crm_line_items"), where("ticket_id", "==", ticket.id))
        );
        const existingEstimateItemIds = new Set(
          existingItemsSnap.docs.map(doc => doc.data().estimate_item_id).filter(Boolean)
        );

        if (estimate.line_items && Array.isArray(estimate.line_items)) {
          for (const item of estimate.line_items) {
            if (item.id && existingEstimateItemIds.has(item.id)) {
              continue; // Already added as a charge!
            }
            await addDoc(collection(db, "crm_line_items"), {
              ticket_id: ticket.id,
              name: item.name || item.description || "Estimate Charge",
              price: Number(item.unit_price || item.price || 0),
              quantity: Number(item.quantity || 1),
              created_at: serverTimestamp(),
              uid: "customer-portal",
              estimate_item_id: item.id || null,
            });
          }
        }
        
        // Add note
        await addDoc(collection(db, "crm_notes"), {
          ticket_id: ticket.id,
          body: `Estimate ${estimate.estimate_number || estimate.id} was APPROVED by the customer via the portal. Automatically added line items to ticket.`,
          subject: "Estimate Approved",
          tech: "System Dashboard",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }

      toast.success(status === 'approved' ? 'Estimate Approved' : 'Estimate Declined');
    } catch (e) {
      console.error(e);
      toast.error('Failed to update estimate status');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-secondary/30">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!estimate) {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-secondary/30 p-6 space-y-4">
        <AlertCircle className="w-12 h-12 text-zinc-400" />
        <h2 className="text-xl font-bold">Estimate Not Found</h2>
        <p className="text-muted-foreground text-center">This estimate might have been deleted or the link is invalid.</p>
        {onBack && <Button onClick={onBack}>Go Back</Button>}
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-transparent p-6 sm:p-12 font-sans flex justify-center">
      <div className="w-full max-w-3xl glass-panel shadow-[0_8px_30px_rgba(0,0,0,0.04)] ring-1 ring-white/60 rounded-2xl overflow-hidden h-fit">
        {/* Header */}
        <div className="p-8 border-b border-zinc-200/50 flex justify-between items-start relative">
          <div className="space-y-4">
            {onBack && (
              <Button variant="ghost" className="h-8 px-2 text-zinc-500 hover:text-zinc-900 -ml-2 mb-2" onClick={onBack}>
                ← Back
              </Button>
            )}
            <h1 className="text-3xl font-medium tracking-tight flex items-center gap-2 text-zinc-800">
              <FileText className="w-8 h-8 text-primary" /> 
              Repair Estimate
            </h1>
            <p className="text-zinc-500 font-mono text-sm tracking-wide pl-10">EST-{estimate.id.substring(0, 6).toUpperCase()}</p>
          </div>
          <div className="text-right">
            <h2 className="font-bold text-xl uppercase tracking-wide text-zinc-400">{orgDetails.name}</h2>
            {orgDetails.address_line_1 && <p className="text-sm text-zinc-500 mt-1">{orgDetails.address_line_1}</p>}
            {orgDetails.address_line_2 && <p className="text-sm text-zinc-500">{orgDetails.address_line_2}</p>}
            {orgDetails.abn && <p className="text-sm text-zinc-500 mt-1">ABN: {orgDetails.abn}</p>}
          </div>
        </div>

        {/* Info Box */}
        <div className="grid grid-cols-2 p-8 border-b border-border/30 gap-8">
          <div className="space-y-4">
            <h3 className="font-bold text-zinc-400 text-xs tracking-wide uppercase">Bill To</h3>
            {customer ? (
              <div className="space-y-1">
                <p className="font-medium text-lg text-foreground">{customer.business_then_name || customer.fullname || `${customer.firstname || customer.first_name || ''} ${customer.lastname || customer.last_name || ''}`.trim() || 'Unknown Customer'}</p>
                {customer.phone && <p className="text-zinc-600">{customer.phone}</p>}
                {customer.email && <p className="text-zinc-600">{customer.email}</p>}
              </div>
            ) : (
              <p className="text-zinc-400 italic">Customer details not available</p>
            )}
          </div>
          <div className="space-y-4">
            <h3 className="font-bold text-zinc-400 text-xs tracking-wide uppercase">Job Details</h3>
            {ticket ? (
              <div className="space-y-1">
                <p className="font-medium text-foreground line-clamp-1">{ticket.subject || ticket.device_model || 'Repair Job'}</p>
                <p className="text-zinc-600 line-clamp-2">{ticket.problem_type || ticket.issue_description || 'Diagnosis and Repair'}</p>
                {ticket.ticket_number && <p className="text-muted-foreground font-mono text-xs mt-2">Ticket #{ticket.ticket_number}</p>}
              </div>
            ) : (
              <p className="text-zinc-400 italic">Ticket details not available</p>
            )}
          </div>
        </div>

        {/* Line Items */}
        <div className="p-8">
          <h3 className="font-bold text-foreground text-lg mb-4">Estimated Charges</h3>
          <div className="rounded-2xl sm:rounded-2xl border border-border/30 overflow-x-auto ">
            <table className="w-full min-w-[500px] text-sm text-left">
              <thead className="bg-secondary/30 border-b border-border/30">
                <tr>
                  <th className="px-6 py-4 font-bold text-zinc-700">Description</th>
                  <th className="px-6 py-4 font-bold text-zinc-700 text-center w-24">Qty</th>
                  <th className="px-6 py-4 font-bold text-zinc-700 text-right w-32">Price</th>
                  <th className="px-6 py-4 font-bold text-zinc-700 text-right w-32">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {(estimate.lineItems || estimate.line_items || []).map((item: any, idx: number) => {
                  const desc = item.name || item.description;
                  const price = item.price !== undefined ? item.price : item.unit_amount;
                  return (
                  <tr key={idx} className="hover:bg-secondary/30/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-foreground">{desc}</td>
                    <td className="px-6 py-4 text-center text-zinc-600">{item.quantity}</td>
                    <td className="px-6 py-4 text-right text-zinc-600">${Number(price || 0).toFixed(2)}</td>
                    <td className="px-6 py-4 text-right font-medium text-foreground">${(Number(price || 0) * Number(item.quantity || 1)).toFixed(2)}</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end pt-8">
            <div className="w-72 bg-secondary/30 rounded-2xl sm:rounded-2xl p-6 border border-border/30 space-y-4">
              <div className="flex justify-between items-center text-xl font-black text-foreground">
                <span>Total Estimate</span>
                <span>${Number(estimate.total || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Area */}
        <div className="p-8 bg-secondary/30 mt-4 border-t border-border/30 flex flex-col items-center justify-center space-y-6">
          {((estimate.status || '').toLowerCase() === 'pending' || (estimate.status || '').toLowerCase() === 'draft') ? (
            <>
              <p className="text-zinc-600 text-center max-w-lg">
                Please review the estimate above. If you approve, we will begin the repair and move the job to "Approved".
              </p>
              <div className="flex gap-4 w-full justify-center flex-wrap">
                <Button 
                  size="lg"
                  variant="outline"
                  className="flex-1 sm:flex-none border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 h-14 px-8 text-base font-bold rounded-xl"
                  disabled={actionLoading}
                  onClick={() => handleAction('declined')}
                >
                  Decline
                </Button>
                <Button 
                  size="lg"
                  className="flex-1 sm:flex-none border border-zinc-200 text-zinc-700 hover:bg-zinc-100 bg-white shadow-sm h-14 px-8 text-base font-bold rounded-xl"
                  disabled={actionLoading}
                  onClick={handleSendEmailRequest}
                >
                  {actionLoading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Mail className="w-5 h-5 mr-2" />}
                  Request via Email
                </Button>
                <Button 
                  size="lg"
                  className="flex-1 sm:flex-none border border-zinc-200 text-zinc-700 hover:bg-zinc-100 bg-white shadow-sm h-14 px-8 text-base font-bold rounded-xl"
                  disabled={actionLoading}
                  onClick={handleSendSmsRequest}
                >
                  {actionLoading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <MessageSquare className="w-5 h-5 mr-2" />}
                  Request via SMS
                </Button>
                <Button 
                  size="lg"
                  className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 text-white h-14 px-8 text-base font-bold rounded-xl"
                  disabled={actionLoading}
                  onClick={() => handleAction('approved')}
                >
                  {actionLoading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <CheckCircle2 className="w-5 h-5 mr-2" />}
                  Approve Estimate
                </Button>
              </div>
            </>
          ) : (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`flex items-center gap-3 px-6 py-4 rounded-2xl sm:rounded-2xl font-bold text-lg
                ${(estimate.status || '').toLowerCase() === 'approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}
            >
              {(estimate.status || '').toLowerCase() === 'approved' ? (
                <><CheckCircle2 className="w-6 h-6" /> Estimate Approved</>
              ) : (
                <><AlertTriangle className="w-6 h-6" /> Estimate Declined</>
              )}
            </motion.div>
          )}
        </div>

      </div>
    </div>
  );
};
