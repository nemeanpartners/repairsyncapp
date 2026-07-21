import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { db, auth } from "../../firebase";
import { collection, addDoc } from "firebase/firestore";
import axios from "axios";
import { toast } from "sonner";
import { Send, Clock } from "lucide-react";

export interface CompleteRepairModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticketId: string;
  ticketNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  onSuccess: (status: string) => void;
}

export function CompleteRepairModal({
  isOpen,
  onClose,
  ticketId,
  ticketNumber,
  customerId,
  customerName,
  customerPhone,
  onSuccess,
}: CompleteRepairModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [smsMessage, setSmsMessage] = useState("");

  useEffect(() => {
    setSmsMessage(
      `Hi ${customerName}, your repair for ticket #${ticketNumber} is now complete and ready for pickup! - PhoneMedic`
    );
  }, [customerName, ticketNumber]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      // 1. Add an internal note to the ticket
      await addDoc(collection(db, "crm_notes"), {
        ticket_id: ticketId,
        body: `Completed repair and sent SMS notification to customer indicating ready for pickup.`,
        subject: "Repair Completed",
        tech: auth.currentUser?.displayName || "Technician",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // 2. Send SMS if phone exists
      if (customerPhone) {
        await axios.post("/api/mobilemessage/send", {
          to: customerPhone,
          message: smsMessage,
          customerId: customerId,
          customerName: customerName,
          ticket_id: ticketId,
        });
        toast.success("Repair completed and SMS sent!");
      } else {
        toast.success("Repair completed. (No phone number attached to send SMS)");
      }

      onSuccess("Ready for Pickup");
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || err.message || "Failed to complete repair.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center text-lg">
            <Clock className="w-5 h-5 mr-2 text-zinc-500" /> Complete Repair
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          <div className="space-y-2 bg-zinc-50 p-4 border border-zinc-200 rounded-lg">
            <Label className="text-zinc-500 text-xs uppercase tracking-wider font-bold">
              SMS Preview (Will be sent immediately)
            </Label>
            <p className="text-sm text-zinc-800 leading-relaxed min-h-[60px]">
              {smsMessage}
            </p>
            {!customerPhone && (
              <p className="text-xs text-rose-500 mt-2">
                Note: The customer has no valid phone number. Only the status will be updated.
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              <Send className="w-4 h-4 mr-2" />
              {isSubmitting ? "Processing..." : "Complete & Notify Customer"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
