import React, { useState } from 'react';
import { db } from '../../../firebase';
import { collection, getDocs, doc, writeBatch } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';

interface CustomerDuplicateMergeToolProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const CustomerDuplicateMergeTool = ({ isOpen, onOpenChange, onSuccess }: CustomerDuplicateMergeToolProps) => {
  const [isDeduplicating, setIsDeduplicating] = useState(false);
  const [dedupProgress, setDedupProgress] = useState<{current: number, total: number, step?: string} | null>(null);

  const removeDuplicates = async () => {
    setIsDeduplicating(true);
    setDedupProgress({ current: 0, total: 0, step: "Fetching..." });
    
    try {
      const snapshot = await getDocs(collection(db, 'crm_customers'));
      const allContacts = snapshot.docs.map(d => ({ id: d.id, ...d.data() as any }));
      
      const toDelete = new Set<string>();
      const seenKeys = new Set<string>();
      
      allContacts.sort((a, b) => {
        const scoreA = (a.email ? 1 : 0) + (a.phone ? 1 : 0) + (a.mobile ? 1 : 0) + (a.address ? 1 : 0);
        const scoreB = (b.email ? 1 : 0) + (b.phone ? 1 : 0) + (b.mobile ? 1 : 0) + (b.address ? 1 : 0);
        return scoreB - scoreA;
      });

      let processedCount = 0;
      for (const contact of allContacts) {
        let isDuplicate = false;
        const keys = [];
        
        if (contact.email && contact.email.includes("@")) {
          keys.push(`email:${contact.email.toLowerCase().trim()}`);
        }
        const p = contact.mobile || contact.phone;
        if (p && p.length >= 7) {
          keys.push(`phone:${p.replace(/\D/g, "")}`);
        }
        if (contact.firstname && contact.lastname) {
          keys.push(`name:${contact.firstname.toLowerCase().trim()}_${contact.lastname.toLowerCase().trim()}`);
        }

        for (const key of keys) {
          if (seenKeys.has(key)) {
            isDuplicate = true;
            break;
          }
        }

        if (isDuplicate) {
          toDelete.add(contact.id);
        } else {
          keys.forEach(k => seenKeys.add(k));
        }
        
        processedCount++;
        if (processedCount % 50 === 0) {
           setDedupProgress({ current: processedCount, total: allContacts.length, step: "Processing..." });
           await new Promise(res => setTimeout(res, 0));
        }
      }
      
      if (toDelete.size === 0) {
        toast.info("No duplicates found.");
        onOpenChange(false);
        return;
      }
      
      const idsToDelete = Array.from(toDelete);
      for (let i = 0; i < idsToDelete.length; i += 500) {
         const batch = writeBatch(db);
         const chunk = idsToDelete.slice(i, i + 500);
         chunk.forEach(id => batch.delete(doc(db, 'crm_customers', id)));
         await batch.commit();
         setDedupProgress({ current: Math.min(i + 500, idsToDelete.length), total: idsToDelete.length, step: "Deleting..." });
      }
      
      toast.success(`Removed ${toDelete.size} duplicate contacts.`);
      onOpenChange(false);
      onSuccess();
    } catch (e: any) {
      console.error("Deduplication error", e);
      toast.error("Failed to remove duplicates");
    } finally {
      setIsDeduplicating(false);
      setDedupProgress(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Deduplicate Contacts</DialogTitle>
          <DialogDescription>This will scan all contacts and merge/delete exact duplicates. Safe but permanent.</DialogDescription>
        </DialogHeader>
        
        {isDeduplicating && dedupProgress && (
          <div className="py-4 space-y-2">
            <p className="text-sm font-bold text-zinc-700">{dedupProgress.step}</p>
            {dedupProgress.total > 0 && (
              <div className="w-full bg-zinc-100 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all" 
                  style={{ width: `${(dedupProgress.current / dedupProgress.total) * 100}%` }}
                />
              </div>
            )}
          </div>
        )}

        {!isDeduplicating && (
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl h-10">Cancel</Button>
            <Button variant="destructive" onClick={removeDuplicates} className="rounded-xl h-10">Run Scan</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
