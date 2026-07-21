import React, { useState } from "react";
import { ShieldAlert, TrendingDown, RefreshCcw, Activity, AlertOctagon, HelpCircle, BarChart, Settings, Lightbulb, ChevronDown, ChevronUp } from "lucide-react";

interface RiskIntelligencePanelProps {
  ticket: any;
}

export function RiskIntelligencePanel({ ticket }: RiskIntelligencePanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(true);

  if (!ticket) return null;

  const getRiskMetrics = () => {
    const model = (ticket.device_model || "").toLowerCase();
    const brand = (ticket.brand || "").toLowerCase();
    const subject = (ticket.subject || "").toLowerCase();

    let disputeRisk = "Low";
    let profitabilityRisk = "Low";
    let repeatRepairRisk = "Low";
    let failureLikelihood = "Low";

    let reasons: string[] = [];

    // Liquid Damage analysis
    if (model.includes("liquid") || subject.includes("water") || subject.includes("liquid") || subject.includes("corrosion") || subject.includes("spill")) {
      disputeRisk = "High";
      profitabilityRisk = "High";
      repeatRepairRisk = "High";
      failureLikelihood = "High";
      reasons.push("Sub-surface liquid corrosion introduces erratic failures post-assembly.");
    } else if (model.includes("glass") || subject.includes("screen") || subject.includes("cracked") || subject.includes("shattered")) {
      disputeRisk = "Low";
      profitabilityRisk = "Low";
      repeatRepairRisk = "Low";
      failureLikelihood = "Low";
      reasons.push("Standard superficial display replacement. Highly predictable.");
    } else {
      disputeRisk = "Medium";
      profitabilityRisk = "Medium";
      reasons.push("Diagnostic parameters are generic. Potential for hidden IC thermal faults.");
    }

    if (ticket.priority === "Urgent") {
      disputeRisk = "High";
      reasons.push("Urgent rush contracts correlate heavily with strained client expectations.");
    }

    // Risk percentage indicator
    let totalRiskScore = 20;
    if (disputeRisk === "High") totalRiskScore += 30;
    else if (disputeRisk === "Medium") totalRiskScore += 15;

    if (profitabilityRisk === "High") totalRiskScore += 25;
    if (repeatRepairRisk === "High") totalRiskScore += 25;

    return {
      disputeRisk,
      profitabilityRisk,
      repeatRepairRisk,
      failureLikelihood,
      totalRiskScore,
      reasons
    };
  };

  const metrics = getRiskMetrics();

  const getProgressColor = (score: number) => {
    if (score > 70) return "bg-rose-500";
    if (score > 40) return "bg-orange-500";
    return "bg-emerald-500";
  };

  const getMetricBadgeClass = (level: string) => {
    switch (level) {
      case "High": return "bg-rose-50 text-rose-700 border-rose-100";
      case "Medium": return "bg-amber-50 text-amber-700 border-amber-100";
      default: return "bg-emerald-50 text-emerald-700 border-emerald-100";
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
          <div className="p-2 bg-rose-50 rounded-xl border border-rose-100 text-rose-600">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-black text-zinc-900 tracking-tight">Risk Scoring & Timeline Intelligence</h4>
            <p className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Predictive Depot Safety</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-2.5 py-1 text-xs font-black rounded-lg border flex items-center gap-1 ${getMetricBadgeClass(metrics.disputeRisk)}`}>
            <AlertOctagon className="w-3.5 h-3.5" /> Risk Index: {metrics.totalRiskScore}%
          </span>
          <div className="text-zinc-400 border-l border-zinc-200 pl-3">
            {isCollapsed ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
          </div>
        </div>
      </div>

      {!isCollapsed && (
        <>
          {/* Body Analytics Layout */}
          <div className="p-5 space-y-6">
            <div>
              <div className="flex justify-between text-xs font-black text-zinc-800 uppercase tracking-wider mb-2">
                <span>Overall Failure Probability</span>
                <span>{metrics.totalRiskScore}% Score</span>
              </div>
              <div className="w-full bg-zinc-100 rounded-full h-2.5 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${getProgressColor(metrics.totalRiskScore)}`} 
                  style={{ width: `${metrics.totalRiskScore}%` }} 
                />
              </div>
            </div>

        {/* Breakdown Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100 flex flex-col justify-between">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wide flex items-center gap-1">Dispute Risk</span>
            <span className={`w-max text-xs font-black px-2 py-0.5 rounded-md border mt-1.5 ${getMetricBadgeClass(metrics.disputeRisk)}`}>
              {metrics.disputeRisk}
            </span>
          </div>
          <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100 flex flex-col justify-between">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wide flex items-center gap-1">Profitability Loss</span>
            <span className={`w-max text-xs font-black px-2 py-0.5 rounded-md border mt-1.5 ${getMetricBadgeClass(metrics.profitabilityRisk)}`}>
              {metrics.profitabilityRisk}
            </span>
          </div>
          <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100 flex flex-col justify-between">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wide flex items-center gap-1">Repeat Repair</span>
            <span className={`w-max text-xs font-black px-2 py-0.5 rounded-md border mt-1.5 ${getMetricBadgeClass(metrics.repeatRepairRisk)}`}>
              {metrics.repeatRepairRisk}
            </span>
          </div>
          <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100 flex flex-col justify-between">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wide flex items-center gap-1">Diagnostics Gap</span>
            <span className={`w-max text-xs font-black px-2 py-0.5 rounded-md border mt-1.5 ${getMetricBadgeClass(metrics.failureLikelihood)}`}>
              {metrics.failureLikelihood}
            </span>
          </div>
        </div>

        {/* Highlight Insights */}
        {metrics.reasons.length > 0 && (
          <div className="bg-rose-50/50 border border-rose-100/50 rounded-xl p-4">
            <h5 className="text-xs font-bold text-rose-900 flex items-center gap-1 mb-2">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-500" /> Operational Red Flags Detected
            </h5>
            <ul className="text-xs font-medium text-rose-800 list-disc list-inside space-y-1">
              {metrics.reasons.map((reason, idx) => (
                <li key={idx}>{reason}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Timeline Intelligence Alerts */}
        <div className="space-y-3">
          <h5 className="text-xs font-black text-zinc-400 uppercase tracking-wider pl-1 flex items-center gap-1">
            <Activity className="w-3.5 h-3.5 text-zinc-400" /> Timeline Bottleneck Optimizer
          </h5>
          <div className="bg-purple-50/50 border border-purple-100/50 rounded-xl p-4 flex gap-3">
            <Lightbulb className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-black text-purple-950">Active Optimization Recommendation</p>
              <p className="text-xs font-medium text-purple-800 leading-normal mt-1">
                {metrics.totalRiskScore > 50 
                  ? "Solder diagnostics on liquid failures introduce severe timeline leakage. Swap assignment to Board Solder Tech and deploy the Ultrasonic Board cleaning workflow template immediately." 
                  : "Device diagnostics are completely compliant. Flow is pacing normally. Ensure ambient calibration tests are locked in post-assembly."}
              </p>
            </div>
          </div>
        </div>
      </div>
      </>
      )}
    </div>
  );
}
