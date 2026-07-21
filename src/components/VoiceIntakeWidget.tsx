import React, { useState } from "react";
import { Mic, MicOff, Loader2, PlayCircle, PlusCircle, Sparkles, Check, ChevronRight, X } from "lucide-react";
import { Button } from "./ui/button";
import axios from "axios";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export function VoiceIntakeWidget() {
  const [isRecording, setIsRecording] = useState(false);
  const [voiceText, setVoiceText] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [parsedIntake, setParsedIntake] = useState<{
    subject: string;
    deviceModel: string;
    repairCategory: string;
    issueSummary: string;
    customerNotes: string;
    priority: string;
  } | null>(null);

  const navigate = useNavigate();

  const presets = [
    "Samsung Fold 5 inner display black after drop, customer mentions leaving pattern code 4321.",
    "MacBook Pro 16 inch 2021 water damage. Spilled coffee on trackpad this morning has started cycling boot loops.",
    "iPhone 14 screen screen shattered after dropping from stairs, TrueTone is completely dead but cameras are working okay."
  ];

  const handleStartSimulating = () => {
    setIsRecording(true);
    setVoiceText("");
    setParsedIntake(null);
    let index = 0;
    const itemText = presets[Math.floor(Math.random() * presets.length)];
    
    // Simulate typewriter vocal intake
    const interval = setInterval(() => {
      if (index < itemText.length) {
        setVoiceText((prev) => prev + itemText.charAt(index));
        index++;
      } else {
        clearInterval(interval);
        setIsRecording(false);
      }
    }, 15);
  };

  const handleParseIntake = async () => {
    if (!voiceText.trim()) return;

    setIsParsing(true);
    try {
      const response = await axios.post("/api/ai/voice", { transcript: voiceText });
      setParsedIntake(response.data);
      toast.success("Vocal description compiled perfectly!");
    } catch (e: any) {
      console.error(e);
      toast.error("Vocal compiler failed to analyze message.");
    } finally {
      setIsParsing(false);
    }
  };

  const handleReset = () => {
    setParsedIntake(null);
    setVoiceText("");
    setIsRecording(false);
  };

  const handleApplyDraft = () => {
    if (!parsedIntake) return;
    // Redirect to New Ticket setup, carrying data in location state so NewTicketPage can pre-populate fields!
    navigate("/tickets/new", {
      state: {
        voiceIntakeData: parsedIntake
      }
    });
    toast.success("Voice draft pre-populated inside New Ticket setup.");
  };

  return (
    <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md">
      {/* Header */}
      <div className="px-5 py-4 border-b border-zinc-200 flex justify-between items-center bg-zinc-50/50">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-rose-50 text-rose-600 rounded-xl border border-rose-100">
            <Mic className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-black text-zinc-900 tracking-tight">Voice-to-Ticket Intake</h4>
            <p className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Verbally draft repairs instantly</p>
          </div>
        </div>
        {parsedIntake && (
          <button onClick={handleReset} className="text-zinc-400 hover:text-zinc-600">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Body */}
      <div className="p-5">
        {!parsedIntake ? (
          <div className="space-y-4">
            <div className="flex flex-row items-center gap-3">
              <Button
                onClick={handleStartSimulating}
                disabled={isRecording || isParsing}
                className={`flex-1 rounded-xl h-10 font-bold text-xs flex items-center justify-center gap-2 border shadow-sm transition-all ${
                  isRecording 
                    ? "bg-rose-50 border-rose-200 text-rose-600 animate-pulse" 
                    : "bg-zinc-900 border-zinc-950 hover:bg-zinc-800 text-white"
                }`}
              >
                {isRecording ? (
                  <>
                    <Mic className="w-4 h-4 animate-spin shrink-0" />
                    Transcribing speech...
                  </>
                ) : (
                  <>
                    <PlayCircle className="w-4 h-4 shrink-0" />
                    Simulate Vocal Dictation
                  </>
                )}
              </Button>
            </div>

            {/* Vocal wave indicator */}
            {isRecording && (
              <div className="flex justify-center items-center gap-1 h-3 py-1">
                <span className="w-1 h-2.5 bg-rose-500 rounded-full animate-bounce delay-75" />
                <span className="w-1 h-4 bg-rose-500 rounded-full animate-bounce" />
                <span className="w-1 h-1.5 bg-rose-500 rounded-full animate-bounce" />
                <span className="w-1 h-3.5 bg-rose-500 rounded-full animate-bounce" />
                <span className="w-1 h-2 bg-rose-500 rounded-full animate-bounce" />
              </div>
            )}

            <textarea
              value={voiceText}
              onChange={(e) => setVoiceText(e.target.value)}
              placeholder="Vocal intake transcript..."
              className="w-full bg-zinc-50 hover:bg-zinc-50/50 focus:bg-white text-zinc-900 border border-zinc-200 rounded-xl p-4 text-xs font-semibold outline-none h-20 resize-none transition-all"
            />

            {voiceText && !isRecording && (
              <div className="flex justify-end">
                <Button
                  onClick={handleParseIntake}
                  disabled={isParsing || !voiceText}
                  className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-8 px-4 font-bold text-xs flex items-center gap-1.5"
                >
                  {isParsing ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Parsing Audio...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      Evaluate & Form Ticket
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Parsed Intake Fields */}
            <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-xl space-y-4 shadow-inner">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wide block">Subject</span>
                  <p className="font-semibold text-xs text-zinc-800 leading-tight">{parsedIntake.subject}</p>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wide block">Device & Model</span>
                  <p className="font-semibold text-xs text-zinc-800 leading-tight">{parsedIntake.deviceModel}</p>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wide block">Category</span>
                  <p className="font-semibold text-xs text-zinc-800 leading-tight">{parsedIntake.repairCategory}</p>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wide block">Priority</span>
                  <p className="font-semibold text-xs text-zinc-800 leading-tight">{parsedIntake.priority}</p>
                </div>
              </div>
              <div className="border-t border-emerald-100 pt-2.5">
                <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wide block">Issue Checklist</span>
                <p className="text-xs text-zinc-600 font-medium leading-relaxed">{parsedIntake.issueSummary}</p>
              </div>
              {parsedIntake.customerNotes && (
                <div className="border-t border-emerald-100 pt-2.5">
                  <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wide block">Vocal Gasket Notes</span>
                  <p className="text-xs text-zinc-600 font-medium leading-relaxed">{parsedIntake.customerNotes}</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-1">
              <button onClick={handleReset} className="text-xs text-zinc-400 hover:text-zinc-600 font-bold uppercase tracking-wider">Cancel</button>
              <Button
                onClick={handleApplyDraft}
                className="bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl h-9 px-4 font-black text-xs flex items-center gap-1 shadow-md shadow-zinc-950/20"
              >
                Draft Unified Ticket <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
