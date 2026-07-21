import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DebouncedInput } from "@/components/ui/debounced-input";
import { Label } from "@/components/ui/label";
import { db, auth } from "../firebase";
import { collection, query, getDocs, addDoc, setDoc, doc, serverTimestamp } from "firebase/firestore";
import axios from "axios";
import { toast } from "sonner";
import { Plus, Trash, Search, PackageSearch } from "lucide-react";
import { CustomerSearchBox } from "../features/customers/components/CustomerSearchBox";
import { NormalizedCustomer } from "../hooks/customers/useCustomerSearch";
import { useNavigate } from "react-router-dom";
import { useCatalogAndSuppliers } from "../hooks/useCatalogAndSuppliers";

export const NewInvoiceModal = ({
  isOpen,
  onClose,
  prefillCustomerId,
  prefillCustomer,
  prefillTicketId,
  prefillLineItems
}: {
  isOpen: boolean;
  onClose: () => void;
  prefillCustomerId?: string;
  prefillCustomer?: any;
  prefillTicketId?: string;
  prefillLineItems?: { description: string; quantity: number; unit_amount: number }[];
}) => {
  const navigate = useNavigate();
  const { products } = useCatalogAndSuppliers();

  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(prefillCustomerId || null);
  const [isNewCustomer, setIsNewCustomer] = useState(false);

  const [customer, setCustomer] = useState<any>(prefillCustomer || {
    firstname: '',
    lastname: '',
    phone: '',
    email: '',
    address: ''
  });

  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");

  const filteredCatalog = useMemo(() => {
    const q = catalogSearch.toLowerCase();
    if (!q) return products;
    return products.filter(p => 
      p.code?.toLowerCase().includes(q) || 
      p.description.toLowerCase().includes(q)
    );
  }, [catalogSearch, products]);

  const addFromCatalog = (product: any) => {
     const hasEmptyItem = lineItems.findIndex(i => !i.description && i.unit_amount === 0);
     if (hasEmptyItem >= 0) {
        const newItems = [...lineItems];
        newItems[hasEmptyItem].description = product.description;
        newItems[hasEmptyItem].unit_amount = product.price;
        setLineItems(newItems);
     } else {
        setLineItems([...lineItems, { id: Math.random().toString(), description: product.description, quantity: 1, unit_amount: product.price }]);
     }
     toast.success(`Added ${product.code}`);
     setIsCatalogOpen(false);
  };

  const [lineItems, setLineItems] = useState([
    { id: Math.random().toString(), description: "", quantity: 1, unit_amount: 0 }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (prefillCustomer && Object.keys(prefillCustomer).length > 0) {
      setCustomer(prefillCustomer);
    }
  }, [prefillCustomer]);

  useEffect(() => {
    if (prefillCustomerId) {
      setSelectedCustomerId(prefillCustomerId);
    }
  }, [prefillCustomerId]);

  useEffect(() => {
    if (isOpen) {
      setLineItems(prefillLineItems?.length ? prefillLineItems.map(i => ({...i, id: Math.random().toString()})) : [{ id: Math.random().toString(), description: "", quantity: 1, unit_amount: 0 }]);
      if (prefillCustomerId) setSelectedCustomerId(prefillCustomerId);
      setIsNewCustomer(false);
      if (prefillCustomer && Object.keys(prefillCustomer).length > 0) {
        setCustomer(prefillCustomer);
      }
    }
  }, [isOpen, prefillLineItems, prefillCustomer, prefillCustomerId]);

  const calculateSubtotal = () => {
    return lineItems.reduce((acc, item) => acc + (item.quantity * item.unit_amount), 0);
  };
  const calculateTax = () => calculateSubtotal() * 0.1;
  const calculateTotal = () => calculateSubtotal() + calculateTax();

  const handleSave = async () => {
    if (isNewCustomer) {
      if (!customer.firstname || (!customer.phone && !customer.email)) {
        toast.error("First name, and either phone or email are required.");
        return;
      }
    } else {
      if (!selectedCustomerId) {
        toast.error("Please select an existing customer");
        return;
      }
    }

    if (lineItems.length === 0 || lineItems.some(i => !i.description)) {
       toast.error("Please provide valid line items");
       return;
    }
    
    setIsSubmitting(true);
    try {
      let finalCustId = selectedCustomerId;

      // 1. Create or Update Customer
      const custDataToSave: any = {
        ...customer,
        updated_at: new Date().toISOString(),
        uid: auth.currentUser?.uid
      };

      if (isNewCustomer || !finalCustId) {
        custDataToSave.created_at = new Date().toISOString();
        const crmRef = await addDoc(collection(db, 'crm_customers'), custDataToSave);
        finalCustId = crmRef.id;
      } else {
        await setDoc(doc(db, 'crm_customers', finalCustId), custDataToSave, { merge: true });
      }

      // 2. Create Invoice
      const subtotal = calculateSubtotal();
      const total = calculateTotal();
      
      const docRef = await addDoc(collection(db, "invoices"), {
        customer_id: finalCustId,
        ticket_id: prefillTicketId || null,
        invoice_number: `${Math.floor(1000000 + Math.random() * 9000000)}`,
        status: "LOCAL_DRAFT",
        subtotal,
        total_tax: calculateTax(),
        total,
        amount_due: total,
        amount_paid: 0,
        sync_status: "PENDING",
        sync_version: 1,
        line_amount_types: "Exclusive",
        issue_date: new Date().toISOString(),
        due_date: new Date(Date.now() + 7 * 86400000).toISOString(),
        line_items: lineItems.map((li) => ({
          id: Math.random().toString(36).substring(7),
          description: li.description,
          quantity: li.quantity,
          unit_amount: li.unit_amount,
          tax_type: 'OUTPUT',
          tax_amount: (li.unit_amount * li.quantity) * 0.1,
          line_amount: li.unit_amount * li.quantity,
          account_code: '200'
        })),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      
      // Queue it to Xero immediately 
      try {
        await axios.post("/api/xero/sync/invoice", { invoiceId: docRef.id });
      } catch (xeroErr) {
        console.warn("Failed to queue to Xero right away", xeroErr);
      }
      
      toast.success("Invoice Created & Queued for Xero Sync!");
      onClose();
      navigate(`/invoice/${docRef.id}`);
    } catch (e) {
      console.error(e);
      toast.error("Failed to create invoice");
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectExistingCustomer = (c: NormalizedCustomer) => {
    setSelectedCustomerId(c.customerId);
    setCustomer({
      ...c,
      firstname: c.firstName || c.firstname || '',
      lastname: c.lastName || c.lastname || ''
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Invoice</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          <div className="space-y-4">
            <Label>Customer Details</Label>
            
            <div className="flex gap-2 p-1.5 bg-zinc-100 rounded-2xl sm:rounded-2xl">
              <button 
                onClick={() => { setIsNewCustomer(true); setSelectedCustomerId(null); setCustomer({ firstname: '', lastname: '', phone: '', email: '', address: '' }); }}
                className={`flex-1 py-2 text-xs font-semibold uppercase tracking-wide rounded-xl transition-all ${isNewCustomer ? 'bg-white shadow-sm text-zinc-900 font-black' : 'text-zinc-500 hover:text-zinc-900 font-bold'}`}
              >
                New Customer
              </button>
              <button 
                onClick={() => setIsNewCustomer(false)}
                className={`flex-1 py-2 text-xs font-semibold uppercase tracking-wide rounded-xl transition-all ${!isNewCustomer ? 'bg-white shadow-sm text-zinc-900 font-black' : 'text-zinc-500 hover:text-zinc-900 font-bold'}`}
              >
                Existing Database
              </button>
            </div>

            {!isNewCustomer ? (
              <div className="space-y-4">
                <CustomerSearchBox 
                  selectedCustomerId={selectedCustomerId}
                  onSelectCustomer={selectExistingCustomer}
                />
                
                {selectedCustomerId && (
                    <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-1">Selected Customer</div>
                        <div className="font-bold text-emerald-900">{customer.business_then_name || customer.fullname || `${customer.firstname || customer.first_name || ''} ${customer.lastname || customer.last_name || ''}`.trim() || 'Unknown Customer'}</div>
                        <div className="text-sm text-emerald-700">{customer.email || customer.phone || 'No contact info'}</div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedCustomerId(null)} className="text-emerald-700 hover:bg-emerald-100 hover:text-emerald-900">Change</Button>
                    </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>First Name <span className="text-red-500">*</span></Label>
                  <Input 
                    placeholder="John" 
                    value={customer.firstname}
                    onChange={(e) => setCustomer({...customer, firstname: e.target.value})}
                    className="bg-zinc-100 border-none"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Last Name</Label>
                  <Input 
                    placeholder="Doe" 
                    value={customer.lastname}
                    onChange={(e) => setCustomer({...customer, lastname: e.target.value})}
                    className="bg-zinc-100 border-none"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone Number</Label>
                  <Input 
                    placeholder="0400 000 000" 
                    value={customer.phone}
                    onChange={(e) => setCustomer({...customer, phone: e.target.value})}
                    className="bg-zinc-100 border-none"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input 
                    type="email"
                    placeholder="john@example.com" 
                    value={customer.email}
                    onChange={(e) => setCustomer({...customer, email: e.target.value})}
                    className="bg-zinc-100 border-none"
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Address (Optional)</Label>
                  <Input 
                    placeholder="123 Main St..." 
                    value={customer.address}
                    onChange={(e) => setCustomer({...customer, address: e.target.value})}
                    className="bg-zinc-100 border-none"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label>Line Items</Label>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setIsCatalogOpen(true)}
                  className="text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100"
                >
                  <PackageSearch className="w-4 h-4 mr-2" /> Service Catalog
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setLineItems([...lineItems, { id: Math.random().toString(), description: "", quantity: 1, unit_amount: 0 }])}
                >
                  <Plus className="w-4 h-4 mr-2" /> Manual Entry
                </Button>
              </div>
            </div>
            
            {lineItems.map((item, idx) => (
              <div key={item.id} className="flex gap-2 items-start bg-muted/50 p-3 rounded-2xl sm:rounded-2xl">
                <div className="flex-1 space-y-2">
                  <Input 
                    placeholder="Search or describe item..." 
                    value={item.description}
                    list="catalog-preset-list-inv"
                    onChange={(e) => {
                      const newItems = [...lineItems];
                      const val = e.target.value;
                      newItems[idx].description = val;
                      
                      // Auto-fill price if matches preset exactly
                      const matchingPreset = products.find(p => p.description === val);
                      if (matchingPreset && newItems[idx].unit_amount === 0) {
                        newItems[idx].unit_amount = matchingPreset.price;
                      }

                      setLineItems(newItems);
                    }}
                  />
                  <div className="flex gap-2">
                    <Input 
                      type="number" 
                      placeholder="Qty" 
                      className="w-24 bg-white"
                      value={item.quantity || ''}
                       onChange={(e) => {
                        const newItems = [...lineItems];
                        newItems[idx].quantity = e.target.value ? Number(e.target.value) : 0;
                        setLineItems(newItems);
                      }}
                    />
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 font-medium">$</span>
                      <Input 
                        type="number" 
                        placeholder="Unit Price" 
                        className="pl-8 bg-white"
                        value={item.unit_amount || ''}
                         onChange={(e) => {
                          const newItems = [...lineItems];
                          newItems[idx].unit_amount = e.target.value ? Number(e.target.value) : 0;
                          setLineItems(newItems);
                        }}
                      />
                    </div>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => {
                    setLineItems(lineItems.filter((_, i) => i !== idx));
                  }}
                >
                  <Trash className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="border-t pt-4 space-y-2 text-right">
            <div className="text-sm text-muted-foreground">Subtotal: ${calculateSubtotal().toFixed(2)}</div>
            <div className="text-sm text-muted-foreground">Tax (10%): ${calculateTax().toFixed(2)}</div>
            <div className="text-lg font-bold">Total: ${calculateTotal().toFixed(2)}</div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Create Invoice"}
            </Button>
          </div>
        </div>
        
        <datalist id="catalog-preset-list-inv">
          {products.map((p, i) => (
            <option key={p.id || p.code || i} value={p.description}>{p.code}</option>
          ))}
        </datalist>
      </DialogContent>
      
      {/* Service Catalog Modal */}
      <Dialog open={isCatalogOpen} onOpenChange={setIsCatalogOpen}>
         <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-white rounded-2xl sm:rounded-2xl">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <DialogTitle className="text-xl font-black">Service Catalog</DialogTitle>
                <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => {
                   setIsCatalogOpen(false);
                   setTimeout(() => {
                     setLineItems([...lineItems, { id: Math.random().toString(), description: "New Catalog Item", quantity: 1, unit_amount: 0 }]);
                   }, 300);
                }}>
                  <Plus className="w-3.5 h-3.5" /> Add New
                </Button>
              </div>
              <div className="relative mb-4">
                 <Search className="w-4 h-4 absolute left-3 top-3 text-zinc-400" />
                 <Input 
                   autoFocus
                   placeholder="Search preset codes or descriptions..."
                   className="pl-9 h-10 bg-zinc-100 border-none rounded-xl"
                   value={catalogSearch}
                   onChange={e => setCatalogSearch(e.target.value)}
                 />
              </div>
              <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1 ">
                 {filteredCatalog.map(p => (
                   <div 
                     key={p.code} 
                     onClick={() => addFromCatalog(p)}
                     className="p-3 bg-zinc-50 hover:bg-emerald-50 rounded-xl cursor-pointer transition-colors flex justify-between items-center border border-transparent hover:border-emerald-100"
                   >
                      <div>
                        <div className="text-xs font-bold text-zinc-500 uppercase">{p.code}</div>
                        <div className="font-semibold text-zinc-900 leading-tight">{p.description}</div>
                      </div>
                      <div className="font-black text-emerald-600">${p.price.toFixed(2)}</div>
                   </div>
                 ))}
                 {filteredCatalog.length === 0 && (
                   <div className="py-8 text-center text-zinc-500 text-sm">No matches found</div>
                 )}
              </div>
            </div>
         </DialogContent>
      </Dialog>
    </Dialog>
  );
};
