import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertCircle, Loader2 } from 'lucide-react';

interface DeleteAccountRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
}

export function DeleteAccountRequestModal({ isOpen, onClose, onSubmit }: DeleteAccountRequestModalProps) {
  const [confirmationText, setConfirmationText] = useState("");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isConfirmed = confirmationText === "DELETE MY ACCOUNT";

  const handleSubmit = async () => {
    if (!isConfirmed) return;
    setIsSubmitting(true);
    try {
      await onSubmit(reason);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md bg-white border border-red-200">
        <DialogHeader>
          <div className="flex items-center gap-2 text-red-600 mb-2">
            <AlertCircle className="w-5 h-5" />
            <DialogTitle>Request Account Deletion</DialogTitle>
          </div>
          <DialogDescription className="text-zinc-600">
            This action will submit a request to completely remove your account and personal data from our systems. Operational records may be anonymized to preserve business continuity. An admin must approve this request.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-zinc-900">Optional Reason</label>
            <textarea
              className="w-full bg-zinc-50 border border-zinc-200 p-3 rounded-lg text-sm"
              rows={3}
              placeholder="Why are you leaving?"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-zinc-900">
              Type <strong className="text-red-500">DELETE MY ACCOUNT</strong> to confirm
            </label>
            <input
              type="text"
              className="w-full bg-zinc-50 border border-zinc-200 p-2 rounded-lg text-sm"
              value={confirmationText}
              onChange={(e) => setConfirmationText(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!isConfirmed || isSubmitting}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Submit Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
