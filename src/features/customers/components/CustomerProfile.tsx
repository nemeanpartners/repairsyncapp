import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Mail, 
  MapPin, 
  Phone, 
  User, 
  Wrench, 
  Calendar, 
  ChevronRight, 
  MessageSquare,
  Edit,
  Save,
  X,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Loader2,
  Plus,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  HelpCircle,
  ExternalLink,
  ArrowLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { repairShopr } from '@/lib/api';
import { db } from '../../../firebase';
import { collection, query, orderBy, limit, getDocs, doc, setDoc } from 'firebase/firestore';
import { CustomerCallLogs } from './CustomerCallLogs';
import { format } from 'date-fns';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

interface CustomerProfileProps {
  customer: any;
  tickets: any[];
  latestSyncJob?: any;
  onNavigate: (view: any, draft?: string) => void;
  onSelectTicket: (ticket: any) => void;
  onUpdateCustomer: (updatedCustomer: any) => void;
  onDraftMessage?: (msg: string) => void;
  onNewTicket?: () => void;
  onLogCall?: (customer: any) => void;
}

export const CustomerProfile: React.FC<CustomerProfileProps> = ({
  customer,
  tickets,
  latestSyncJob,
  onNavigate,
  onSelectTicket,
  onUpdateCustomer,
  onDraftMessage,
  onNewTicket,
  onLogCall
}) => {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    firstname: customer?.first_name || '',
    lastname: customer?.last_name || '',
    phone: customer?.phone || customer?.mobile || '',
    email: customer?.email || '',
    address: customer?.address || '',
    city: customer?.city || '',
    state: customer?.state || '',
    zip: customer?.zip || ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isLocalSyncing, setIsLocalSyncing] = useState(false);

  const handleXeroSync = async () => {
    if (!customer?.email) {
      toast.error('Email is required', { description: 'Xero requires a valid email address to synchronize contacts.' });
      return;
    }
    try {
      setIsLocalSyncing(true);
      const res = await axios.post('/api/xero/sync/customer', { customerId: customer.id });
      if (res.data?.success) {
        toast.success('Xero sync job queued!', { description: 'The background worker is now linking this customer.' });
      } else {
        toast.error('Failed to trigger synchronization');
      }
    } catch (e: any) {
      console.error(e);
      toast.error('Sync request failed', { description: e.response?.data || e.message });
    } finally {
      setIsLocalSyncing(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      // Construct payload for API
      const payload = {
        firstname: editData.firstname,
        lastname: editData.lastname,
        fullname: `${editData.firstname} ${editData.lastname}`.trim(),
        phone: editData.phone,
        email: editData.email,
        address: editData.address,
        city: editData.city,
        state: editData.state,
        zip: editData.zip
      };
      
      await setDoc(doc(db, "crm_customers", customer.id), payload, { merge: true });
      let updatedCustomer = { 
        ...customer, 
        ...payload
      };

      onUpdateCustomer(updatedCustomer);
      setIsEditing(false);
      toast.success('Customer profile updated');
    } catch (e) {
      console.error(e);
      toast.error('Failed to update customer');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="flex-1 flex flex-col glass-panel min-h-0">
      <div className="border-b border-border/30/30 p-8">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-6 w-full sm:w-auto">
            <Button
              variant="ghost"
              size="icon"
              className="mr-2"
              onClick={() => navigate(`/customers#customer-${customer.id}`)}
              title="Back to Customers"
            >
              <ArrowLeft className="w-6 h-6 text-zinc-500" />
            </Button>
            <Avatar className="w-24 h-24 ring-4 ring-zinc-50 shadow-lg shrink-0">
              <AvatarFallback className="bg-primary text-white text-3xl font-bold">
                {customer?.fullname?.[0] || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              {isEditing ? (
                <div className="flex gap-2 mb-2">
                  <Input 
                    value={editData.firstname || ''} 
                    onChange={e => setEditData({...editData, firstname: e.target.value})}
                    placeholder="First Name" 
                    className="h-10 text-lg font-bold"
                  />
                  <Input 
                    value={editData.lastname || ''} 
                    onChange={e => setEditData({...editData, lastname: e.target.value})}
                    placeholder="Last Name" 
                    className="h-10 text-lg font-bold"
                  />
                </div>
              ) : (
                <h2 className="text-3xl font-bold tracking-tight text-foreground truncate">{customer?.fullname}</h2>
              )}
              
              <div className="flex flex-col gap-3 mt-3">
                 <div className="flex items-center gap-3">
                   <Badge variant="outline" className="bg-primary/5 text-primary border-primary/10 text-[0.7rem] font-bold">
                     Customer ID: {customer?.id}
                   </Badge>
                 </div>
              </div>
            </div>
          </div>
          <div className="flex gap-3 self-end sm:self-auto shrink-0 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0">
            {isEditing ? (
               <>
                  <Button 
                    variant="outline" 
                    className="rounded-xl border-border/30 px-6 font-bold"
                    onClick={() => setIsEditing(false)}
                    disabled={isSaving}
                  >
                    <X className="w-4 h-4 mr-2" /> Cancel
                  </Button>
                  <Button 
                    className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md font-bold"
                    onClick={handleSave}
                    disabled={isSaving}
                  >
                    <Save className="w-4 h-4 mr-2" /> {isSaving ? 'Saving...' : 'Save Changes'}
                  </Button>
               </>
            ) : (
               <>
                  {customer?.email && (
                     <Button 
                       variant="outline"
                       className="rounded-xl bg-white hover:bg-zinc-50 border-border/30 shadow-sm"
                       onClick={() => window.location.href = `mailto:${customer.email}`}
                     >
                       <Mail className="w-4 h-4 mr-2" /> Email
                     </Button>
                  )}
                  <Button 
                    variant="outline"
                    className="rounded-xl bg-white hover:bg-zinc-50 border-border/30 shadow-sm"
                    onClick={() => setIsEditing(true)}
                  >
                    <Edit className="w-4 h-4 mr-2" /> Edit Profile
                  </Button>
                  <Button 
                    className="rounded-xl bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/10"
                    onClick={() => onNavigate('messages')}
                  >
                    <MessageSquare className="w-4 h-4 mr-2" /> Message
                  </Button>
               </>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 min-w-0 overflow-y-auto ">
        <div className="max-w-4xl mx-auto p-4 sm:p-8 space-y-8 pb-32">
          {/* Quick Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Button 
              className="rounded-2xl sm:rounded-2xl h-14 bg-primary/10 hover:bg-primary/20 text-primary font-bold shadow-none border border-primary/20 transition-all flex items-center justify-center gap-2"
              onClick={() => {
                const draftText = `Hi ${customer?.firstname || customer?.first_name || customer?.fullname?.split(' ')[0] || ''}, `;
                if (onDraftMessage) {
                  onDraftMessage(draftText);
                }
                onNavigate('messages', draftText);
              }}
            >
              <MessageSquare className="w-5 h-5" /> Send SMS
            </Button>
            <Button 
              className="rounded-2xl sm:rounded-2xl h-14 bg-white hover:bg-zinc-50 text-zinc-900 font-bold shadow-sm border border-border/30 transition-all flex items-center justify-center gap-2"
              onClick={() => {
                const jobsEl = document.getElementById('customer-job-history');
                if (jobsEl) jobsEl.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              <Wrench className="w-5 h-5 text-zinc-500" /> View Job History
            </Button>
            <Button 
              className="rounded-2xl sm:rounded-2xl h-14 bg-white hover:bg-zinc-50 text-zinc-900 font-bold shadow-sm border border-border/30 transition-all flex items-center justify-center gap-2"
              onClick={() => onNewTicket && onNewTicket()}
            >
              <Plus className="w-5 h-5 text-emerald-500" /> Create New Ticket
            </Button>
          </div>

          {/* Contact Information Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Phone */}
            <Card className={`rounded-2xl border-border/30 shadow-sm transition-all ${isEditing ? 'ring-1 ring-zinc-300' : ''}`}>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-primary/5 rounded-xl flex items-center justify-center">
                    <Phone className="w-5 h-5 text-primary" />
                  </div>
                  <h4 className="font-bold text-foreground">Phone</h4>
                </div>
                {isEditing ? (
                  <Input 
                    value={editData.phone || ''}
                    onChange={e => setEditData({...editData, phone: e.target.value})}
                    placeholder="Phone number"
                    className="mt-2 font-medium"
                  />
                ) : (
                  <>
                    <p className="text-lg font-medium text-zinc-700 truncate">{customer?.phone || customer?.mobile || 'No phone provided'}</p>
                    <div className="flex items-center gap-4 mt-2">
                      <a href={`tel:${customer?.phone || customer?.mobile}`} className="text-primary hover:underline text-xs font-medium">
                        Call Customer
                      </a>
                      <Button variant="link" className="p-0 h-auto text-emerald-600 hover:text-emerald-700 text-xs" onClick={() => onLogCall && onLogCall(customer)}>
                        Log Call
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Email */}
            <Card className={`rounded-2xl border-border/30 shadow-sm transition-all md:col-span-2 lg:col-span-3 ${isEditing ? 'ring-1 ring-zinc-300' : ''}`}>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                    <Mail className="w-5 h-5 text-purple-500" />
                  </div>
                  <h4 className="font-bold text-foreground">Email</h4>
                </div>
                {isEditing ? (
                  <Input 
                    value={editData.email || ''}
                    onChange={e => setEditData({...editData, email: e.target.value})}
                    placeholder="Email address"
                    type="email"
                    className="mt-2 font-medium"
                  />
                ) : (
                  <>
                    <p className="text-lg font-medium text-zinc-700 truncate">{customer?.email || 'No email provided'}</p>
                    {customer?.email && (
                      <Button variant="link" className="p-0 h-auto text-primary text-xs mt-2" onClick={() => window.location.href = `mailto:${customer.email}`}>
                        Send Email
                      </Button>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
            
            {/* Address */}
            <Card className={`rounded-2xl border-border/30 shadow-sm transition-all md:col-span-2 lg:col-span-3 ${isEditing ? 'ring-1 ring-zinc-300' : ''}`}>
              <CardContent className="p-6">
                 <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-emerald-500" />
                  </div>
                  <h4 className="font-bold text-foreground">Address</h4>
                </div>
                {isEditing ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     <div className="space-y-1 sm:col-span-2">
                       <label className="text-xs font-bold text-muted-foreground ml-1">Street Address</label>
                       <Input 
                        value={editData.address || ''}
                        onChange={e => setEditData({...editData, address: e.target.value})}
                        placeholder="Street Address"
                        className="font-medium"
                       />
                     </div>
                     <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-2 space-y-1">
                          <label className="text-xs font-bold text-muted-foreground ml-1">City</label>
                           <Input 
                            value={editData.city || ''}
                            onChange={e => setEditData({...editData, city: e.target.value})}
                            placeholder="City"
                            className="font-medium"
                           />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-muted-foreground ml-1">State</label>
                           <Input 
                            value={editData.state || ''}
                            onChange={e => setEditData({...editData, state: e.target.value})}
                            placeholder="State"
                            className="font-medium"
                           />
                        </div>
                     </div>
                     <div className="space-y-1">
                          <label className="text-xs font-bold text-muted-foreground ml-1">Zip / Postal Code</label>
                           <Input 
                            value={editData.zip || ''}
                            onChange={e => setEditData({...editData, zip: e.target.value})}
                            placeholder="Zip Code"
                            className="font-medium"
                           />
                     </div>
                  </div>
                ) : (
                  <div className="text-lg font-medium text-zinc-700">
                    {customer?.address || customer?.city || customer?.state ? (
                       <p>
                         {customer?.address && `${customer.address}, `}
                         {customer?.city && `${customer.city}, `}
                         {customer?.state && `${customer.state} `}
                         {customer?.zip && `${customer.zip}`}
                       </p>
                    ) : (
                      <span className="text-muted-foreground italic text-sm">No address provided</span>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Xero Accounting Integration Section */}
          <div className="pt-6">
            <Card className="rounded-2xl border border-zinc-200/60 shadow-sm overflow-hidden bg-white">
              <CardContent className="p-6 md:p-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-100">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0">
                      <RefreshCw className={`w-6 h-6 text-blue-500 ${isLocalSyncing || latestSyncJob?.status === 'PENDING' || latestSyncJob?.status === 'PROCESSING' ? 'animate-spin' : ''}`} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
                        Xero Accounting Integration
                        <Badge className={`px-2 py-0.5 rounded-full text-[0.65rem] font-bold uppercase tracking-wide border shadow-none ${
                          customer?.xero_contact_id
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : (isLocalSyncing || latestSyncJob?.status === 'PENDING' || latestSyncJob?.status === 'PROCESSING')
                              ? "bg-amber-50 text-amber-700 border-amber-200 animate-pulse"
                              : latestSyncJob?.status === 'FAILED'
                                ? "bg-rose-50 text-rose-700 border-rose-200"
                                : "bg-zinc-100 text-zinc-600 border-zinc-200"
                        }`}>
                          {customer?.xero_contact_id
                            ? "Synced"
                            : (isLocalSyncing || latestSyncJob?.status === 'PENDING' || latestSyncJob?.status === 'PROCESSING')
                              ? "Syncing"
                              : latestSyncJob?.status === 'FAILED'
                                ? "Sync Error"
                                : "Not Synced"
                          }
                        </Badge>
                      </h3>
                      <p className="text-zinc-500 text-sm mt-0.5">Manage contacts and accounting synchronization</p>
                    </div>
                  </div>
                  
                  {customer?.xero_contact_id && (
                    <Button 
                      onClick={handleXeroSync}
                      disabled={isLocalSyncing || latestSyncJob?.status === 'PENDING' || latestSyncJob?.status === 'PROCESSING'}
                      variant="outline"
                      className="rounded-xl px-4 border-zinc-200 shadow-sm text-xs font-bold shrink-0 self-start sm:self-auto flex items-center gap-2 hover:bg-zinc-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLocalSyncing || latestSyncJob?.status === 'PENDING' || latestSyncJob?.status === 'PROCESSING' ? 'animate-spin' : ''}`} />
                      {isLocalSyncing || latestSyncJob?.status === 'PENDING' || latestSyncJob?.status === 'PROCESSING' ? 'Syncing...' : 'Force Re-sync'}
                    </Button>
                  )}
                </div>

                <div className="pt-6 space-y-4">
                  {customer?.xero_contact_id ? (
                    <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100 text-sm text-emerald-850 flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="font-semibold text-emerald-900">Successfully matched and linked to Xero</p>
                        <p className="text-emerald-750 text-xs">
                          Xero Contact ID: <code className="bg-emerald-100/60 px-1 py-0.5 rounded font-mono text-[11px] font-semibold">{customer.xero_contact_id}</code>
                        </p>
                        <p className="text-emerald-600 text-xs mt-2">
                          All new invoices, estimates, and payment reconciliations generated in RepairSync for this customer will flow automatically and securely to Xero under this linked contact.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Check if contact lacks email */}
                      {!customer?.email ? (
                        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100 text-sm text-rose-850 flex items-start gap-3">
                          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                          <div className="space-y-1">
                            <p className="font-semibold text-rose-900">Email Address Required</p>
                            <p className="text-rose-700 text-xs">
                              Xero demands a verified email address to link or create accounts securely. Please fill in an email address for this customer to enable profile synchronization.
                            </p>
                            <div className="pt-2">
                              <Button 
                                onClick={() => setIsEditing(true)} 
                                variant="link" 
                                className="p-0 h-auto text-rose-850 hover:text-rose-950 font-bold text-xs underline"
                              >
                                Edit profile to add email
                              </Button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200/60 text-sm flex items-start gap-3">
                            <HelpCircle className="w-5 h-5 text-zinc-500 shrink-0 mt-0.5" />
                            <div className="space-y-1 text-zinc-600 w-full">
                              <p className="font-semibold text-zinc-800">Ready to Synchronize Safely</p>
                              <p className="text-xs">
                                Our sync engine utilizes a <strong>safe duplicate-matching algorithm</strong> with Xero:
                              </p>
                              <ul className="list-disc pl-4 text-xs space-y-1 pt-1.5 text-zinc-500">
                                <li>Scan your Xero directory for a contact with matching email: <strong className="text-zinc-700">{customer.email}</strong>.</li>
                                <li>If a match is found, link directly to avoid duplicate entries.</li>
                                <li>If no matching contact exists, create a brand-new contact safely in Xero.</li>
                              </ul>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 pt-2">
                            <Button 
                              onClick={handleXeroSync}
                              disabled={isLocalSyncing || latestSyncJob?.status === 'PENDING' || latestSyncJob?.status === 'PROCESSING'}
                              className="rounded-xl px-5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-sm flex items-center gap-2"
                            >
                              {isLocalSyncing || latestSyncJob?.status === 'PENDING' || latestSyncJob?.status === 'PROCESSING' ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  Synchronizing Profile...
                                </>
                              ) : (
                                <>
                                  <RefreshCw className="w-4 h-4" />
                                  Sync Customer to Xero
                                </>
                              )}
                            </Button>
                            <span className="text-xs text-zinc-400 font-medium">Safe match on email address</span>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Operational Alerts for active jobs */}
                  {latestSyncJob && (latestSyncJob.status === 'PENDING' || latestSyncJob.status === 'PROCESSING') && (
                    <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-100 flex items-center gap-3 text-xs text-blue-700">
                      <Loader2 className="w-4 h-4 animate-spin text-blue-500 shrink-0" />
                      <div>
                        <span className="font-bold">Sync Progress</span>: Our background worker is actively syncing contact details with Xero (Status: <span className="uppercase font-semibold text-blue-800">{latestSyncJob.status}</span>, Job ID: <span className="font-mono">{latestSyncJob.id}</span>).
                      </div>
                    </div>
                  )}

                  {/* Sync Failure Detail & Troubleshooting alerts */}
                  {latestSyncJob?.status === 'FAILED' && (
                    <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100 text-sm flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                      <div className="space-y-1 w-full">
                        <p className="font-semibold text-rose-900">Synchronization Error Reported</p>
                        <p className="text-rose-700 text-xs font-mono bg-rose-100/60 p-2.5 rounded-lg border border-rose-200 mt-1">
                          {latestSyncJob.last_error || "Unknown Xero API Fault"}
                        </p>
                        <p className="text-rose-600 text-xs mt-2">
                          <strong>Troubleshooting:</strong> Ensure that the customer's name contains only standard alphanumeric letters, the email is unique, and that Xero has been connected in Settings. Once corrected, clicking <strong>Sync Customer to Xero</strong> will re-queue the operation.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Job History Section */}
          <div id="customer-job-history" className="space-y-4 pt-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                <Wrench className="w-5 h-5 text-zinc-400" />
                Linked Tickets / Service History
              </h3>
              <Badge className="bg-zinc-100 text-zinc-600 border-none">
                {tickets.length} Total Jobs
              </Badge>
            </div>

            {tickets.filter(t => String(t.customer_id) === String(customer.id)).length > 0 ? (
              <div className="grid grid-cols-1 gap-4">
                {tickets.filter(t => String(t.customer_id) === String(customer.id)).map(ticket => (
                  <Card 
                    key={ticket.id} 
                    className="relative rounded-[1.5rem] border border-zinc-200/60 shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-300 cursor-pointer group overflow-hidden bg-white/60 hover:bg-white"
                    onClick={() => {
                      onSelectTicket(ticket);
                    }}
                  >
                    <div className="absolute top-0 left-0 w-1 h-full bg-primary/0 group-hover:bg-primary/80 transition-colors duration-300" />
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex flex-col">
                          <span className="font-bold text-zinc-900 flex items-center gap-2">
                            #{ticket.number}
                            {ticket.is_urgent && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" title="Urgent" />}
                          </span>
                          <h4 className="font-bold text-foreground group-hover:text-primary transition-colors text-lg mt-1 tracking-tight">
                            {ticket.subject}
                          </h4>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge className={`inline-flex items-center px-2 py-0.5 rounded-full text-[0.65rem] font-bold uppercase tracking-wide border shadow-none ${
                            ticket.status === "Resolved" || ticket.status === "Ready for Pickup"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                              : ticket.status === "In Progress"
                                ? "bg-amber-50 text-amber-700 border-amber-100"
                                : ticket.status === "New"
                                  ? "bg-blue-50 text-blue-700 border-blue-100"
                                  : ticket.status === "Waiting on Customer"
                                    ? "bg-purple-50 text-purple-700 border-purple-100"
                                    : ticket.status === "Waiting on Parts"
                                      ? "bg-rose-50 text-rose-700 border-rose-100"
                                      : ticket.status === "Repair in progress" || ticket.status === "Repair in Progress"
                                        ? "bg-blue-50 text-blue-700 border-blue-100"
                                        : "bg-zinc-100 text-zinc-600 border-border/30"
                          }`}>
                            {ticket.status}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-sm text-zinc-600 font-medium mb-4">
                        Type: {ticket.issue_type || ticket.repair_category || 'General Repair'}
                      </p>
                      <div className="pt-4 border-t border-zinc-100 flex items-center justify-between">
                        <div className="flex items-center gap-4 text-xs text-zinc-400">
                          <span className="flex items-center gap-1.5 font-medium">
                            <Calendar className="w-3.5 h-3.5" /> Updated recently
                          </span>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-primary/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                           <ChevronRight className="w-4 h-4 text-primary" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="bg-white/40 border border-dashed border-border/30 rounded-2xl py-16 text-center">
                <div className="w-16 h-16 bg-secondary/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Wrench className="w-8 h-8 text-zinc-300" />
                </div>
                <p className="text-muted-foreground font-medium">No job history found for this customer.</p>
              </div>
            )}
          </div>

          {/* Call Logs Section */}
          <div className="space-y-4 pt-6 pb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                  <Phone className="w-5 h-5 text-zinc-400" />
                  Call Logs
                </h3>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => onLogCall && onLogCall(customer)}
                className="bg-white hover:bg-zinc-50 border-border/30 rounded-xl"
              >
                <Plus className="w-4 h-4 mr-2" /> Log Call
              </Button>
            </div>

            <CustomerCallLogs customer={customer} />
          </div>
        </div>
      </div>
    </section>
  );
};
