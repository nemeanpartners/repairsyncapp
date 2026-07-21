import React, { useState, useEffect } from "react";
import { db } from '../../../firebase';
import { collection, doc, getDocs, setDoc } from "firebase/firestore";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Save, Loader2 } from "lucide-react";

export function AutomationsSettingsForm() {
  const [smsTemplates, setSmsTemplates] = useState<{ [status: string]: string }>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAutomations = async () => {
      try {
        const snapshot = await getDocs(collection(db, "sms_templates"));
        const templates: { [key: string]: string } = {};
        snapshot.forEach(d => {
          templates[d.id] = d.data().message || "";
        });
        setSmsTemplates(templates);
      } catch (e) {
        console.error("Failed to fetch templates", e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAutomations();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Save all templates
      for (const [status, message] of Object.entries(smsTemplates)) {
        await setDoc(doc(db, "sms_templates", status), { message });
      }
      toast.success("SMS Automations saved successfully");
      setIsDirty(false);
    } catch (e) {
      console.error(e);
      toast.error("Failed to save automations");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin w-6 h-6 text-zinc-400" /></div>;

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-4">
        <div>
          <h3 className="text-lg font-bold text-zinc-900">SMS Status Automations</h3>
          <p className="text-sm text-zinc-500 mt-1">Automatically send an SMS when a ticket's status is changed.</p>
          <p className="text-xs text-zinc-400 mt-2">Available variables: {'{customer_name}'}, {'{ticket_number}'}, {'{shop_name}'}</p>
        </div>
        
        <div className="space-y-6 pt-4">
          {[
            { id: "Ready for Pickup", label: "When status changes to 'Ready for Pickup'" },
            { id: "Diagnostic Started", label: "When status changes to 'Diagnostic Started'" },
            { id: "Waiting on Parts", label: "When status changes to 'Waiting on Parts'" }
          ].map(statusRule => (
            <div key={statusRule.id} className="space-y-2 border-b border-zinc-100 pb-6 last:border-0 last:pb-0">
              <Label className="font-semibold text-zinc-900">{statusRule.label}</Label>
              <Textarea 
                placeholder={`e.g. Hi {customer_name}, your device (Ticket #{ticket_number}) is ready for pickup!`}
                value={smsTemplates[statusRule.id] || ''}
                onChange={(e) => {
                  setSmsTemplates(prev => ({...prev, [statusRule.id]: e.target.value}));
                  setIsDirty(true);
                }}
                rows={3}
              />
              <div className="flex items-center justify-end">
                <Switch 
                  checked={!!smsTemplates[statusRule.id]} 
                  onCheckedChange={(checked) => {
                    if (!checked) setSmsTemplates(prev => ({...prev, [statusRule.id]: ''}));
                    setIsDirty(true);
                  }}
                />
                <span className="text-xs font-medium text-zinc-500 ml-2">{smsTemplates[statusRule.id] ? 'Enabled' : 'Disabled'}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {isDirty && (
        <div className="sticky bottom-4 z-50 bg-white border border-zinc-200 shadow-lg p-4 rounded-xl flex items-center justify-between animate-in slide-in-from-bottom-5">
           <div className="text-sm font-medium">Unsaved changes</div>
           <Button onClick={handleSave} disabled={isSaving} className="bg-black text-white px-6">
             {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
             Save Changes
           </Button>
        </div>
      )}
    </div>
  );
}
