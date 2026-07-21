import React, { useState, useEffect } from "react";
import { MessageSquare, Sparkles, Send, ShieldAlert, Cpu, HeartHandshake, Loader2, Calendar, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { CustomerIntelligenceService, PredictiveSmsDraft } from "../services/customerIntelligence";
import axios from "axios";
import { toast } from "sonner";

interface PredictiveSmsDraftsProps {
  ticket: any;
  customer: any;
  onSmsSent?: () => void;
}

export function PredictiveSmsDrafts({ ticket, customer, onSmsSent }: PredictiveSmsDraftsProps) {
  const [selectedDraft, setSelectedDraft] = useState<string>("");
  const [isSending, setIsSending] = useState(false);
  const [draftsList, setDraftsList] = useState<PredictiveSmsDraft[]>([]);
  const [isCollapsed, setIsCollapsed] = useState(true);

  const anxiety = CustomerIntelligenceService.estimateAnxietyLevel(ticket);
  const customerName = `${customer?.firstname || ""} ${customer?.lastname || ""}`.trim() || "Customer";

  // Build drafts dynamically inside the component depending on current ticket state
  useEffect(() => {
    const brand = ticket?.brand || "device";
    const model = ticket?.device_model || ticket?.vehicle_model || "";
    const subject = ticket?.subject || "fault description";
    const status = ticket?.status || "New";

    const localDrafts: PredictiveSmsDraft[] = [
      {
        type: "warm_up" as const,
        sentimentVibe: "Comforting & Proactive",
        draftText: `Hi ${customerName}, our bench team is now inspecting your ${brand} ${model} for "${subject}". Rest assured we are conducting a structural verification. We'll outline parts availability to you shortly.`,
        recommendedTime: "Post-intake (Immediate)",
        anxietyMitigationFactor: "Establishes immediate professional accountability."
      },
      {
        type: "delay_warning" as const,
        sentimentVibe: "Empathetic & Transparent",
        draftText: `Hi ${customerName}, small update regarding your ${brand} ${model}. Diagnostics require complex thermal monitoring to verify the components. We estimate having full reports complete in the next 3-4 hours. Thank you for your patience!`,
        recommendedTime: "4-6 hours post-workbench lock",
        anxietyMitigationFactor: "Neutralizes anxious status-checking calls before they happen."
      },
      {
        type: "approval_reminder" as const,
        sentimentVibe: "Action-Oriented",
        draftText: `Hi ${customerName}, our diagnostic review for your ${brand} ${model} is ready. We have drafted a detailed quote for your approval, ready to view on your Live Status Portal. Ready to initiate repairs immediately upon your confirmation.`,
        recommendedTime: "Quote Pending approval",
        anxietyMitigationFactor: "Accelerates pipeline approvals by up to 4x."
      },
      {
        type: "pickup_alert" as const,
        sentimentVibe: "Satisfying & Energetic",
        draftText: `Hi ${customerName}, success! Your ${brand} ${model} has undergone thorough standard validation and is fully restored and ready for collection. We are open until 5:30 PM today for checkout. See you soon!`,
        recommendedTime: "Stage set to Ready for Pickup",
        anxietyMitigationFactor: "Speeds up collection cycles and frees floor inventory."
      }
    ];

    setDraftsList(localDrafts);
    setSelectedDraft(localDrafts[0]?.draftText || "");
  }, [ticket, customer, customerName]);

  const handleSendDraft = async () => {
    if (!customer?.phone) {
      toast.error("Customer phone number is missing.");
      return;
    }
    if (!selectedDraft.trim()) {
      toast.error("Message body cannot be empty.");
      return;
    }

    setIsSending(true);
    try {
      await axios.post("/api/mobilemessage/send", {
        to: customer.phone,
        message: selectedDraft,
      });

      toast.success("Predictive update dispatched successfully!");
      if (onSmsSent) onSmsSent();
    } catch (err: any) {
      console.error("Failed to send predictive content:", err);
      toast.error("Failed to send text notification.");
    } finally {
      setIsSending(false);
    }
  };

  const getAnxietyMeterColor = (label: string) => {
    switch (label) {
      case "Critical": return "bg-rose-500";
      case "High": return "bg-orange-500";
      case "Medium": return "bg-amber-500";
      default: return "bg-emerald-500";
    }
  };

  const getAnxietyBg = (label: string) => {
    switch (label) {
      case "Critical": return "bg-rose-50 border-rose-100 text-rose-900";
      case "High": return "bg-orange-50 border-orange-100 text-orange-900";
      case "Medium": return "bg-amber-50 border-amber-100 text-amber-900";
      default: return "bg-emerald-50 border-emerald-100 text-emerald-900";
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden flex flex-col">
      {/* Header */}
      <div 
        className="p-5 flex items-center justify-between bg-zinc-50/50 cursor-pointer hover:bg-zinc-100/50 transition-colors border-b border-zinc-100"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-2 flex-1">
          <div className="p-2 bg-blue-50 rounded-xl border border-blue-100 text-blue-600">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-black text-zinc-900 tracking-tight">Predictive Communication</h4>
            <p className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Automated SMS Drafts</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-zinc-400">
            {isCollapsed ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
          </div>
        </div>
      </div>

      {!isCollapsed && (
        <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-zinc-200">
          {/* Risk Metrics */}
          <div className="p-5 md:w-[260px] lg:w-[280px] shrink-0 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-zinc-400 mb-4">
            <Cpu className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">Customer Intelligence</span>
          </div>

          <div className={`p-4 rounded-xl border ${getAnxietyBg(anxiety.label)} space-y-3`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide opacity-80">Anxiety Score</span>
              <span className="text-sm font-black">{anxiety.score}%</span>
            </div>
            {/* Slider */}
            <div className="w-full bg-zinc-200/50 rounded-full h-2 overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${getAnxietyMeterColor(anxiety.label)}`}
                style={{ width: `${anxiety.score}%` }}
              />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider">{anxiety.label} Priority</p>
              <p className="text-xs mt-1 leading-relaxed opacity-90">{anxiety.reason}</p>
            </div>
          </div>
        </div>

        <div className="mt-6 space-y-2">
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <HeartHandshake className="w-4 h-4 text-zinc-400" />
            <span>Optimal contact frequency</span>
          </div>
          <div className="p-2 bg-zinc-50 border border-zinc-100 rounded-lg text-xs font-medium text-zinc-500">
            Contact model recommends updates only once per active pipeline benchmark stage change to avert notification fatigue.
          </div>
        </div>
      </div>

      {/* Predictive Drafting Selector */}
      <div className="flex-1 p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg border border-blue-100">
              <Sparkles className="w-4 h-4 text-blue-500 animate-pulse" />
            </div>
            <div>
              <p className="text-sm font-black text-zinc-900 leading-tight">Proactive Communication drafts</p>
              <p className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Predictive templates generated over event timelines</p>
            </div>
          </div>
        </div>

        {/* Draft Options Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {draftsList.map((draft) => {
            const active = selectedDraft === draft.draftText;
            return (
              <button
                key={draft.type}
                onClick={() => setSelectedDraft(draft.draftText)}
                className={`text-left p-3 rounded-xl border text-xs flex flex-col justify-between h-24 transition-all duration-200 ${
                  active 
                    ? "bg-blue-50/50 border-blue-500 ring-2 ring-blue-500/10" 
                    : "bg-white border-zinc-200/60 hover:bg-zinc-50"
                }`}
              >
                <div>
                  <p className="font-bold text-zinc-900 capitalize">{draft.type.replace("_", " ")}</p>
                  <p className="text-[9px] text-zinc-400 font-bold uppercase mt-0.5 tracking-wide">{draft.sentimentVibe}</p>
                </div>
                <span className="text-[8px] font-semibold uppercase text-blue-600 tracking-tighter flex items-center gap-0.5 mt-2">
                  <Calendar className="w-2.5 h-2.5" /> Best fit: {draft.recommendedTime.substring(0, 15)}...
                </span>
              </button>
            );
          })}
        </div>

        {/* Large Editable Preview Container */}
        <div className="relative">
          <textarea
            value={selectedDraft}
            onChange={(e) => setSelectedDraft(e.target.value)}
            className="w-full bg-zinc-50 hover:bg-zinc-50/20 focus:bg-white border text-zinc-900 border-zinc-200 rounded-xl p-4 text-sm outline-none shadow-inner min-h-[120px] transition-all resize-none font-medium leading-relaxed"
            placeholder="Review generated message body..."
          />
          <span className="absolute bottom-2.5 right-3 text-[9px] font-semibold uppercase text-zinc-400 tracking-wider">
            {selectedDraft.length} characters
          </span>
        </div>

        {/* Actions bar */}
        <div className="flex flex-row items-center justify-between pt-3 border-t border-zinc-100">
          <div className="flex items-center gap-1 text-xs text-zinc-400 font-bold">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Sends direct SMS message to: <strong>{customer?.phone || "No Phone"}</strong></span>
          </div>

          <Button
            size="sm"
            onClick={handleSendDraft}
            disabled={isSending || !customer?.phone || !selectedDraft.trim()}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 rounded-xl h-9 text-xs flex items-center gap-1.5 shrink-0 shadow-sm shadow-blue-500/25"
          >
            {isSending ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Sending SMS...
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                Dispatch Instant SMS
              </>
            )}
          </Button>
        </div>
      </div>
      </div>
      )}
    </div>
  );
}
