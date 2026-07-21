import React, { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AiSettingsSchema, AiSettings } from '../../../types/settings';
import { useSettings } from '../../../providers/SettingsProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Save, Loader2 } from 'lucide-react';

export function AiSettingsForm() {
  const { settings, updateSettings } = useSettings();
  
  const { register, control, handleSubmit, reset, formState: { errors, isSubmitting, isDirty } } = useForm<AiSettings>({
    resolver: zodResolver(AiSettingsSchema),
    defaultValues: settings?.ai
  });

  useEffect(() => {
    if (settings?.ai) {
      reset(settings.ai);
    }
  }, [settings?.ai, reset]);

  const onSubmit = async (data: AiSettings) => {
    await updateSettings('ai', data);
    reset(data); // reset isDirty
  };

  if (!settings) return null;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-4">
        <div>
          <h3 className="text-lg font-bold text-zinc-900">Gemini AI Configuration</h3>
          <p className="text-sm text-zinc-500 mt-1">Configure your AI assistant for diagnostics and replies.</p>
        </div>
        
        <div className="space-y-2 pt-4">
          <Label>Gemini API Key</Label>
          <Input {...register('geminiApiKey')} type="password" placeholder="AIZA..." />
          <p className="text-xs text-zinc-500 mt-1">Get your API key from Google AI Studio.</p>
          {errors.geminiApiKey && <p className="text-xs text-red-500">{errors.geminiApiKey.message}</p>}
        </div>
        
        <div className="flex items-center justify-between pt-4">
          <div className="space-y-0.5 mt-2">
            <Label className="text-sm font-semibold text-zinc-900">Auto-suggest Diagnostics</Label>
            <p className="text-xs text-zinc-500">AI will suggest solutions on new tickets</p>
          </div>
          <Controller
            control={control}
            name="autoSuggestDiagnostics"
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
