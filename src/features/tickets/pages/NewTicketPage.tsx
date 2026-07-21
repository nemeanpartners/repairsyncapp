import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '../../../firebase';
import { collection, addDoc, doc, setDoc, serverTimestamp, getDocs, runTransaction, arrayUnion } from 'firebase/firestore';
import { X, User, LogIn, ChevronRight, Check, MapPin, Search, Wrench, Package, Cpu, CheckCircle2, Phone, Mail, Tablet, Laptop, Monitor, Gamepad2, Watch, Smartphone, MoreHorizontal, Hash, Tag, Loader2, Disc, ChevronDown, ChevronUp } from 'lucide-react';
import { SubjectAutocomplete } from '../components/SubjectAutocomplete';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DebouncedInput } from '@/components/ui/debounced-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import axios from 'axios';
import { motion, AnimatePresence } from 'motion/react';
import { normalizePhone } from '@/lib/utils';

export const REPAIR_CATEGORIES = [
  { name: 'Phone Repair', icon: Smartphone, color: 'bg-blue-500' },
  { name: 'Tablet Repair', icon: Tablet, color: 'bg-emerald-500' },
  { name: 'Laptop Repair', icon: Laptop, color: 'bg-indigo-500' },
  { name: 'Desktop Repair', icon: Monitor, color: 'bg-zinc-500' },
  { name: 'Console Repair', icon: Gamepad2, color: 'bg-red-500' },
  { name: 'Smartwatch Repair', icon: Watch, color: 'bg-orange-500' },
  { name: 'Robovac Repair', icon: Disc, color: 'bg-teal-500' },
  { name: 'Accessories', icon: Package, color: 'bg-purple-500' },
  { name: 'Other', icon: MoreHorizontal, color: 'bg-zinc-400' }
];

export const DEVICE_BRANDS = [
  'Apple', 'Samsung', 'Google', 'Microsoft', 'Sony', 'Asus', 'Dell', 'HP',
  'Lenovo', 'Acer', 'Nintendo', 'Oppo', 'Vivo', 'Xiaomi', 'Dyson', 'Ecovacs', 'Roborock', 'iRobot', 'Dreame', 'Other'
];

