import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import axios from 'axios';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../../../providers/SettingsProvider';
import { useAuth } from '../../../providers/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save, Loader2, LinkIcon, ChevronDown, ChevronUp, Lock, MessageSquare, PhoneCall } from 'lucide-react';
import { IntegrationsSettings } from '../../../types/settings';

export function TwilioSettingsForm() {
  const { settings, updateSettings } = useSettings();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCheckingBalance, setIsCheckingBalance] = useState(false);
  const isProfessional =
    Boolean(profile?.subscriptionActive) &&
    (profile?.subscriptionPlan === 'pro' || profile?.subscriptionPlan === 'enterprise');

  const { register, handleSubmit, reset, formState: { isSubmitting, isDirty } } = useForm<IntegrationsSettings>({
    defaultValues: {
      rcsEnabled: settings?.integrations?.rcsEnabled || false,
      mobileMessageEnabled: settings?.integrations?.mobileMessageEnabled || false,
      mobileMessageUsername: settings?.integrations?.mobileMessageUsername || '',
      mobileMessagePassword: settings?.integrations?.mobileMessagePassword || '',
      mobileMessageSenderId: settings?.integrations?.mobileMessageSenderId || '',
      repairShoprSubdomain: settings?.integrations?.repairShoprSubdomain || '',
      repairShoprApiKey: settings?.integrations?.repairShoprApiKey || '',
      maxotelEnabled: settings?.integrations?.maxotelEnabled || false,
      maxotelApiKey: settings?.integrations?.maxotelApiKey || '',
      maxotelPhoneNumber: settings?.integrations?.maxotelPhoneNumber || '',
    }
  });

  useEffect(() => {
    if (settings?.integrations) {
      reset({
        ...settings.integrations,
        mobileMessageEnabled: settings.integrations.mobileMessageEnabled || false,
        mobileMessageUsername: settings.integrations.mobileMessageUsername || '',
        mobileMessagePassword: settings.integrations.mobileMessagePassword || '',
        mobileMessageSenderId: settings.integrations.mobileMessageSenderId || '',
        repairShoprSubdomain: settings.integrations.repairShoprSubdomain || '',
        repairShoprApiKey: settings.integrations.repairShoprApiKey || '',
        maxotelEnabled: settings.integrations.maxotelEnabled || false,
        maxotelApiKey: settings.integrations.maxotelApiKey || '',
        maxotelPhoneNumber: settings.integrations.maxotelPhoneNumber || '',
      });
    }
  }, [settings?.integrations, reset]);

  const onSubmit = async (data: IntegrationsSettings) => {
    if (!isProfessional) {
      toast.error('Professional subscription required', {
        description: 'Switch subscriptions in Settings to connect SMS and phone integrations.',
      });
      return;
    }

    await updateSettings('integrations', data);
    reset(data);
    toast.success('Messaging integrations saved');
  };

  const handleCheckBalance = async () => {
    try {
      setIsCheckingBalance(true);
      const response = await axios.get('/api/mobilemessage/balance');
      const balance = response.data?.credit_balance;
      if (balance === null || balance === undefined) {
        toast.warning('MobileMessage did not return a balance', {
          description: 'Check the username and password before sending live SMS.',
        });
      } else {
        toast.success('MobileMessage connected', {
          description: `Current SMS credit balance: ${balance}`,
        });
      }
    } catch (error: any) {
      if (error.response?.data?.upgradeRequired) {
        toast.error('Professional subscription required', {
          description: error.response.data.error,
        });
      } else {
        toast.error('MobileMessage check failed', {
          description: error.response?.data?.error || error.message,
        });
      }
    } finally {
      setIsCheckingBalance(false);
    }
  };

  if (!settings) return null;

  return (
    <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
      <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
            <MessageSquare className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h3 className="font-bold text-zinc-900">SMS and Phone Integrations</h3>
            <p className="text-sm text-zinc-500">Connect MobileMessage Gateway, RepairShopr fallback, and Maxotel call logs</p>
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

      {isExpanded && !isProfessional && (
        <div className="m-6 mt-0 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <Lock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div className="space-y-3">
              <div>
                <h4 className="font-bold text-amber-950">Professional subscription required</h4>
                <p className="text-sm text-amber-800">
                  SMS gateway, carrier messaging, RepairShopr SMS fallback, and Maxotel phone integrations are included with Professional.
                </p>
              </div>
              <Button size="sm" onClick={() => navigate('/payments?plan=pro&interval=monthly')}>
                Switch Subscriptions
              </Button>
            </div>
          </div>
        </div>
      )}

      {isExpanded && isProfessional && (
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 border-t border-zinc-100 bg-zinc-50/50 space-y-6">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 space-y-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-emerald-600" />
              <h4 className="font-bold text-zinc-900">MobileMessage Gateway</h4>
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold text-zinc-700">
              <input type="checkbox" {...register('mobileMessageEnabled')} className="h-4 w-4 rounded border-zinc-300" />
              Enable outbound SMS through this company account
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>API Username</Label>
                <Input {...register('mobileMessageUsername')} autoComplete="off" placeholder="MobileMessage username" />
              </div>
              <div className="space-y-2">
                <Label>API Password</Label>
                <Input {...register('mobileMessagePassword')} type="password" autoComplete="new-password" placeholder="MobileMessage password" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Sender ID</Label>
                <Input {...register('mobileMessageSenderId')} placeholder="RepairSync or approved sender" />
              </div>
            </div>
            <Button type="button" variant="outline" onClick={handleCheckBalance} disabled={isCheckingBalance}>
              {isCheckingBalance ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LinkIcon className="w-4 h-4 mr-2" />}
              Check MobileMessage Balance
            </Button>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-4 space-y-4">
            <div className="flex items-center gap-2">
              <LinkIcon className="h-4 w-4 text-blue-600" />
              <h4 className="font-bold text-zinc-900">RepairShopr SMS Fallback</h4>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>RepairShopr Subdomain</Label>
                <Input {...register('repairShoprSubdomain')} placeholder="yourshop" />
              </div>
              <div className="space-y-2">
                <Label>RepairShopr API Key</Label>
                <Input {...register('repairShoprApiKey')} type="password" autoComplete="new-password" placeholder="API key" />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-4 space-y-4">
            <div className="flex items-center gap-2">
              <PhoneCall className="h-4 w-4 text-purple-600" />
              <h4 className="font-bold text-zinc-900">Maxotel</h4>
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold text-zinc-700">
              <input type="checkbox" {...register('maxotelEnabled')} className="h-4 w-4 rounded border-zinc-300" />
              Enable Maxotel call logs for this company
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Maxotel API Key</Label>
                <Input {...register('maxotelApiKey')} type="password" autoComplete="new-password" placeholder="Maxotel API key" />
              </div>
              <div className="space-y-2">
                <Label>Business Phone Number</Label>
                <Input {...register('maxotelPhoneNumber')} placeholder="0733681772" />
              </div>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <Button type="submit" disabled={isSubmitting || !isDirty}>
              {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Integrations
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
