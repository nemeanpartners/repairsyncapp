import React from "react";
import { Sparkles, Loader2, Play, AlertCircle, ShieldAlert, BadgeDollarSign, Clock, Users, ArrowRight, ShieldCheck, CheckCircle2 } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { useAiTriage } from "../hooks/useAiTriage";

interface AiTriagePanelProps {
  deviceType: string;
  deviceModel: string;
  reportedIssue: string;
  onApplyTemplate?: (templateName: string) => void;
}

export function AiTriagePanel({ deviceType, deviceModel, reportedIssue, onApplyTemplate }: AiTriagePanelProps) {
  const { isTriaging, triageResult, runTriage, clearTriage } = useAiTriage();

  const handleTriageTrigger = () => {
    runTriage(reportedIssue, deviceType, deviceModel);
  };

  const getComplexityColor = (c: string) => {
    switch (c?.toLowerCase()) {
      case "low": return "text-emerald-600 bg-emerald-50 border-emerald-100";
      case "medium": return "text-amber-600 bg-amber-50 border-amber-100";
      case "high": return "text-rose-600 bg-rose-50 border-rose-100";
      case "board-level":
      case "board level": return "text-violet-600 bg-violet-50 border-violet-100";
      default: return "text-zinc-600 bg-zinc-50 border-zinc-200";
    }
  };

  const getRiskBadge = (r: string) => {
    switch (r?.toLowerCase()) {
      case "high":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-red-100 text-red-800 border border-red-200">
            <ShieldAlert className="w-3.5 h-3.5" /> HIGH RISK
          </span>
        );
      case "medium":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-orange-100 text-orange-800 border border-orange-200">
            <AlertCircle className="w-3.5 h-3.5" /> MEDIUM RISK
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
            <ShieldCheck className="w-3.5 h-3.5" /> SAFE / LOW RISK
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md">
      {/* Header */}
      <div className="px-5 py-4 border-b border-zinc-200 flex justify-between items-center bg-zinc-50/50">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-purple-50 rounded-xl border border-purple-100 text-purple-600">
            <Sparkles className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h4 className="text-sm font-black text-zinc-900 tracking-tight">AI Repair Triage Insights</h4>
            <p className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Predictive Diagnostics</p>
          </div>
        </div>
        {!triageResult && (
          <Button
            size="sm"
            onClick={handleTriageTrigger}
            disabled={isTriaging || !reportedIssue}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl h-8 text-xs shrink-0 px-4 flex items-center gap-1.5"
          >
            {isTriaging ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Triaging...
              </>
            ) : (
              <>
                <Play className="w-3 h-3" />
                Run AI Diagnosis
              </>
            )}
          </Button>
        )}
      </div>

      {/* Content */}
      <div className="p-5">
        {isTriaging && (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
            <Loader2 className="w-10 h-10 animate-spin text-purple-500 mb-2" />
            <div>
              <p className="text-sm font-black text-zinc-900">Consulting Repair Sync Core Models...</p>
              <p className="text-xs text-zinc-400 font-bold max-w-sm mt-1">
                Evaluating schematic libraries, part failures, and repair workloads specifically for {deviceModel || "this device"}...
              </p>
            </div>
          </div>
        )}

        {!isTriaging && !triageResult && (
          <div className="py-4 text-center">
            <p className="text-sm text-zinc-500 font-medium">Predict parts, risk rate, and assign workflows instantly with deep AI triage.</p>
            <p className="text-xs text-zinc-400 mt-1 max-w-md mx-auto">
              Our advanced triage system reads repair notes, maps historical success scores, and drafts targeted diagnostic steps for your bench team.
            </p>
          </div>
        )}

        {!isTriaging && triageResult && (
          <div className="space-y-6">
            {/* Top Row Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-zinc-50 border border-zinc-100 rounded-xl p-3 flex flex-col justify-between">
                <span className="text-xs font-medium text-zinc-400 uppercase tracking-wide block mb-1">Complexity</span>
                <span className={`inline-block px-2.5 py-1 text-xs font-black rounded-lg border-2 text-center w-max ${getComplexityColor(triageResult.complexity)}`}>
                  {triageResult.complexity}
                </span>
              </div>
              <div className="bg-zinc-50 border border-zinc-100 rounded-xl p-3 flex flex-col justify-between">
                <span className="text-xs font-medium text-zinc-400 uppercase tracking-wide block mb-1">Time Estimate</span>
                <span className="text-base font-black text-zinc-900 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-zinc-400" /> {triageResult.estimatedHours} hrs
                </span>
              </div>
              <div className="bg-zinc-50 border border-zinc-100 rounded-xl p-3 flex flex-col justify-between">
                <span className="text-xs font-medium text-zinc-400 uppercase tracking-wide block mb-1">Profitability</span>
                <span className="text-base font-black text-emerald-600 flex items-center gap-1.5">
                  <BadgeDollarSign className="w-5 h-5 text-emerald-500" /> {triageResult.estimatedProfitability}
                </span>
              </div>
              <div className="bg-zinc-50 border border-zinc-100 rounded-xl p-3 flex flex-col justify-between">
                <span className="text-xs font-medium text-zinc-400 uppercase tracking-wide block mb-1">Ideal Assignee</span>
                <span className="text-sm font-black text-blue-700 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-blue-400" /> {triageResult.recommendedAssignment}
                </span>
              </div>
            </div>

            {/* Risk Assessment */}
            <div className="bg-zinc-50 rounded-xl border border-zinc-200/60 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-black text-zinc-800 uppercase tracking-wide">Risk Assessment</p>
                {getRiskBadge(triageResult.repairRisk)}
              </div>
              <p className="text-xs text-zinc-600 leading-normal font-medium">{triageResult.riskExplanation}</p>
            </div>

            {/* Diagnostic / Fault Prediction */}
            <div>
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5 pl-1">Predicted Root Fault</p>
              <div className="bg-purple-50/50 border border-purple-100/50 rounded-xl p-4 font-bold text-sm text-purple-900">
                {triageResult.predictedFault}
              </div>
            </div>

            {/* Predicted Required Parts */}
            <div>
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 pl-1">Pre-Allocated Required Parts</p>
              <div className="flex flex-wrap gap-2">
                {triageResult.predictedParts?.map((part, idx) => (
                  <span key={idx} className="bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-zinc-800 flex items-center gap-1.5 cursor-default transition-all">
                    <CheckCircle2 className="w-3.5 h-3.5 text-zinc-400 shrink-0" /> {part}
                  </span>
                ))}
              </div>
            </div>

            {/* Suggested Workflow Template Hook */}
            {triageResult.suggestedWorkflowTemplate && onApplyTemplate && (
              <div className="pt-4 border-t border-zinc-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span className="text-xs font-medium text-zinc-600">
                    Workflow recommended: <strong className="text-zinc-800 font-bold">{triageResult.suggestedWorkflowTemplate}</strong>
                  </span>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => onApplyTemplate(triageResult.suggestedWorkflowTemplate)}
                  className="rounded-xl h-8 border-purple-200 text-purple-700 hover:bg-purple-50 font-bold text-xs"
                >
                  Apply Workflow Template <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </div>
            )}

            <div className="flex justify-end gap-2 text-xs">
              <button onClick={clearTriage} className="text-zinc-400 hover:text-zinc-600 transition-colors">Reset AI Diagnostics</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
