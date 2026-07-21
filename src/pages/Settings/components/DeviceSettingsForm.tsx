import React, { useEffect, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { DeviceSettingsSchema, DeviceSettings } from '../../../types/settings';
import { useSettings } from '../../../providers/SettingsProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save, Loader2, Plus, Trash2, ChevronDown, ChevronUp, X } from 'lucide-react';
import { toast } from 'sonner';

export function DeviceSettingsForm() {
  const { settings, updateSettings, loading } = useSettings();
  
  const { register, control, handleSubmit, reset, watch, formState: { errors, isSubmitting, isDirty } } = useForm<{ brands: { name: string; models: string[] }[] }>({
    resolver: zodResolver(DeviceSettingsSchema) as any,
    defaultValues: settings?.devices || { brands: [] }
  });

  const { fields: brandFields, append: appendBrand, remove: removeBrand } = useFieldArray({
    control,
    name: "brands"
  });

  const [expandedBrands, setExpandedBrands] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (settings?.devices) {
      reset(settings.devices);
    }
  }, [settings?.devices, reset]);

  const toggleBrand = (index: number) => {
    setExpandedBrands(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const onSubmit = async (data: any) => {
    try {
      await updateSettings('devices', data);
      reset(data); // reset isDirty
      toast.success("Device settings saved successfully.");
    } catch (e) {
      toast.error("Failed to save device settings");
    }
  };

  if (loading) return null;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-zinc-900">Device Brands & Models</h3>
            <p className="text-sm text-zinc-500">Manage the list of device models available during intake.</p>
          </div>
          <Button type="button" variant="outline" onClick={() => appendBrand({ name: "", models: [] })}>
            <Plus className="w-4 h-4 mr-2" /> Add Brand
          </Button>
        </div>
        
        <div className="space-y-4 pt-4">
          {brandFields.map((brandField, brandIndex) => {
            const isExpanded = expandedBrands[brandIndex];
            return (
              <div key={brandField.id} className="border border-zinc-200 rounded-xl overflow-hidden">
                <div className="flex items-center gap-4 bg-zinc-50 p-3 pr-4">
                  <Input 
                    {...register(`brands.${brandIndex}.name`)} 
                    placeholder="Brand Name (e.g. Apple)" 
                    className="flex-1 bg-white"
                  />
                  <Button type="button" variant="ghost" size="icon" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => removeBrand(brandIndex)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" onClick={() => toggleBrand(brandIndex)}>
                     {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </Button>
                </div>
                
                {isExpanded && (
                  <div className="p-4 bg-white border-t border-zinc-100">
                    <ModelList 
                      control={control} 
                      brandIndex={brandIndex} 
                      register={register}
                    />
                  </div>
                )}
              </div>
            );
          })}
          {brandFields.length === 0 && (
            <p className="text-sm text-zinc-500 text-center py-4">No brands configured. Add a brand to get started.</p>
          )}
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

function ModelList({ control, brandIndex, register }: { control: any, brandIndex: number, register: any }) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: `brands.${brandIndex}.models` as const
  });

  const [newModel, setNewModel] = useState('');

  const handleAdd = () => {
    if (newModel.trim()) {
      append(newModel.trim());
      setNewModel('');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {fields.map((field, modelIndex) => (
          <div key={field.id} className="flex items-center gap-1 bg-zinc-100 border border-zinc-200 px-3 py-1.5 rounded-lg text-sm">
            <input 
              {...register(`brands.${brandIndex}.models.${modelIndex}`)} 
              className="bg-transparent border-none p-0 focus:ring-0 max-w-[120px]"
            />
            <button type="button" onClick={() => remove(modelIndex)} className="text-zinc-400 hover:text-red-500 rounded-full p-0.5 ml-1">
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-2 max-w-sm">
        <Input 
          placeholder="New Model (e.g. iPhone 15)" 
          value={newModel} 
          onChange={e => setNewModel(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAdd();
            }
          }}
          className="text-sm h-9"
        />
        <Button type="button" size="sm" onClick={handleAdd} variant="secondary">Add</Button>
      </div>
    </div>
  );
}
