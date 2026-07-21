import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useSettings } from '../../../providers/SettingsProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save, Loader2, LinkIcon, ChevronDown, ChevronUp } from 'lucide-react';
import { IntegrationsSettings } from '../../../types/settings';

export function TwilioSettingsForm() {
  const { settings, updateSettings } = useSettings();
  const [isExpanded, setIsExpanded] = useState(false);
  
  const { register, handleSubmit, reset, formState: { errors, isSubmitting, isDirty } } = useForm<IntegrationsSettings>({
    defaultValues: {
      rcsEnabled: settings?.integrations?.rcsEnabled || false,
      twilioAccountSid: settings?.integrations?.twilioAccountSid || '',
      twilioAuthToken: settings?.integrations?.twilioAuthToken || '',
      twilioPhoneNumber: settings?.integrations?.twilioPhoneNumber || '',
    }
  });

  useEffect(() => {
    if (settings?.integrations) {
      reset({
        ...settings.integrations,
        twilioAccountSid: settings.integrations.twilioAccountSid || '',
        twilioAuthToken: settings.integrations.twilioAuthToken || '',
        twilioPhoneNumber: settings.integrations.twilioPhoneNumber || '',
      });
    }
  }, [settings?.integrations, reset]);

  const onSubmit = async (data: IntegrationsSettings) => {
    await updateSettings('integrations', data);
    reset(data); 
  };

  if (!settings) return null;

  return (
    <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
      <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
            <LinkIcon className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h3 className="font-bold text-zinc-900">Twilio SMS</h3>
            <p className="text-sm text-zinc-500">Enable SMS notifications for customers</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => setIsExpanded(!isExpanded)}>
          {isExpanded ? (
            <><ChevronUp className="w-4 h-4 mr-2" /> Hide Config</>
          ) : (
            <><ChevronDown className="w-4 h-4 mr-2" /> Configure</>
          )}
        </Button>
      </div>

      {isExpanded && (
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 border-t border-zinc-100 bg-zinc-50/50 space-y-4">
          <div className="space-y-2">
            <Label>Twilio Account SID</Label>
            <Input {...register('twilioAccountSid')} type="password" placeholder="AC..." />
          </div>
          <div className="space-y-2">
            <Label>Twilio Auth Token</Label>
            <Input {...register('twilioAuthToken')} type="password" placeholder="Your Auth Token" />
          </div>
          <div className="space-y-2">
            <Label>Twilio Phone Number</Label>
            <Input {...register('twilioPhoneNumber')} placeholder="+1234567890" />
          </div>
          
          <div className="pt-2 flex justify-end">
            <Button type="submit" disabled={isSubmitting || !isDirty}>
              {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Config
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
