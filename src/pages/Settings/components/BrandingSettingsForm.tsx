import React, { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { BrandingSettingsSchema, BrandingSettings } from '../../../types/settings';
import { useSettings } from '../../../providers/SettingsProvider';
import { Button } from '@/components/ui/button';
import { Save, Loader2 } from 'lucide-react';

export function BrandingSettingsForm() {
  const { settings, updateSettings } = useSettings();
  
  const { control, handleSubmit, reset, formState: { isSubmitting, isDirty } } = useForm<BrandingSettings>({
    resolver: zodResolver(BrandingSettingsSchema),
    defaultValues: settings?.branding
  });

  useEffect(() => {
    if (settings?.branding) {
      reset(settings.branding);
    }
  }, [settings?.branding, reset]);

  const onSubmit = async (data: BrandingSettings) => {
    await updateSettings('branding', data);
    reset(data); // reset isDirty
  };

  if (!settings) return null;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-6">
        <div>
          <h3 className="text-lg font-bold text-zinc-900">Theme</h3>
          <p className="text-sm text-zinc-500">Pick the theme for your dashboard.</p>
        </div>
        
        <Controller
          control={control}
          name="theme"
          render={({ field: { onChange, value } }) => (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {['Light', 'Dark', 'System'].map((themeName) => (
                 <div 
                   key={themeName} 
                   onClick={() => onChange(themeName)}
                   className={`p-4 rounded-xl border flex flex-col items-center gap-2 cursor-pointer transition-all ${value === themeName ? 'border-zinc-950 bg-zinc-50 ring-1 ring-zinc-950' : 'border-zinc-200 hover:border-zinc-300'}`}
                 >
                   <div className="w-full h-16 rounded-lg bg-zinc-200 mb-2 overflow-hidden flex">
                     {themeName !== 'Dark' && <div className="w-full bg-white h-full border-r" />}
                     {themeName !== 'Light' && <div className="w-full bg-zinc-900 h-full" />}
                   </div>
                   <span className="font-semibold text-sm">{themeName}</span>
                 </div>
              ))}
            </div>
          )}
        />
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
