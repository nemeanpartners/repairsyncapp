import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { GeneralSettingsSchema, GeneralSettings } from '../../../types/settings';
import { useSettings } from '../../../providers/SettingsProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save, Loader2 } from 'lucide-react';

export function GeneralSettingsForm() {
  const { settings, updateSettings } = useSettings();
  
  const { register, handleSubmit, reset, formState: { errors, isSubmitting, isDirty } } = useForm<GeneralSettings>({
    resolver: zodResolver(GeneralSettingsSchema),
    defaultValues: settings?.general
  });

  useEffect(() => {
    if (settings?.general) {
      reset(settings.general);
    }
  }, [settings?.general, reset]);

  const onSubmit = async (data: GeneralSettings) => {
    await updateSettings('general', data);
    reset(data); // reset isDirty
  };

  if (!settings) return null;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-zinc-900">Shop Profile</h3>
            <p className="text-sm text-zinc-500">Manage your business details.</p>
          </div>
        </div>
        
        <div className="space-y-2 pt-2">
          <Label>Shop Name</Label>
          <Input {...register('shopName')} placeholder="e.g. PhoneMedic Repairs" />
          {errors.shopName && <p className="text-xs text-red-500">{errors.shopName.message}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Support Email</Label>
            <Input {...register('supportEmail')} type="email" placeholder="support@domain.com" />
            {errors.supportEmail && <p className="text-xs text-red-500">{errors.supportEmail.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Business Phone</Label>
            <Input {...register('businessPhone')} placeholder="e.g. 0400 000 000" />
            {errors.businessPhone && <p className="text-xs text-red-500">{errors.businessPhone.message}</p>}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Business Address</Label>
          <Input {...register('address')} placeholder="123 Tech Street, Sydney" />
          {errors.address && <p className="text-xs text-red-500">{errors.address.message}</p>}
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-4">
        <h3 className="text-lg font-bold text-zinc-900">Localization</h3>
        <p className="text-sm text-zinc-500">Set your region and currency.</p>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div className="space-y-2">
            <Label>Currency</Label>
            <select {...register('currency')} className="flex h-10 w-full items-center justify-between rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-2">
              <option value="AUD ($)">AUD ($)</option>
              <option value="USD ($)">USD ($)</option>
              <option value="EUR (€)">EUR (€)</option>
              <option value="GBP (£)">GBP (£)</option>
            </select>
            {errors.currency && <p className="text-xs text-red-500">{errors.currency.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Timezone</Label>
            <select {...register('timezone')} className="flex h-10 w-full items-center justify-between rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-2">
              <option value="Australia/Sydney">Australia/Sydney</option>
              <option value="Australia/Melbourne">Australia/Melbourne</option>
              <option value="Australia/Brisbane">Australia/Brisbane</option>
            </select>
            {errors.timezone && <p className="text-xs text-red-500">{errors.timezone.message}</p>}
          </div>
        </div>
      </div>

      {isDirty && (
        <div className="sticky bottom-4 z-50 bg-white border border-zinc-200 shadow-lg p-4 rounded-xl flex items-center justify-between animate-in slide-in-from-bottom-5">
           <div className="text-sm font-medium">Unsaved changes</div>
           <Button type="submit" disabled={isSubmitting} className="bg-black text-white px-6">
             {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
             Save Changes
           </Button>
        </div>
      )}
    </form>
  );
}
