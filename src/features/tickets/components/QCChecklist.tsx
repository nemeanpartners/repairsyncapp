import React, { useState, useEffect } from 'react';
import { db, auth } from '../../../firebase';
import { doc, getDoc, setDoc, updateDoc, collection, serverTimestamp } from 'firebase/firestore';
import { CheckCircle2, Circle, XCircle, AlertCircle, Save, Loader2, Camera, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface QCTemplate {
  id: string;
  name: string;
  description: string;
  items: { id: string, label: string }[];
}

const TEMPLATES: Record<string, QCTemplate> = {
  smartphone: {
    id: 'smartphone',
    name: 'Smartphone QC',
    description: 'Standard tests for iPhones and Androids.',
    items: [
      { id: 'screen_touch', label: 'Screen Touch Response' },
      { id: 'display_colors', label: 'Display Quality (No dead pixels)' },
      { id: 'front_camera', label: 'Front Camera' },
      { id: 'rear_camera', label: 'Rear Camera & Flash' },
      { id: 'earpiece', label: 'Earpiece Speaker' },
      { id: 'loudspeaker', label: 'Loudspeaker' },
      { id: 'microphone', label: 'Microphone(s)' },
      { id: 'buttons', label: 'Physical Buttons (Vol, Power)' },
      { id: 'charging', label: 'Charging / Port' },
      { id: 'wifi_bt', label: 'Wi-Fi / Bluetooth' }
    ]
  },
  laptop: {
    id: 'laptop',
    name: 'Laptop QC',
    description: 'Standard tests for Macs and PC Laptops.',
    items: [
      { id: 'display', label: 'Display Panel & Hinge' },
      { id: 'keyboard', label: 'Keyboard (All keys)' },
      { id: 'trackpad', label: 'Trackpad response' },
      { id: 'battery', label: 'Battery / Charging' },
      { id: 'ports', label: 'I/O Ports (USB, HDMI, Audio)' },
      { id: 'camera', label: 'Webcam & Mic' },
      { id: 'audio', label: 'Speakers' },
      { id: 'wifi', label: 'Wi-Fi connectivity' }
    ]
  },
  vacuum: {
    id: 'vacuum',
    name: 'Robot Vacuum QC',
    description: 'Standard tests for Robot Vacuums (Roborock, Roomba, etc).',
    items: [
      { id: 'charging_dock', label: 'Docks & Charges Correctly' },
      { id: 'wheels', label: 'Drive Wheels & Caster' },
      { id: 'brushes', label: 'Main & Side Brushes Spin' },
      { id: 'suction', label: 'Suction Motor Function' },
      { id: 'sensors', label: 'Drop & Bumper Sensors' },
      { id: 'lidar', label: 'LiDAR / Mapping Navigation' },
      { id: 'water_tank', label: 'Water Tank / Mopping Unit' },
      { id: 'app_wifi', label: 'Wi-Fi / App Connection' }
    ]
  }
};

interface QCChecklistProps {
  ticketId: string;
  category: string; // 'phone', 'laptop', etc.
}

type QCStatus = 'pass' | 'fail' | 'na' | 'pending';

export function QCChecklist({ ticketId, category }: QCChecklistProps) {
  const [template, setTemplate] = useState<QCTemplate | null>(null);
  const [results, setResults] = useState<Record<string, QCStatus>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  useEffect(() => {
    // determine template
    const cat = category.toLowerCase();
    let tpl = TEMPLATES.smartphone;
    if (cat.includes('laptop') || cat.includes('macbook') || cat.includes('pc')) {
      tpl = TEMPLATES.laptop;
    } else if (cat.includes('vacuum') || cat.includes('robovac') || cat.includes('robot')) {
      tpl = TEMPLATES.vacuum;
    }
    setTemplate(tpl);

    // load existing QC data
    const loadQC = async () => {
      try {
        const docRef = doc(db, 'crm_tickets', ticketId, 'qc_checklist', 'current');
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          setResults(data.results || {});
          setNotes(data.notes || {});
          setLastSaved(data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date());
        } else {
          // prepopulate pending
          const init: Record<string, QCStatus> = {};
          tpl.items.forEach(i => init[i.id] = 'pending');
          setResults(init);
        }
      } catch (err) {
        console.error("QC Load Error", err);
      } finally {
        setIsLoading(false);
      }
    };
    loadQC();
  }, [ticketId, category]);

  const handleSetStatus = (id: string, status: QCStatus) => {
    setResults(p => ({ ...p, [id]: status }));
  };

  const handleSave = async () => {
    if (!template) return;
    setIsSaving(true);
    try {
      const docRef = doc(db, 'crm_tickets', ticketId, 'qc_checklist', 'current');
      
      const payload = {
        templateId: template.id,
        results,
        notes,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.uid || 'unknown'
      };

      await setDoc(docRef, payload, { merge: true });
      setLastSaved(new Date());

      // Optionally add an internal note that QC was performed
      const passedCount = Object.values(results).filter(s => s === 'pass').length;
      const failedCount = Object.values(results).filter(s => s === 'fail').length;
      
      await setDoc(doc(collection(db, 'crm_notes')), {
         ticket_id: ticketId,
         body: `<strong>QC Checklist Updated</strong><br/> Passed: ${passedCount}, Failed: ${failedCount}`,
         subject: "QC Report",
         tech: auth.currentUser?.displayName || "Technician",
         created_at: new Date().toISOString(),
         updated_at: new Date().toISOString()
      });

    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const [isCollapsed, setIsCollapsed] = useState(true);

  if (isLoading) return <div className="p-4 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-zinc-400" /></div>;
  if (!template) return null;

  const passedCount = Object.values(results).filter(s => s === 'pass').length;
  const failedCount = Object.values(results).filter(s => s === 'fail').length;
  const total = template.items.length;
  const progress = Math.round(((passedCount + failedCount + Object.values(results).filter(s=>s==='na').length) / total) * 100);

  return (
    <div className="bg-white border text-zinc-900 border-zinc-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
       <div 
         className="px-5 py-4 flex justify-between items-center bg-zinc-50/50 cursor-pointer hover:bg-zinc-100/50 transition-colors"
         onClick={() => setIsCollapsed(!isCollapsed)}
       >
          <div className="flex-1">
            <h4 className="font-bold flex items-center text-sm"><CheckCircle2 className="w-4 h-4 mr-2 text-emerald-500" /> Quality Control (QC)</h4>
            <p className="text-xs text-zinc-500 mt-0.5">{template.name} • {progress}% Complete</p>
          </div>
          <div className="flex items-center gap-3">
             <Button size="sm" onClick={(e) => { e.stopPropagation(); handleSave(); }} disabled={isSaving} className="bg-zinc-900 hover:bg-zinc-800 text-white shadow-sm">
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save QC
             </Button>
             <div className="text-zinc-400">
                {isCollapsed ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
             </div>
          </div>
       </div>

       {!isCollapsed && (
         <>
           {failedCount > 0 && (
             <div className="bg-red-50 border-y border-red-100 p-3 px-5 flex items-center gap-2 text-red-700 text-sm font-semibold text-[13px]">
               <AlertCircle className="w-4 h-4 shrink-0" />
               Warning: {failedCount} item(s) failed QC. Device may not be ready.
             </div>
           )}

           <div className="p-0 space-y-0 divide-y divide-zinc-100 border-t border-zinc-200">

         {template.items.map(item => {
           const st = results[item.id] || 'pending';
           return (
             <div key={item.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-zinc-50/50 transition-colors">
                <span className="font-medium text-sm text-zinc-800 flex-1">{item.label}</span>
                <div className="flex bg-zinc-100/80 p-1 rounded-xl shadow-inner shrink-0">
                  <button 
                    onClick={() => handleSetStatus(item.id, 'pass')}
                    className={`flex-1 md:flex-none px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all
                      ${st === 'pass' ? 'bg-emerald-500 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-200/50'}`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Pass
                  </button>
                  <button 
                    onClick={() => handleSetStatus(item.id, 'fail')}
                    className={`flex-1 md:flex-none px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all
                      ${st === 'fail' ? 'bg-rose-500 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-200/50'}`}
                  >
                     <XCircle className="w-3.5 h-3.5" /> Fail
                  </button>
                  <button 
                    onClick={() => handleSetStatus(item.id, 'na')}
                    className={`flex-1 md:flex-none px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all
                      ${st === 'na' ? 'bg-zinc-400 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-200/50'}`}
                  >
                     <HelpCircle className="w-3.5 h-3.5" /> N/A
                  </button>
                </div>
             </div>
           );
         })}
       </div>
       {lastSaved && (
         <div className="bg-zinc-50 border-t border-zinc-200 px-5 py-3 text-xs text-zinc-400 font-medium">
           Last saved: {lastSaved.toLocaleString()}
         </div>
       )}
       </>
       )}
    </div>
  );
}
