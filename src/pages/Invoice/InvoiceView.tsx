import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { InvoiceViewer } from "../../components/InvoiceViewer";

export function InvoiceView() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const navigate = useNavigate();

  if (!invoiceId) {
    return <div className="p-8 text-center text-zinc-500">Invoice ID required</div>;
  }

  return (
    <div className="flex flex-col h-full w-full bg-zinc-50 relative">
      <InvoiceViewer invoiceId={invoiceId} onBack={() => navigate(-1)} />
    </div>
  );
}
