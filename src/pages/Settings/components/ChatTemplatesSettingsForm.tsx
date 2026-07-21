import React, { useState, useEffect } from "react";
import { db } from '../../../firebase';
import { collection, doc, getDocs, setDoc, deleteDoc, addDoc } from "firebase/firestore";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Save, Loader2 } from "lucide-react";

export function ChatTemplatesSettingsForm() {
  const [chatTemplates, setChatTemplates] = useState<{ id: string, text: string }[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchChatTemplates = async () => {
      try {
        const snapshot = await getDocs(collection(db, "chat_templates"));
        const templates: { id: string, text: string }[] = [];
        snapshot.forEach(d => {
          templates.push({ id: d.id, text: d.data().text || "" });
        });
        
        if (templates.length === 0) {
          const defaultTemplates = [
            { id: '1', text: "Hi {firstName}, how can I help you today?" },
            { id: '2', text: "Hi {firstName}, the quote for repairing your {device} is ready for review. Please reply to this SMS if you have any questions, or approve it so we can start work." },
            { id: '3', text: "Your {device} is ready for pickup." },
            { id: '4', text: "Your repair (Job #{ticketNumber}) is complete and your {device} is ready for pickup." },
            { id: '5', text: "We're currently looking into the issue with your {device} and will update you shortly." },
            { id: '6', text: "Thank you for choosing Phone Medic!" }
          ];
          setChatTemplates(defaultTemplates);
        } else {
          setChatTemplates(templates);
        }
      } catch (e) {
        console.error("Failed to fetch chat templates", e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchChatTemplates();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const snapshot = await getDocs(collection(db, "chat_templates"));
      const currentIds = chatTemplates.filter(t => !t.id.startsWith("new_")).map(t => t.id);
      
      const deletions = snapshot.docs.map(docSnap => {
        if (!currentIds.includes(docSnap.id)) {
           return deleteDoc(doc(db, "chat_templates", docSnap.id));
        }
        return Promise.resolve();
      });
      await Promise.all(deletions);

      const additions = chatTemplates.map(t => {
         if (t.id.startsWith("new_")) {
            return addDoc(collection(db, "chat_templates"), { text: t.text });
         } else {
            return setDoc(doc(db, "chat_templates", t.id), { text: t.text });
         }
      });
      await Promise.all(additions);
      
      toast.success("Chat templates saved successfully");
      setIsDirty(false);
      
      // refetch to update IDs
      const refetched = await getDocs(collection(db, "chat_templates"));
      const newTemplates: { id: string, text: string }[] = [];
      refetched.forEach(docSnap => {
          newTemplates.push({ id: docSnap.id, text: docSnap.data().text || "" });
      });
      setChatTemplates(newTemplates);
    } catch (e) {
      console.error(e);
      toast.error("Failed to save chat templates");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin w-6 h-6 text-zinc-400" /></div>;

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-zinc-900">Message Templates</h3>
            <p className="text-sm text-zinc-500 mt-1">Create fast replies that will be accessible inside customer chats and when sending new SMS messages.</p>
            <p className="text-xs text-zinc-400 mt-2 font-medium">Available variables: {'{firstName}'}, {'{lastName}'}, {'{customerName}'}, {'{device}'}, {'{ticketNumber}'}, {'{issue}'}</p>
          </div>
          <Button size="sm" variant="outline" className="shrink-0 font-medium" onClick={() => {
             setChatTemplates([{ id: `new_${Date.now()}`, text: '' }, ...chatTemplates]);
             setIsDirty(true);
          }}>
            <Plus className="w-4 h-4 mr-2" /> Add Template
          </Button>
        </div>
        
        <div className="space-y-4 pt-4">
          {chatTemplates.length === 0 ? (
            <div className="text-center py-10 text-zinc-400 text-sm border-2 border-dashed border-zinc-100 rounded-xl">
              No templates defined. Click Add Template to create one.
            </div>
          ) : (
            chatTemplates.map((template, idx) => (
              <div key={template.id} className="flex flex-col sm:flex-row items-end sm:items-start gap-3 bg-zinc-50 p-4 rounded-xl border border-zinc-100">
                <div className="flex-1 w-full space-y-2">
                   <Label className="text-xs text-zinc-500 uppercase font-semibold tracking-wide pl-1">Template Content</Label>
                   <Textarea 
                     placeholder="e.g. Hi {firstName}, your {device} repair is ready!"
                     value={template.text}
                     onChange={(e) => {
                       const t = [...chatTemplates];
                       t[idx].text = e.target.value;
                       setChatTemplates(t);
                       setIsDirty(true);
                     }}
                     className="bg-white border-zinc-200"
                     rows={2}
                   />
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => {
                    setChatTemplates(chatTemplates.filter((_, i) => i !== idx));
                    setIsDirty(true);
                  }}
                  className="text-zinc-400 hover:text-red-500 hover:bg-red-50 shrink-0"
                >
                   <Trash2 className="w-5 h-5" />
                </Button>
              </div>
            ))
          )}
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
