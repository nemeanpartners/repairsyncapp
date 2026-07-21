import React, { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { NotificationSettingsSchema, NotificationSettings } from '../../../types/settings';
import { useSettings } from '../../../providers/SettingsProvider';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Save, Loader2 } from 'lucide-react';

export function NotificationSettingsForm() {
  const { settings, updateSettings } = useSettings();
  
  const { control, handleSubmit, reset, formState: { isSubmitting, isDirty } } = useForm<NotificationSettings>({
    resolver: zodResolver(NotificationSettingsSchema),
    defaultValues: settings?.notifications
  });

  useEffect(() => {
    if (settings?.notifications) {
      reset(settings.notifications);
    }
  }, [settings?.notifications, reset]);

  const onSubmit = async (data: NotificationSettings) => {
    await updateSettings('notifications', data);
    reset(data); // reset isDirty
  };

  if (!settings) return null;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-6">
        <div>
          <h3 className="text-lg font-bold text-zinc-900">Customer Notifications</h3>
          <p className="text-sm text-zinc-500">Manage how you contact your customers.</p>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="space-y-0.5 mt-2">
            <Label className="text-sm font-semibold text-zinc-900">Email Alerts</Label>
            <p className="text-xs text-zinc-500">Send status updates via email</p>
          </div>
          <Controller
            control={control}
            name="emailAlerts"
            render={({ field: { onChange, value } }) => (
              <Switch checked={value} onCheckedChange={onChange} />
            )}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5 mt-2">
            <Label className="text-sm font-semibold text-zinc-900">SMS Alerts</Label>
            <p className="text-xs text-zinc-500">Send status updates via SMS (requires Twilio)</p>
          </div>
          <Controller
            control={control}
            name="smsAlerts"
            render={({ field: { onChange, value } }) => (
              <Switch checked={value} onCheckedChange={onChange} />
            )}
          />
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-6">
        <div>
          <h3 className="text-lg font-bold text-zinc-900">Staff Notifications</h3>
          <p className="text-sm text-zinc-500">Internal alerts for your team.</p>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="space-y-0.5 mt-2">
            <Label className="text-sm font-semibold text-zinc-900">New Tickets</Label>
            <p className="text-xs text-zinc-500">Notify when a new ticket is written</p>
          </div>
          <Controller
            control={control}
            name="notifyNewTickets"
            render={({ field: { onChange, value } }) => (
               <Switch checked={value} onCheckedChange={onChange} />
            )}
          />
        </div>
        
        <div className="flex items-center justify-between">
          <div className="space-y-0.5 mt-2">
            <Label className="text-sm font-semibold text-zinc-900">Parts Arrived</Label>
            <p className="text-xs text-zinc-500">Notify technician when a part order arrives</p>
          </div>
          <Controller
            control={control}
            name="notifyPartsArrived"
            render={({ field: { onChange, value } }) => (
               <Switch checked={value} onCheckedChange={onChange} />
            )}
          />
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
