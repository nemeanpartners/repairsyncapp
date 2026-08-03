import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../../../providers/SettingsProvider';
import { useAuth } from '../../../providers/AuthProvider';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Loader2, ChevronDown, ChevronUp, Lock, MessageSquare, PhoneCall, Server } from 'lucide-react';

type TwilioSettingsFormProps = {
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
};

export function TwilioSettingsForm({ expanded, onExpandedChange }: TwilioSettingsFormProps = {}) {
  const { settings, updateSettings } = useSettings();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [internalExpanded, setInternalExpanded] = useState(false);
  const isExpanded = expanded ?? internalExpanded;
  const setIsExpanded = onExpandedChange ?? setInternalExpanded;
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const isProfessional =
    Boolean(profile?.subscriptionActive) &&
    (profile?.subscriptionPlan === 'pro' || profile?.subscriptionPlan === 'enterprise');
  const managedMessagingEnabled = Boolean(
    settings?.integrations?.managedMessagingEnabled &&
      settings?.integrations?.managedMessagingAccountId &&
      settings?.integrations?.mobileMessageEnabled &&
      settings?.integrations?.smsRelayEnabled
  );
  const managedPhoneEnabled = Boolean(settings?.integrations?.managedMaxotelEnabled || settings?.integrations?.maxotelEnabled);

  const handleConfigureManaged = async () => {
    if (!isProfessional) {
      toast.error('Professional subscription required', {
        description: 'Switch subscriptions in Settings to connect SMS and phone integrations.',
      });
      return;
    }
    try {
      setIsConfiguring(true);
      const response = await axios.post('/api/company/provision-messaging', {
        companyId: profile?.companyId,
        includePhone: true,
      });
      await updateSettings('integrations', response.data.integrations as any);
      toast.success('Managed messaging configured', {
        description: 'MobileMessage, Backend SMS Relay, and Maxotel are configured for this company.',
      });
    } finally {
      setIsConfiguring(false);
    }
  };

  const handleConfigureManagedPhone = async () => {
    if (!isProfessional) {
      toast.error('Professional subscription required', {
        description: 'Switch subscriptions in Settings to connect phone integrations.',
      });
      return;
    }
    try {
      setIsConfiguring(true);
      const response = await axios.post('/api/company/provision-messaging', {
        companyId: profile?.companyId,
        includePhone: true,
      });
      await updateSettings('integrations', response.data.integrations as any);
      toast.success('Managed Maxotel configured', {
        description: 'A separate RepairSync phone integration record was generated for this company.',
      });
    } finally {
      setIsConfiguring(false);
    }
  };

  const handleCheckStatus = async () => {
    try {
      setIsCheckingStatus(true);
      const response = await axios.get('/api/mobilemessage/balance');
      const balance = response.data?.credit_balance;
      if (balance === null || balance === undefined) {
        toast.warning('Managed SMS status checked', {
          description: 'The gateway responded without a current credit balance.',
        });
      } else {
        toast.success('Managed SMS is active', {
          description: `Current SMS credit balance: ${balance}`,
        });
      }
    } catch (error: any) {
      if (error.response?.data?.upgradeRequired) {
        toast.error('Professional subscription required', {
          description: error.response.data.error,
        });
      } else {
        toast.error('Managed SMS check failed', {
          description: error.response?.data?.error || error.message,
        });
      }
    } finally {
      setIsCheckingStatus(false);
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
            <h3 className="font-bold text-zinc-900">Managed SMS and Phone Integrations</h3>
            <p className="text-sm text-zinc-500">Enable RepairSync-managed messaging and phone services for this company</p>
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
        <div className="p-6 border-t border-zinc-100 bg-zinc-50/50 space-y-6">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-xl bg-emerald-50 p-2 text-emerald-600">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="font-bold text-zinc-900">RepairSync Managed SMS</h4>
                  <p className="text-sm text-zinc-500">
                    Sends customer SMS through RepairSync server credentials while storing messages inside this company only.
                  </p>
                </div>
              </div>
              {managedMessagingEnabled ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" /> : null}
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950">
              <p>Users do not enter provider API keys. RepairSync creates a separate company messaging account and stores all message data under this company.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button type="button" onClick={handleConfigureManaged} disabled={isConfiguring || managedMessagingEnabled}>
                {isConfiguring ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Server className="mr-2 h-4 w-4" />}
                {managedMessagingEnabled ? 'Configured' : 'Configure Automatically'}
              </Button>
              <Button type="button" variant="outline" onClick={handleCheckStatus} disabled={isCheckingStatus || !managedMessagingEnabled}>
                {isCheckingStatus ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                Check Gateway Status
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-4 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-xl bg-purple-50 p-2 text-purple-600">
                  <PhoneCall className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="font-bold text-zinc-900">RepairSync Managed Maxotel</h4>
                  <p className="text-sm text-zinc-500">
                    Enables phone log visibility for this company using RepairSync server-side Maxotel credentials.
                  </p>
                </div>
              </div>
              {managedPhoneEnabled ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" /> : null}
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950">
              <p>This creates a company-specific phone integration record. It does not reuse the old RepairSync SMS app credentials.</p>
            </div>
            <div>
              <Button type="button" onClick={handleConfigureManagedPhone} disabled={isConfiguring || managedPhoneEnabled}>
                {isConfiguring ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PhoneCall className="mr-2 h-4 w-4" />}
                {managedPhoneEnabled ? 'Configured' : 'Configure Automatically'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
