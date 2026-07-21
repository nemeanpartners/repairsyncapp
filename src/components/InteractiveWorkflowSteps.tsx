import React, { useState, useEffect } from "react";
import { CheckSquare, Square, Wrench, ShieldAlert, Sparkles, ChevronDown, ChevronUp, CheckCircle2 } from "lucide-react";
import { WorkflowTemplateEngine, WorkflowTemplate, WorkflowStep } from "../features/workflow-templates/services/workflowTemplates";
import { Button } from "./ui/button";
import { toast } from "sonner";

interface InteractiveWorkflowStepsProps {
  deviceModel: string;
  brand?: string;
  ticketId: string;
}

export function InteractiveWorkflowSteps({ deviceModel, brand, ticketId }: InteractiveWorkflowStepsProps) {
  const [template, setTemplate] = useState<WorkflowTemplate | null>(null);
  const [checkedSteps, setCheckedSteps] = useState<Record<string, boolean>>({});
  const [showSelector, setShowSelector] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true);

  // Load recommended template automatically depending on model
  useEffect(() => {
    const rec = WorkflowTemplateEngine.getTemplate(deviceModel, brand);
    setTemplate(rec);
    setCheckedSteps({});
  }, [deviceModel, brand]);

  const handleToggleStep = (stepId: string) => {
    setCheckedSteps((p) => {
      const next = { ...p, [stepId]: !p[stepId] };
      if (next[stepId]) {
        toast.success("Progress marked! Step finalized.");
      }
      return next;
    });
  };

  const handleApplyCustomTemplate = (tempId: "macbook_liquid" | "iphone_screen" | "smartphone_battery") => {
    const { WORKFLOW_TEMPLATES } = require("../features/workflow-templates/services/workflowTemplates");
    setTemplate(WORKFLOW_TEMPLATES[tempId]);
    setCheckedSteps({});
    setShowSelector(false);
    toast.success("Loaded custom operational templates!");
  };

  if (!template) return null;

  const totalSteps = template.steps.length;
  const completedSteps = Object.values(checkedSteps).filter(Boolean).length;
  const percentage = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  return (
    <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden divide-y divide-zinc-100">
      {/* Header */}
      <div 
        className="p-5 flex items-center justify-between bg-zinc-50/50 cursor-pointer hover:bg-zinc-100/50 transition-colors"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-2 flex-1">
          <div className="p-2 bg-blue-50 border border-blue-100 text-blue-600 rounded-xl">
            <Wrench className="w-4 h-4 animate-spin-slow" />
          </div>
          <div>
            <h4 className="text-sm font-black text-zinc-900 tracking-tight">Active Work Integration Protocol</h4>
            <p className="text-xs text-zinc-400 font-bold uppercase tracking-wider">
              Template: <span className="text-zinc-700 font-extrabold">{template.name}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg">
            {completedSteps}/{totalSteps} Steps ({percentage}%)
          </span>
          <button 
            onClick={(e) => { e.stopPropagation(); setShowSelector(!showSelector); }}
            className="p-1.5 hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 rounded-lg transition-colors"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
          <div className="text-zinc-400 border-l border-zinc-200 pl-3">
            {isCollapsed ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
          </div>
        </div>
      </div>

      {!isCollapsed && (
        <>
          {/* Select alternative template dropdown */}
          {showSelector && (
            <div className="p-4 bg-zinc-50 border-b border-zinc-100 flex flex-col sm:flex-row gap-2 justify-center items-center">
              <span className="text-xs uppercase font-semibold text-zinc-400 tracking-wide sm:mr-auto">Select alternative specs:</span>
              <Button size="sm" variant="outline" onClick={() => handleApplyCustomTemplate("macbook_liquid")} className="rounded-xl text-xs font-bold bg-white text-zinc-700">Liquid MacBook</Button>
              <Button size="sm" variant="outline" onClick={() => handleApplyCustomTemplate("iphone_screen")} className="rounded-xl text-xs font-bold bg-white text-zinc-700">TrueTone screen</Button>
              <Button size="sm" variant="outline" onClick={() => handleApplyCustomTemplate("smartphone_battery")} className="rounded-xl text-xs font-bold bg-white text-zinc-700">Standard Battery</Button>
            </div>
          )}

          {/* Steps List */}
          <div className="p-5 space-y-4">
        {/* Diagnostic Path guide */}
        <div className="p-3.5 bg-blue-50/40 border border-blue-100/60 rounded-xl flex gap-3 text-xs leading-relaxed text-blue-900 font-medium">
          <Sparkles className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
          <div>
            <strong className="text-blue-950 font-black">Predefined Diagnostic Path: </strong>
            {template.diagnosticPath}
          </div>
        </div>

        {/* Dynamic Checklist */}
        <div className="divide-y divide-zinc-100">
          {template.steps.map((step) => {
            const isChecked = !!checkedSteps[step.id];
            return (
              <div 
                key={step.id} 
                onClick={() => handleToggleStep(step.id)}
                className="py-3 flex items-start gap-3.5 cursor-pointer group transition-colors first:pt-0 last:pb-0"
              >
                <div className="pt-0.5">
                  {isChecked ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 transition-transform scale-110" />
                  ) : (
                    <div className="w-5 h-5 rounded-md border-2 border-zinc-300 group-hover:border-blue-500 flex items-center justify-center transition-colors font-bold text-white text-xs" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold transition-all ${isChecked ? "text-zinc-400 line-through" : "text-zinc-800"}`}>
                      {step.label}
                    </span>
                    {step.requiredApproval && (
                      <span className="text-[8px] font-semibold uppercase tracking-wide text-orange-600 bg-orange-50 border border-orange-100 px-1.5 py-0.5 rounded">
                        Requires QC Audit
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 font-medium leading-relaxed mt-0.5">{step.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
     </>
     )}
    </div>
  );
}
