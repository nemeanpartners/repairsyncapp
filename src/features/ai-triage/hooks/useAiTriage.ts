import { useState } from "react";
import axios from "axios";
import { toast } from "sonner";

export interface TriageResult {
  predictedFault: string;
  complexity: string;
  estimatedHours: number;
  estimatedProfitability: string;
  predictedParts: string[];
  repairRisk: string;
  riskExplanation: string;
  recommendedAssignment: string;
  suggestedWorkflowTemplate: string;
}

export function useAiTriage() {
  const [isTriaging, setIsTriaging] = useState(false);
  const [triageResult, setTriageResult] = useState<TriageResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runTriage = async (description: string, deviceType: string, deviceModel: string) => {
    if (!description.trim()) {
      toast.error("Please provide a description of the fault.");
      return;
    }

    setIsTriaging(true);
    setError(null);
    try {
      const response = await axios.post("/api/ai/triage", {
        description,
        deviceType,
        deviceModel,
      });
      setTriageResult(response.data);
      toast.success("AI Triage complete! Insights loaded.");
    } catch (err: any) {
      console.error("Triage execution failed:", err);
      const msg = err.response?.data?.error || "Failed to complete AI Triage estimation.";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsTriaging(false);
    }
  };

  const clearTriage = () => {
    setTriageResult(null);
    setError(null);
  };

  return {
    isTriaging,
    triageResult,
    error,
    runTriage,
    clearTriage,
  };
}
