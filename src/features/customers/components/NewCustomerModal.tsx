import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { db } from '../../../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { SearchIndexService } from '../../../services/search/SearchIndexService';
import { normalizePhone } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface NewCustomerModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onCustomerCreated?: (customerId: string) => void;
}

export function NewCustomerModal({ isOpen, onOpenChange, onCustomerCreated }: NewCustomerModalProps) {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    firstname: '',
    lastname: '',
    email: '',
    mobile: '',
    phone: '',
    business_name: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.firstname && !formData.business_name) {
      toast.error('First name or Business name is required');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const searchTerms = [
        formData.firstname,
        formData.lastname,
        formData.email,
        formData.mobile,
        formData.phone,
        formData.business_name
      ].filter(Boolean).map(t => String(t).toLowerCase());

      const data = {
        ...formData,
        fullname: `${formData.firstname} ${formData.lastname}`.trim(),
        business_then_name: formData.business_name || `${formData.firstname} ${formData.lastname}`.trim(),
        searchTermsArray: searchTerms,
        searchableTerms: searchTerms.join(' '),
        strippedPhone: normalizePhone(formData.mobile || formData.phone || ''),
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      };
      
      const docRef = await addDoc(collection(db, 'crm_customers'), data);
      
      // Update local index cache
      await SearchIndexService.recordModified({ id: docRef.id, ...data }, 'contacts');
      
      toast.success('Customer profile created');
      
      if (onCustomerCreated) {
        onCustomerCreated(docRef.id);
      } else {
        navigate(`/customers/${docRef.id}`);
      }
      
      onOpenChange(false);
      setFormData({ firstname: '', lastname: '', email: '', mobile: '', phone: '', business_name: '' });
    } catch (e: any) {
      console.error("Failed to add customer", e);
      toast.error('Failed to create customer');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] overflow-hidden p-0 rounded-2xl">
        <div className="p-6 bg-white">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-xl font-bold">New Customer</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Business Name (Optional)</Label>
              <Input 
                 value={formData.business_name} 
                 onChange={e => setFormData({...formData, business_name: e.target.value})} 
                 className="h-10 rounded-xl" 
                 placeholder="e.g. Acme Corp"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name</Label>
                <Input required={!formData.business_name} value={formData.firstname} onChange={e => setFormData({...formData, firstname: e.target.value})} className="h-10 rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>Last Name</Label>
                <Input required={!formData.business_name} value={formData.lastname} onChange={e => setFormData({...formData, lastname: e.target.value})} className="h-10 rounded-xl" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="h-10 rounded-xl" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Mobile / Primary Phone</Label>
                <Input value={formData.mobile} onChange={e => setFormData({...formData, mobile: e.target.value})} className="h-10 rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>Alternate Phone</Label>
                <Input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="h-10 rounded-xl" />
              </div>
            </div>
            
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl h-10 px-6">Cancel</Button>
              <Button disabled={isSubmitting} type="submit" className="rounded-xl h-10 px-6 bg-emerald-600 text-white hover:bg-emerald-700">
                {isSubmitting ? 'Saving...' : 'Save Profile'}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
