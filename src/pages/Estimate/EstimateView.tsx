import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { EstimateApprovalView } from "../../components/EstimateApprovalView";

export function EstimateView() {
  const { estimateId } = useParams<{ estimateId: string }>();
  const navigate = useNavigate();

  if (!estimateId) return null;

  return (
    <div className="flex flex-col h-full w-full bg-zinc-50 relative">
      <EstimateApprovalView estimateId={estimateId} onBack={() => navigate(-1)} />
    </div>
  );
}
