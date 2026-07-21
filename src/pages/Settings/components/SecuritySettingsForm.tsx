import React, { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { SecuritySettingsSchema, SecuritySettings } from '../../../types/settings';
import { useSettings } from '../../../providers/SettingsProvider';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Save, Loader2, Trash2 } from 'lucide-react';
import { DeleteAccountRequestModal } from '@/components/DeleteAccountRequestModal';
import { useAuth } from '../../../providers/AuthProvider';
import axios from 'axios';
import { toast } from 'sonner';

export function SecuritySettingsForm() {
  const { settings, updateSettings } = useSettings();
  const { user } = useAuth();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  
  const { control, handleSubmit, reset, formState: { isSubmitting, isDirty } } = useForm<SecuritySettings>({
    resolver: zodResolver(SecuritySettingsSchema),
    defaultValues: settings?.security
  });

  useEffect(() => {
    if (settings?.security) {
      reset(settings.security);
    }
  }, [settings?.security, reset]);

  const onSubmit = async (data: SecuritySettings) => {
    await updateSettings('security', data);
    reset(data); // reset isDirty
  };

  const handleDeleteRequest = async (reason: string) => {
    try {
      if (user?.isAnonymous) {
        toast.error("Guest mode cannot request account deletion.");
        return;
      }
      await axios.post('/api/account/delete-request', {
        reason,
        email: user?.email
      }, {
        headers: {
          'x-user-id': user?.uid,
          'x-is-guest': user?.isAnonymous ? 'true' : 'false'
        }
      });
      toast.success("Account deletion request submitted. An admin will review it shortly.");
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Failed to submit request.");
    }
  };

  if (!settings) return null;

  return (
    <>
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-4">
        <h3 className="text-lg font-bold text-zinc-900">Security Options</h3>
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-semibold text-zinc-900">Two-Factor Authentication</Label>
              <p className="text-xs text-zinc-500">Require an extra step during sign in</p>
            </div>
            <Controller
              control={control}
              name="require2FA"
              render={({ field: { onChange, value } }) => (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-zinc-500">{value ? 'Enabled' : 'Disabled'}</span>
                  <Switch checked={value} onCheckedChange={onChange} />
                </div>
              )}
            />
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-4">
        <h3 className="text-lg font-bold text-zinc-900 pb-2">Active Sessions</h3>
        <p className="text-sm text-zinc-500 pb-2">Note: Session revocation requires Firebase Admin integration.</p>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-sm text-zinc-900">Current Device</div>
              <div className="text-xs text-zinc-500">Just now • Web Browser</div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-red-200 shadow-sm space-y-4">
        <h3 className="text-lg font-bold text-red-600 pb-2">Danger Zone</h3>
        <p className="text-sm text-zinc-500 pb-4">Request to permanently delete your account and remove your personal information.</p>
        <Button type="button" onClick={() => setIsDeleteModalOpen(true)} variant="outline" className="border-red-200 text-red-600 hover:bg-red-50">
          <Trash2 className="w-4 h-4 mr-2" />
          Request Account Deletion
        </Button>
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
    
    <DeleteAccountRequestModal 
      isOpen={isDeleteModalOpen} 
      onClose={() => setIsDeleteModalOpen(false)} 
      onSubmit={handleDeleteRequest} 
    />
    </>
  );
}