function AddressAutocomplete({ value, onChange, onSelect }: { value: string, onChange: (v: string) => void, onSelect: (addressData: any) => void }) {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: any) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchSuggestions = async (query: string) => {
    if (!query || query.length < 3) {
      setSuggestions([]);
      return;
    }
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=au&addressdetails=1&limit=5`);
      const data = await response.json();
      setSuggestions(data);
      setIsOpen(true);
    } catch (e) {
      console.error("Address auto-complete error", e);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (value && isOpen) {
        fetchSuggestions(value);
      }
    }, 600);
    return () => clearTimeout(timeoutId);
  }, [value, isOpen]);

  return (
    <div ref={wrapperRef} className="relative w-full">
      <DebouncedInput 
        className="bg-zinc-100 border-none rounded-xl h-11 focus-visible:ring-0 focus-visible:border-zinc-300" 
        value={value} 
        onChange={v => {
          onChange(v);
          setIsOpen(true);
        }}
        onFocus={() => {
          if (suggestions.length > 0) setIsOpen(true);
        }}
        placeholder="Start typing an address..."
      />
      <MapPin className="w-4 h-4 text-zinc-400 absolute right-3 top-3.5 pointer-events-none" />
      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-[100] w-full mt-2 bg-white border border-zinc-100 rounded-2xl sm:rounded-2xl shadow-xl overflow-hidden max-h-60 overflow-y-auto  animate-in fade-in slide-in-from-top-2">
          {suggestions.map((s, idx) => (
            <div 
              key={idx} 
              className="p-4 hover:bg-zinc-50 cursor-pointer border-b last:border-0 border-zinc-100 transition-colors"
              onClick={() => {
                onSelect(s);
                setIsOpen(false);
              }}
            >
              <p className="text-sm font-bold text-zinc-900">{s.display_name}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export const JOB_STATUSES = [
  'New', 'Your Turn', 'Job Ready', 'Awaiting Approval', 'Follow Up', 'Approved',
  'Service Reminder', 'Add-on Repair', 'Hold - Waiting for Parts', 'Completed',
  'Unrepairable', 'Warranty return', 'Diagnosing'
];

import { useNavigate, useLocation } from 'react-router-dom';
import { useShop } from '../../../providers/ShopProvider';
import { useSettings } from '../../../providers/SettingsProvider';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CustomerSearchBox } from '../../customers/components/CustomerSearchBox';
import { NormalizedCustomer } from '../../../hooks/customers/useCustomerSearch';
import { Plus, Grid3x3 } from 'lucide-react';

function PatternLockBox({ value, onChange }: { value: string, onChange: (v: string) => void }) {
  // If the value isn't a pattern (doesn't have dashes and isn't just numbers), we don't parse it well, but it's fine.
  const isPattern = !value || /^[1-9](-[1-9])*$/.test(value);
  const pattern = (isPattern && value) ? value.split('-').map(Number) : [];

  const handleDotClick = (i: number) => {
    if (!isPattern) {
      // If they typed something manually then click a dot, wipe it
      onChange(i.toString());
      return;
    }
    if (!pattern.includes(i)) {
      const newPattern = [...pattern, i];
      onChange(newPattern.join("-"));
    }
  };

  const currentPatternStr = pattern.length > 0 ? "Pattern: " + pattern.join("-") : "Tap dots in order";

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-sm font-bold text-zinc-700 h-5">{isPattern ? currentPatternStr : "Custom Password..."}</div>
      <div className="grid grid-cols-3 gap-5 p-6 bg-zinc-900 rounded-2xl select-none">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => {
          const index = Array.isArray(pattern) ? pattern.indexOf(i) : -1;
          const isSelected = index !== -1;
          return (
            <div
              key={i}
              onClick={() => handleDotClick(i)}
              className={`w-12 h-12 rounded-full flex items-center justify-center cursor-pointer transition-all duration-200 shadow-inner ${
                 isSelected ? "bg-emerald-500 scale-110 shadow-[0_0_15px_rgba(16,185,129,0.5)]" : "bg-zinc-700 hover:bg-zinc-600"
              }`}
            >
               {isSelected && (
                  <span className="text-white text-sm font-bold">{index + 1}</span>
               )}
            </div>
          );
        })}
      </div>
      <div className="flex gap-2 w-full justify-center">
        <Button type="button" variant="outline" size="sm" onClick={() => onChange("")} className="text-xs h-8">
          Clear
        </Button>
      </div>
    </div>
  );
}

export function NewTicketPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { } = useShop();
  const { settings, updateSettings } = useSettings();

  const [step, setStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const onClose = () => navigate('/tickets');
  const onTicketCreated = (custId: string, tickId: string) => navigate(`/tickets/${tickId}`);

  // Customer State
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  
  const [customer, setCustomer] = useState<any>({
    firstname: '',
    lastname: '',
    phone: '',
    mobile: '',
    email: '',
    address: ''
  });

  // Ticket State
  const [ticket, setTicket] = useState<any>({
    subject: '',
    repair_category: '',
    brand: '',
    device_model: '',
    device_password: '',
    imei: '',
    accessories: '',
    visual_condition: '',
    problem_type: '',
    status: 'New',
    priority: 'Normal',
    tags: []
  });

  const [newTag, setNewTag] = useState('');
  const [isManualModel, setIsManualModel] = useState(false);
  const [isManualBrand, setIsManualBrand] = useState(false);
  const [showAdvancedExt, setShowAdvancedExt] = useState(false);

  const deviceBrands = settings?.devices?.brands || [];
  const brandNames = Array.from(new Set([...deviceBrands.map(b => b.name), ...DEVICE_BRANDS]));
  const modelsForBrand = deviceBrands.find(b => b.name === ticket.brand)?.models || [];

  const addTag = () => {
    if (newTag.trim()) {
      const updatedTags = [...(ticket.tags || []), newTag.trim()];
      setTicket({ ...ticket, tags: updatedTags });
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    const updatedTags = (ticket.tags || []).filter((tag: string) => tag !== tagToRemove);
    setTicket({ ...ticket, tags: updatedTags });
  };

  useEffect(() => {
    setStep(1);
    setErrors({});
    
    const voiceData = location.state?.voiceIntakeData;
    if (voiceData) {
      setTicket({
        subject: voiceData.subject || '',
        repair_category: voiceData.repairCategory || 'Other',
        brand: voiceData.deviceModel?.split(' ')[0] || 'Other',
        device_model: voiceData.deviceModel || '',
        device_password: '',
        imei: '',
        accessories: '',
        visual_condition: '',
        problem_type: voiceData.issueSummary || '',
        issue_description: voiceData.issueSummary || '',
        status: 'New',
        priority: voiceData.priority || 'Normal',
        tags: []
      });
      setStep(2);
    } else {
      setTicket({ subject: '', repair_category: '', brand: '', device_model: '', device_password: '', imei: '', accessories: '', visual_condition: '', problem_type: '', status: 'New', priority: 'Normal', tags: [] });
    }

    setIsNewCustomer(false);
    setSelectedCustomerId(null);
    setCustomer({ firstname: '', lastname: '', phone: '', email: '', address: '' });
  }, [location.state]);

  const selectExistingCustomer = (c: NormalizedCustomer) => {
    setSelectedCustomerId(c.customerId);
    setCustomer({ 
      ...c, 
      firstname: c.firstName || '', 
      lastname: c.lastName || '' 
    }); // populate fields for visibility
    setIsNewCustomer(false);
  };

  const validateStep1 = () => {
    if (isNewCustomer) {
      if (!customer.firstname || (!customer.phone && !customer.email)) {
        toast.error("First name, and either phone or email are required.");
        return false;
      }
    } else {
      if (!selectedCustomerId) {
        toast.error("Please select an existing customer.");
        return false;
      }
    }
    return true;
  };

  const validateStep2 = () => {
    const newErrors: Record<string, string> = {};
    if (!ticket.subject || !ticket.subject.trim()) {
      newErrors.subject = "Subject is required";
      toast.error("Subject is required");
    }
    if (!ticket.repair_category) {
      newErrors.repair_category = "Category is required";
    }
    if (!ticket.brand) {
      newErrors.brand = "Brand is required";
    }

    if (Object.keys(newErrors).length > 0 && !newErrors.subject) {
      toast.error("Category and Brand are required.");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) setStep(2);
    else if (step === 2 && validateStep2()) setStep(3);
  };

  const handleCreate = async () => {
    if (!auth.currentUser) return;
    setIsSaving(true);
    
    try {
      let finalCustId = selectedCustomerId;
      let finalCustomerData = { ...customer };

      // 1. Create or Update Customer
      const custDataToSave: any = {
        ...customer,
        fullname: `${customer.firstname || ''} ${customer.lastname || ''}`.trim(),
        business_and_full_name: `${customer.firstname || ''} ${customer.lastname || ''}`.trim(),
        phone: normalizePhone(customer.phone),
        mobile: normalizePhone(customer.mobile),
        updated_at: new Date().toISOString(),
        uid: auth.currentUser.uid
      };

      if (isNewCustomer || !finalCustId) {
        custDataToSave.created_at = new Date().toISOString();
        const crmRef = await addDoc(collection(db, 'crm_customers'), custDataToSave);
        finalCustId = crmRef.id;
      } else {
        await setDoc(doc(db, 'crm_customers', finalCustId), custDataToSave, { merge: true });
      }

      // 2. Create Ticket
      const tickData = {
        customer_id: finalCustId,
        customer_name: `${customer.firstname || ''} ${customer.lastname || ''}`.trim(),
        customer_firstname: customer.firstname || '',
        customer_lastname: customer.lastname || '',
        uid: auth.currentUser.uid,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        subject: ticket.subject || 'Ticket',
        problem_type: ticket.problem_type || '',
        issue_description: ticket.issue_description || ticket.problem_type || '', // fallback to problem_type
        device_model: ticket.device_model || '',
        device_password: ticket.device_password || '',
        imei: ticket.imei || '',
        accessories: ticket.accessories || '',
        visual_condition: ticket.visual_condition || '',
        assigned_to: ticket.assigned_to || '',
        due_date: ticket.due_date || '',
        properties: {
          "Device": ticket.device_model || '',
          "Password": ticket.device_password || '',
          "Serial Number": ticket.imei || '',
          "Accessories Included": ticket.accessories || '',
          "Visual Condition": ticket.visual_condition || '',
          ...(ticket.properties || {})
        },
        repair_category: ticket.repair_category || 'Mobile',
        brand: ticket.brand || '',
        status: 'New',
        priority: ticket.priority || 'Normal',
        source: 'Wizard',
        tags: ticket.tags || [],
      };

      const newTicketNumber = await runTransaction(db, async (transaction) => {
        const settingsRef = doc(db, 'settings', 'ticket_manager');
        const settingsDoc = await transaction.get(settingsRef);
        let currentNumber = 40000;
        if (settingsDoc.exists() && settingsDoc.data().startNumber) {
           currentNumber = parseInt(settingsDoc.data().startNumber, 10);
           if (isNaN(currentNumber)) currentNumber = 40000;
        }
        transaction.set(settingsRef, {
           startNumber: (currentNumber + 1).toString()
        }, { merge: true });
        return currentNumber.toString();
      });

      (tickData as any).number = newTicketNumber;

      const tickDocRef = doc(collection(db, 'crm_tickets'));
      await setDoc(tickDocRef, tickData);
      const ticketId = tickDocRef.id;

      await setDoc(doc(db, 'crm_customers', finalCustId), {
          tickets: arrayUnion({ id: ticketId, number: (tickData as any).number, subject: tickData.subject || '', status: tickData.status || '' })
      }, { merge: true });

      toast.success("Ticket created successfully!");

      // Update/Create Conversation Metadata
      if (customer.phone) {
        const sanitizedPhone = customer.phone.replace(/[^\d+]/g, '');
        const convId = `${finalCustId}_${sanitizedPhone}`;
        try {
          await setDoc(doc(db, 'conversations', convId), {
            customerName: `${customer.firstname || ''} ${customer.lastname || ''}`.trim(),
            phone: sanitizedPhone,
            customerId: finalCustId,
            ticketNumber: newTicketNumber,
            updatedAt: Date.now(),
            isArchived: false
          }, { merge: true });
        } catch (e) {
          console.error("Conversation sync error:", e);
        }
      }
      
      // 3. Auto-send SMS
      if (customer.phone) {
        try {
           let messageTemplate = "Hi {firstName}, your {brand} {model} is booked in! Job #{ticketNumber}. Track: {link}";
           const transactionResult = await runTransaction(db, async (txn) => {
             const docSnap = await txn.get(doc(db, 'settings', 'webhook_templates'));
             return docSnap.exists() ? docSnap.data().newTicketTemplate : null;
           });
           if (transactionResult) messageTemplate = transactionResult;
           
           const link = `${window.location.origin}/s/${ticketId}`;
           const finalMessage = messageTemplate
             .replace(/{firstName}/g, customer.firstname || 'Customer')
             .replace(/{ticketNumber}/g, newTicketNumber)
             .replace(/{brand}/g, ticket.brand || '')
             .replace(/{model}/g, ticket.device_model || '')
             .replace(/{device_model}/g, ticket.device_model || '')
             .replace(/{link}/g, link);
             
           // /api/mobilemessage/send handles adding the outbound message to the db automatically when custom_ref is not passed.
           await axios.post('/api/mobilemessage/send', {
             to: customer.phone,
             message: finalMessage,
             ticket_id: ticketId
           });
        } catch (e) {
           console.error("SMS auto-send failed:", e);
        }
      }

      onTicketCreated(finalCustId, ticketId);

    } catch (err: any) {
      console.error(err);
      toast.error("Failed to create ticket: " + (err.message || "Unknown error"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-white relative">
      {/* Header with Steps */}
      <div className="bg-zinc-50 border-b border-zinc-200 p-4 sm:p-8">
        <div className="flex justify-between items-center mb-6 sm:mb-10">
          <div>
            <h2 className="text-2xl font-black text-zinc-900 flex items-center gap-2">
              <Wrench className="w-6 h-6 text-primary" />
              New Repair Ticket
            </h2>
            <p className="text-sm text-zinc-500 font-medium mt-1">Wizard Step {step} of 3</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full text-zinc-400 hover:bg-zinc-200 transition-colors">
            <X className="w-5 h-5"/>
          </Button>
        </div>

          <div className="flex flex-wrap items-center gap-4">
            {[1, 2, 3].map((s) => (
              <React.Fragment key={s}>
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                    step === s ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-110' : 
                    step > s ? 'bg-emerald-500 text-white' : 'bg-zinc-200 text-zinc-500'
                  }`}>
                    {step > s ? <Check className="w-4 h-4" /> : s}
                  </div>
                  <span className={`text-xs font-semibold uppercase tracking-wide ${step === s ? 'text-zinc-900' : 'text-zinc-400'}`}>
                    {s === 1 ? 'Customer' : s === 2 ? 'Repair info' : 'Review'}
                  </span>
                </div>
                {s < 3 && <div className="h-0.5 w-12 bg-zinc-200 rounded-full" />}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 min-h-0 min-w-0 overflow-y-auto p-4 sm:p-8 ">
          {/* STEP 1: CUSTOMER */}
          {step === 1 && (
            <div className="max-w-xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="flex gap-2 p-1.5 bg-zinc-100 rounded-2xl sm:rounded-2xl">
                <button 
                  onClick={() => { setIsNewCustomer(true); setSelectedCustomerId(null); setCustomer({ firstname: '', lastname: '', phone: '', email: '', address: '' }); }}
                  className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wide rounded-xl transition-all ${isNewCustomer ? 'bg-white shadow-sm text-zinc-900 font-black' : 'text-zinc-500 hover:text-zinc-900 font-bold'}`}
                >
                  New Customer
                </button>
                <button 
                  onClick={() => setIsNewCustomer(false)}
                  className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wide rounded-xl transition-all ${!isNewCustomer ? 'bg-white shadow-sm text-zinc-900 font-black' : 'text-zinc-500 hover:text-zinc-900 font-bold'}`}
                >
                  Existing Database
                </button>
              </div>

              {!isNewCustomer ? (
                <div className="space-y-6">
                  <CustomerSearchBox 
                    selectedCustomerId={selectedCustomerId}
                    onSelectCustomer={selectExistingCustomer}
                  />

                  {selectedCustomerId && (
                    <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-2xl space-y-3">
                      <h4 className="font-semibold text-xs uppercase tracking-wide text-emerald-600">Selected Profile</h4>
                      <div>
                        <p className="text-2xl font-black text-emerald-900">{customer.business_then_name || customer.fullname || `${customer.firstName || customer.firstname || ''} ${customer.lastName || customer.lastname || ''}`.trim() || 'Unknown Customer'}</p>
                        <p className="text-sm text-emerald-700 font-bold opacity-80">{customer.phone} • {customer.email}</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wide pl-1">First Name *</label>
                      <Input className="bg-zinc-100 border-none rounded-xl h-12 focus-visible:ring-0 focus-visible:border-zinc-300 font-bold" value={customer.firstname || ''} onChange={e => setCustomer({...customer, firstname: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wide pl-1">Last Name</label>
                      <Input className="bg-zinc-100 border-none rounded-xl h-12 focus-visible:ring-0 focus-visible:border-zinc-300 font-bold" value={customer.lastname || ''} onChange={e => setCustomer({...customer, lastname: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wide pl-1">Phone</label>
                      <Input className="bg-zinc-100 border-none rounded-xl h-12 focus-visible:ring-0 focus-visible:border-zinc-300 font-bold" type="tel" placeholder="Phone" value={customer.phone || ''} onChange={e => setCustomer({...customer, phone: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wide pl-1">Mobile Number</label>
                      <Input className="bg-zinc-100 border-none rounded-xl h-12 focus-visible:ring-0 focus-visible:border-zinc-300 font-bold" type="tel" placeholder="Mobile Number" value={customer.mobile || ''} onChange={e => setCustomer({...customer, mobile: e.target.value})} />
                    </div>
                    <div className="col-span-1 sm:col-span-2 space-y-2">
                      <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wide pl-1">Email</label>
                      <Input className="bg-zinc-100 border-none rounded-xl h-12 focus-visible:ring-0 focus-visible:border-zinc-300 font-bold" type="email" placeholder="Email" value={customer.email || ''} onChange={e => setCustomer({...customer, email: e.target.value})} />
                    </div>
                    <div className="col-span-1 sm:col-span-2 space-y-2">
                       <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wide pl-1">Street Address (Optional)</label>
                       <AddressAutocomplete 
                         value={customer.address || ''} 
                         onChange={(v) => setCustomer({...customer, address: v})}
                         onSelect={(s) => setCustomer({...customer, address: s.display_name})}
                       />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: DEVICE */}
          {step === 2 && (
            <div className="max-w-xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wide pl-1">Category *</label>
                  <Select value={ticket.repair_category || ''} onValueChange={v => {
                    const isVacuum = v.toLowerCase().includes('vacuum') || v.toLowerCase().includes('robovac');
                    setTicket({
                      ...ticket, 
                      repair_category: v,
                      properties: isVacuum ? {
                        ...(ticket.properties || {}),
                        "Station Type": "Auto-Empty / Wash",
                        "Water Tank Emptied?": "Yes",
                        "Main Brush Cleaned?": "Yes"
                      } : ticket.properties
                    });
                  }}>
                    <SelectTrigger className="h-12 w-full rounded-xl bg-zinc-100 border-none focus:ring-0 font-bold">
                      <SelectValue placeholder="What type?" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border border-zinc-100">
                      {REPAIR_CATEGORIES.map(c => <SelectItem key={typeof c === 'string' ? c : c.name} value={typeof c === 'string' ? c : c.name} className="font-bold py-3">{typeof c === 'string' ? c : c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wide pl-1">Manufacturer *</label>
                  {isManualBrand ? (
                    <div className="flex gap-2">
                      <Input
                        placeholder="e.g. Apple"
                        className="h-12 flex-1 rounded-xl bg-zinc-100 border-none focus-visible:ring-0 focus-visible:border-zinc-300 font-bold shadow-inner" 
                        value={ticket.brand || ''} 
                        onChange={e => setTicket({...ticket, brand: e.target.value})} 
                      />
                      <Button variant="outline" className="h-12 rounded-xl px-4" onClick={async () => {
                        if (ticket.brand) {
                           const updatedBrands = [...(settings?.devices?.brands || [])];
                           if (!updatedBrands.some(b => b.name === ticket.brand)) {
                              updatedBrands.push({ name: ticket.brand, models: [] });
                              await updateSettings('devices', { brands: updatedBrands });
                              toast.success("Brand added to settings");
                           }
                        }
                        setIsManualBrand(false);
                      }}>Save</Button>
                      <Button type="button" variant="ghost" className="h-12 rounded-xl px-3 text-zinc-400" onClick={() => setIsManualBrand(false)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <Select value={ticket.brand || ''} onValueChange={v => {
                      if (v === '__ADD_NEW__') {
                        setIsManualBrand(true);
                        setTicket({...ticket, brand: ''});
                      } else {
                        setTicket({...ticket, brand: v, device_model: ''}); // reset model
                      }
                    }}>
                      <SelectTrigger className="h-12 w-full rounded-xl bg-zinc-100 border-none focus:ring-0 font-bold">
                        <SelectValue placeholder="Brand?" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border border-zinc-100 max-h-[300px]">
                        {brandNames.map(c => <SelectItem key={c} value={c} className="font-bold py-3">{c}</SelectItem>)}
                        <SelectItem value="__ADD_NEW__" className="font-bold py-3 text-emerald-600 bg-emerald-50 focus:bg-emerald-100">
                          <div className="flex items-center">
                            <Plus className="w-4 h-4 mr-2" />
                            Add new brand...
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="space-y-2 col-span-1">
                  <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wide pl-1">Model Name / Number</label>
                  {isManualModel ? (
                    <div className="flex gap-2">
                      <Input 
                        placeholder="e.g. iPhone 13 Pro Max"
                        className="h-12 flex-1 rounded-xl bg-zinc-100 border-none focus-visible:ring-0 focus-visible:border-zinc-300 font-bold shadow-inner" 
                        value={ticket.device_model || ''} 
                        onChange={e => {
                          const val = e.target.value;
                          setTicket({
                            ...ticket, 
                            device_model: val,
                            // DO NOT overwrite subject
                          });
                        }} 
                      />
                      <Button type="button" variant="outline" className="h-12 rounded-xl px-4" onClick={async () => {
                        // SAVE TO SETTINGS
                        if (ticket.brand && ticket.device_model) {
                           const updatedBrands = [...(settings?.devices?.brands || [])];
                           const brandIndex = updatedBrands.findIndex(b => b.name === ticket.brand);
                           if (brandIndex >= 0) {
                              updatedBrands[brandIndex].models = Array.from(new Set([...updatedBrands[brandIndex].models, ticket.device_model]));
                           } else {
                              updatedBrands.push({ name: ticket.brand, models: [ticket.device_model] });
                           }
                           await updateSettings('devices', { brands: updatedBrands });
                           toast.success("Model added to settings");
                        }
                        setIsManualModel(false);
                      }}>Save</Button>
                      <Button type="button" variant="ghost" className="h-12 rounded-xl text-zinc-400 px-3" onClick={() => setIsManualModel(false)}>
                         <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <Select value={ticket.device_model || ''} onValueChange={v => {
                      if (v === '__ADD_NEW__') {
                        setIsManualModel(true);
                        setTicket({...ticket, device_model: ''});
                      } else {
                        setTicket({
                          ...ticket,
                          device_model: v,
                          // DO NOT overwrite subject
                        });
                      }
                    }}>
                      <SelectTrigger className="h-12 w-full rounded-xl bg-zinc-100 border-none focus:ring-0 font-bold">
                        <SelectValue placeholder={ticket.brand ? "Select model..." : "Select brand first..."} />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border border-zinc-100 max-h-60">
                        {modelsForBrand.map(m => (
                          <SelectItem key={m} value={m} className="font-bold py-3">{m}</SelectItem>
                        ))}
                        <SelectItem value="__ADD_NEW__" className="font-bold py-3 text-emerald-600 bg-emerald-50 focus:bg-emerald-100">
                          <div className="flex items-center">
                            <Plus className="w-4 h-4 mr-2" />
                            Add new model manually...
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="space-y-2 col-span-1">
                  <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wide pl-1">Taking In Items</label>
                  <Popover>
                    <PopoverTrigger render={
                      <Button variant="outline" className="w-full h-12 rounded-xl bg-zinc-100 border-none font-bold shadow-inner justify-start text-left font-normal truncate px-4">
                        {ticket.accessories || <span className="text-zinc-500 font-bold">Select items...</span>}
                      </Button>
                    } />
                    <PopoverContent className="w-64 p-3 rounded-2xl bg-white border border-zinc-200 shadow-xl" align="start">
                      <div className="space-y-3">
                        <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Common Items</div>
                        {['Big Dock', 'Little Dock', 'Charger', 'Power Cable', 'USB Cable', 'Case', 'Original Box', 'Manuals'].map(item => {
                          const currentItems = (ticket.accessories || '').split(',').map((s: string) => s.trim()).filter(Boolean);
                          const isSelected = currentItems.includes(item);
                          return (
                            <div key={item} className="flex items-center space-x-3">
                              <Checkbox 
                                id={`acc-${item.replace(/\s+/g, '-')}`} 
                                checked={isSelected}
                                onCheckedChange={(checked) => {
                                  let nextItems = [...currentItems];
                                  if (checked) {
                                    if (!nextItems.includes(item)) nextItems.push(item);
                                  } else {
                                    nextItems = nextItems.filter(i => i !== item);
                                  }
                                  setTicket({...ticket, accessories: nextItems.join(', ')});
                                }}
                                className="rounded-[4px] border-zinc-300"
                              />
                              <label htmlFor={`acc-${item.replace(/\s+/g, '-')}`} className="text-sm font-bold text-zinc-700 cursor-pointer flex-1">
                                {item}
                              </label>
                            </div>
                          );
                        })}
                        <div className="pt-2 border-t border-zinc-100 mt-2">
                           <Input 
                             placeholder="Type custom item & press Enter..." 
                             className="h-9 text-xs font-bold rounded-lg border-zinc-200 bg-zinc-50/50" 
                             onKeyDown={e => {
                               if (e.key === 'Enter') {
                                 e.preventDefault();
                                 const val = e.currentTarget.value.trim();
                                 if (val) {
                                   let currentItems = (ticket.accessories || '').split(',').map((s: string) => s.trim()).filter(Boolean);
                                   if (!currentItems.includes(val)) currentItems.push(val);
                                   setTicket({...ticket, accessories: currentItems.join(', ')});
                                   e.currentTarget.value = '';
                                 }
                               }
                             }} 
                           />
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2 col-span-1 sm:col-span-2">
                  <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wide pl-1">Short Subject (Reported Issue) *</label>
                  <SubjectAutocomplete
                    value={ticket.subject || ''}
                    errorClass={errors.subject ? 'border border-red-300 bg-red-50' : ''}
                    onChange={v => {
                      setTicket({...ticket, subject: v});
                      if (errors.subject) setErrors(prev => {
                        const { subject, ...rest } = prev;
                        return rest;
                      });
                    }}
                  />
                  {errors.subject && (
                    <p className="text-red-500 text-xs font-medium mt-1 pl-1 italic">
                      {errors.subject}
                    </p>
                  )}
                </div>

                <div className="space-y-2 col-span-1 sm:col-span-2">
                  <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wide pl-1">Device Passcode</label>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="PIN / Pattern / Password"
                      className="h-12 flex-1 rounded-xl bg-zinc-100 border-none focus-visible:ring-0 focus-visible:border-zinc-300 font-bold shadow-inner" 
                      value={ticket.device_password || ''} 
                      onChange={e => setTicket({...ticket, device_password: e.target.value})} 
                    />
                    <Popover>
                      <PopoverTrigger render={
                        <Button type="button" variant="outline" className="h-12 w-12 rounded-xl p-0 border-zinc-200">
                          <Grid3x3 className="w-5 h-5 text-zinc-500" />
                        </Button>
                      } />
                      <PopoverContent className="w-auto p-4 rounded-2xl" align="end" side="top">
                        <PatternLockBox 
                          value={ticket.device_password || ''} 
                          onChange={(v) => setTicket({...ticket, device_password: v})} 
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div className="space-y-2 col-span-1 sm:col-span-2">
                  <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wide pl-1">Issue Description</label>
                  <Textarea 
                    placeholder="Describe the issue in detail..."
                    className="min-h-[100px] rounded-xl bg-zinc-100 border-none focus-visible:ring-0 focus-visible:border-zinc-300 font-bold shadow-inner resize-none py-3" 
                    value={ticket.issue_description || ticket.problem_type || ''} 
                    onChange={e => setTicket({...ticket, issue_description: e.target.value, problem_type: e.target.value})} 
                  />
                </div>

                <div className="col-span-1 sm:col-span-2 flex justify-center py-2">
                  <button
                    type="button"
                    onClick={() => setShowAdvancedExt(!showAdvancedExt)}
                    className="flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase text-zinc-400 hover:text-zinc-600 transition-colors"
                  >
                    {!showAdvancedExt ? (
                      <>
                        <span>Show additional fields</span>
                        <ChevronDown className="w-3.5 h-3.5" />
                      </>
                    ) : (
                      <>
                        <span>Hide additional fields</span>
                        <ChevronUp className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
                
                {showAdvancedExt && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 col-span-1 sm:col-span-2">
                      <div className="space-y-2">
                         <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wide pl-1">Priority</label>
                         <Select value={ticket.priority || 'Normal'} onValueChange={v => setTicket({...ticket, priority: v})}>
                           <SelectTrigger className="h-12 w-full rounded-xl bg-zinc-100 border-none focus:ring-0 font-bold">
                             <SelectValue />
                           </SelectTrigger>
                           <SelectContent className="rounded-xl">
                             <SelectItem value="Low">Low</SelectItem>
                             <SelectItem value="Normal">Normal</SelectItem>
                             <SelectItem value="High">High</SelectItem>
                             <SelectItem value="Urgent">Urgent</SelectItem>
                           </SelectContent>
                         </Select>
                      </div>

                      <div className="space-y-2">
                         <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wide pl-1">Status</label>
                         <Select value={ticket.status || 'New'} onValueChange={v => setTicket({...ticket, status: v})}>
                           <SelectTrigger className="h-12 w-full rounded-xl bg-zinc-100 border-none focus:ring-0 font-bold">
                             <SelectValue />
                           </SelectTrigger>
                           <SelectContent className="rounded-xl">
                              {['New', 'Your Turn', 'In Progress', 'Waiting on Customer', 'Waiting on Parts', 'Repair in progress', 'Ready for Pickup', 'Resolved', 'Cancelled'].map(status => (
                                <SelectItem key={status} value={status}>{status}</SelectItem>
                              ))}
                           </SelectContent>
                         </Select>
                      </div>
                    </div>

                    <div className="space-y-2 col-span-1 sm:col-span-2">
                      <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wide pl-1">Serial Number / IMEI</label>
                      <Input 
                        placeholder="e.g. 15-digit IMEI or Alphanumeric Serial"
                        className="h-12 rounded-xl bg-zinc-100 border-none focus-visible:ring-0 focus-visible:border-zinc-300 font-bold shadow-inner" 
                        value={ticket.imei || ''} 
                        onChange={e => setTicket({...ticket, imei: e.target.value})} 
                      />
                    </div>
                    
                    <div className="space-y-2 col-span-1 sm:col-span-2">
                      <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wide pl-1">Visual Condition / Notes</label>
                      <Input 
                        placeholder="e.g. Scratches on back glass, small dent on corner"
                        className="h-12 rounded-xl bg-zinc-100 border-none focus-visible:ring-0 focus-visible:border-zinc-300 font-bold shadow-inner" 
                        value={ticket.visual_condition || ''} 
                        onChange={e => setTicket({...ticket, visual_condition: e.target.value})} 
                      />
                    </div>

                    <div className="col-span-1 sm:col-span-2 space-y-4 pt-4 border-t border-zinc-100">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wide pl-1">Advanced Information</label>
                        <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-wide bg-zinc-50 border-zinc-200 text-zinc-500">RepairShopR Sync Fields</Badge>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide pl-1">Assigned Tech</label>
                          <Input 
                            placeholder="Technician name"
                            className="h-11 rounded-xl bg-zinc-50 border-zinc-200 focus-visible:ring-0 focus-visible:border-zinc-300 font-bold" 
                            value={ticket.assigned_to || ''} 
                            onChange={e => setTicket({...ticket, assigned_to: e.target.value})} 
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide pl-1">Due Date</label>
                          <Input 
                            type="date"
                            className="h-11 rounded-xl bg-zinc-50 border-zinc-200 focus-visible:ring-0 focus-visible:border-zinc-300 font-bold" 
                            value={ticket.due_date || ''} 
                            onChange={e => setTicket({...ticket, due_date: e.target.value})} 
                          />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide pl-1">Custom Fields (Mapped to RepairShopR)</label>
                        <div className="space-y-2">
                          {Object.entries(ticket.properties || {}).map(([k, v]) => {
                            const standard = ["Device", "Password", "Serial Number", "Accessories Included", "Visual Condition"];
                            if (standard.includes(k)) return null;
                            return (
                              <div key={k} className="flex gap-2 items-center bg-zinc-50 p-2 rounded-xl border border-zinc-100">
                                <span className="flex-1 text-xs font-bold text-zinc-700 pl-2">{k}: {String(v)}</span>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 text-zinc-400 hover:text-red-500"
                                  onClick={() => {
                                    const nextProps = { ...ticket.properties };
                                    delete nextProps[k];
                                    setTicket({ ...ticket, properties: nextProps });
                                  }}
                                >
                                  <X className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                        
                        <div className="flex gap-2">
                          <Input 
                            id="custom-field-name"
                            placeholder="Field Name (e.g. Color)" 
                            className="h-10 text-xs bg-white border-zinc-200 rounded-xl flex-1"
                          />
                          <Input 
                            id="custom-field-value"
                            placeholder="Value" 
                            className="h-10 text-xs bg-white border-zinc-200 rounded-xl flex-[2]"
                          />
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="h-10 rounded-xl font-bold bg-white text-zinc-700"
                            onClick={() => {
                              const name = (document.getElementById('custom-field-name') as HTMLInputElement).value;
                              const val = (document.getElementById('custom-field-value') as HTMLInputElement).value;
                              if (name && val) {
                                setTicket({
                                  ...ticket,
                                  properties: {
                                    ...(ticket.properties || {}),
                                    [name]: val
                                  }
                                });
                                (document.getElementById('custom-field-name') as HTMLInputElement).value = '';
                                (document.getElementById('custom-field-value') as HTMLInputElement).value = '';
                              }
                            }}
                          >
                            Add
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 col-span-1 sm:col-span-2 pt-4 border-t border-zinc-100">
                      <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wide pl-1">Ticket Tags</label>
                      <div className="flex flex-wrap gap-2 min-h-[40px] p-1 bg-zinc-50/50 rounded-xl">
                        <AnimatePresence>
                          {(ticket.tags || []).map((tag: string) => (
                            <motion.div
                              key={tag}
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.8 }}
                            >
                              <Badge className="bg-white text-zinc-700 border border-zinc-200 px-3 py-1 flex items-center gap-2 hover:bg-zinc-50 transition-colors shadow-sm">
                                <Hash className="w-3 h-3 text-zinc-400" />
                                {tag}
                                <X className="w-3 h-3 cursor-pointer hover:text-red-500 transition-colors" onClick={() => removeTag(tag)} />
                              </Badge>
                            </motion.div>
                          ))}
                        </AnimatePresence>
                        {(ticket.tags || []).length === 0 && (
                          <span className="text-xs text-zinc-300 font-bold italic py-2 pl-2">No tags added yet</span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                          <Input 
                            value={newTag} 
                            onChange={e => setNewTag(e.target.value)} 
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                addTag();
                              }
                            }}
                            placeholder="Add a custom tag (e.g. #Urgent, #NoPower)" 
                            className="h-12 bg-zinc-100 border-none rounded-xl pl-10 focus-visible:ring-0 focus-visible:border-zinc-300 font-bold"
                          />
                        </div>
                        <Button 
                          type="button" 
                          onClick={addTag} 
                          variant="outline" 
                          className="h-12 rounded-xl px-6 bg-white border-zinc-200 hover:bg-zinc-50 text-zinc-700 font-black"
                        >
                          ADD
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: REVIEW */}
          {step === 3 && (
            <div className="max-w-xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="bg-zinc-50 rounded-2xl p-8 border border-zinc-100 space-y-8">
                <div>
                  <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-4">Customer Details</h4>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-2xl font-black text-zinc-900">{customer.business_then_name || customer.fullname || `${customer.firstname || customer.first_name || ''} ${customer.lastname || customer.last_name || ''}`.trim() || 'Unknown Customer'}</p>
                      <p className="text-sm font-bold text-zinc-500 mt-1">{customer.phone} • {customer.email}</p>
                    </div>
                    <Button variant="ghost" className="text-primary font-black" onClick={() => setStep(1)}>Edit</Button>
                  </div>
                </div>

                <div className="pt-8 border-t border-zinc-200">
                  <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-4">Repair Summary</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Device</span>
                      <p className="font-black text-lg text-zinc-800">{ticket.brand} {ticket.device_model}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Category</span>
                      <p className="font-black text-lg text-zinc-800">{ticket.repair_category}</p>
                    </div>
                    <div className="col-span-1 sm:col-span-2 space-y-1">
                      <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Subject</span>
                      <p className="font-black text-lg text-zinc-800">{ticket.subject}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-primary/5 text-primary p-6 rounded-2xl sm:rounded-2xl text-sm font-bold border border-primary/10 flex items-start gap-4">
                <div className="p-2 bg-white rounded-xl shadow-sm">
                   <CheckCircle2 className="w-5 h-5" />
                </div>
                <p className="leading-relaxed">This will create a new ticket, log it in the database and send an automated SMS confirmation to the customer.</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Buttons */}
        <div className="p-4 sm:p-8 border-t border-zinc-200 bg-zinc-50 flex justify-between items-center mt-auto">
          {step > 1 ? (
            <Button variant="ghost" onClick={() => setStep(step - 1)} className="font-black text-zinc-400 hover:text-zinc-900 transition-colors uppercase tracking-wide text-xs">
               Back
            </Button>
          ) : <div></div>}
          
          {step < 3 ? (
            <Button onClick={handleNext} className="h-12 bg-zinc-900 hover:bg-black text-white rounded-xl font-black px-10 shadow-xl transition-all active:scale-95 uppercase tracking-wide text-xs">
              Next Step <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={handleCreate} disabled={isSaving} className="h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black px-12 shadow-xl transition-all active:scale-95 uppercase tracking-wide text-sm">
              {isSaving ? "Creating..." : "Confirm & Create Job"} <Check className="w-5 h-5 ml-2" />
            </Button>
          )}
        </div>
    </div>
  );
}
