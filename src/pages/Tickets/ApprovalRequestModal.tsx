import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { db, auth } from "../../firebase";
import { collection, addDoc } from "firebase/firestore";
import axios from "axios";
import { toast } from "sonner";
import { Send, FileText } from "lucide-react";

export interface ApprovalRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticketId: string;
  ticketNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  onSuccess: (status: string) => void;
}

export function ApprovalRequestModal({
  isOpen,
  onClose,
  ticketId,
  ticketNumber,
  customerId,
  customerName,
  customerPhone,
  onSuccess,
}: ApprovalRequestModalProps) {
  const [quoteAmount, setQuoteAmount] = useState<number | "">("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [smsMessage, setSmsMessage] = useState("");

  useEffect(() => {
    if (isOpen) {
      setQuoteAmount("");
    }
  }, [isOpen]);

  useEffect(() => {
    if (quoteAmount !== "" && quoteAmount > 0) {
      setSmsMessage(
        `Hi ${customerName}, your repair estimate for ticket #${ticketNumber} is $${parseFloat(quoteAmount.toString()).toFixed(2)}. Please reply YES to proceed or NO to decline. - PhoneMedic`
      );
    } else {
      setSmsMessage("");
    }
  }, [quoteAmount, customerName, ticketNumber]);

  const handleSubmit = async () => {
    if (!quoteAmount || quoteAmount <= 0) {
      toast.error("Please enter a valid quote amount.");
      return;
    }
    if (!customerPhone) {
      toast.error("Customer phone number is missing.");
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Record the estimate
      const estNum = `EST-${Math.floor(100000 + Math.random() * 900000)}`;
      await addDoc(collection(db, "estimates"), {
        customer_id: customerId,
        ticket_id: ticketId,
        estimate_number: estNum,
        status: "DRAFT",
        subtotal: Number(quoteAmount),
        total_tax: 0,
        total: Number(quoteAmount),
        amount_due: Number(quoteAmount),
        line_items: [
          {
            id: Math.random().toString(36).substring(7),
            name: "Repair Estimate",
            description: "Quoted repair amount",
            unit_price: Number(quoteAmount),
            quantity: 1,
            tax_rate: 0,
          },
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // 2. Add an internal note to the ticket
      await addDoc(collection(db, "crm_notes"), {
        ticket_id: ticketId,
        body: `Created informal estimate ${estNum} for $${Number(quoteAmount).toFixed(2)} and requested SMS approval.`,
        subject: "Estimate Requested",
        tech: auth.currentUser?.displayName || "Technician",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // 3. Send SMS
      await axios.post("/api/mobilemessage/send", {
        to: customerPhone,
        message: smsMessage,
        customerId: customerId,
        customerName: customerName,
        ticket_id: ticketId,
      });

      toast.success("Estimate recorded and approval request sent via SMS!");
      onSuccess("Waiting on Customer");
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || err.message || "Failed to send request.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center text-lg">
            <FileText className="w-5 h-5 mr-2 text-zinc-500" /> Request Estimate Approval
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          <div className="space-y-2">
            <Label htmlFor="quoteAmount" className="text-zinc-700 font-medium">
              Quote Amount ($)
            </Label>
            <Input
              id="quoteAmount"
              type="number"
              placeholder="e.g. 150.00"
              value={quoteAmount}
              onChange={(e) => setQuoteAmount(parseFloat(e.target.value) || "")}
              autoFocus
              className="text-lg"
            />
          </div>

          <div className="space-y-2 bg-zinc-50 p-4 border border-zinc-200 rounded-lg">
            <Label className="text-zinc-500 text-xs uppercase tracking-wider font-bold">
              SMS Preview
            </Label>
            <p className="text-sm text-zinc-800 leading-relaxed min-h-[60px]">
              {smsMessage || (
                <span className="text-zinc-400 italic">
                  Enter an amount to generate message...
                </span>
              )}
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              className="bg-zinc-900 text-white hover:bg-zinc-800"
              onClick={handleSubmit}
              disabled={isSubmitting || !quoteAmount}
            >
              <Send className="w-4 h-4 mr-2" />
              {isSubmitting ? "Sending..." : "Send Request & Update Status"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
