import React, { useState, useRef, useMemo } from "react";
import axios from "axios";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { useTicketData, TICKET_PIPELINE } from "../../hooks/useTicketData";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ChevronLeft,
  Save,
  MessageSquare,
  Plus,
  X,
  Clock,
  FileText,
  Phone,
  Mail,
  User,
  AlertCircle,
  Wrench,
  Receipt,
  Paperclip,
  Activity,
  Send,
  DollarSign,
  Package,
  ChevronDown,
  ChevronUp,
  Edit,
  Printer,
  Search,
  Loader2,
  Trash2,
  CheckCircle2,
  Check,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { db, auth } from "../../firebase";
import {
  doc,
  updateDoc,
  addDoc,
  collection,
  serverTimestamp,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where,
} from "firebase/firestore";
import { ConversationThread } from "../Messages/ConversationThread";
import { ErrorBoundary } from "../../components/ErrorBoundary";
import { TicketWorkflowEngine } from "../../features/tickets/services/TicketWorkflowEngine";
import { TicketSLAEngine } from "../../features/tickets/services/TicketSLAEngine";
import { QCChecklist } from "../../features/tickets/components/QCChecklist";
import { PredictiveSmsDrafts } from "../../features/predictive-messaging/components/PredictiveSmsDrafts";
import { RiskIntelligencePanel } from "../../components/RiskIntelligencePanel";
import { InteractiveWorkflowSteps } from "../../components/InteractiveWorkflowSteps";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../../components/ui/dialog";
import { DebouncedInput } from "../../components/ui/debounced-input";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";  // ADDED
import { NewInvoiceModal } from "../../components/NewInvoiceModal";
import { NewEstimateModal } from "../../components/NewEstimateModal";
import { ApprovalRequestModal } from "./ApprovalRequestModal";
import { StartDiagnosisModal } from "./StartDiagnosisModal";
import { CompleteRepairModal } from "./CompleteRepairModal";
import { InlineTaskList } from "../../components/Tasks/InlineTaskList";
import { printLabel } from "../../lib/print-label";
import { SearchService } from "../../services/search/SearchService";
import { CollapsibleSection } from "@/components/CollapsibleSection";

import { useCatalogAndSuppliers } from "../../hooks/useCatalogAndSuppliers";

export function TicketDetails({
  ticketId,
  onBack,
}: {
  ticketId: string;
  onBack: () => void;
}) {
  const navigate = useNavigate();
  const { products, suppliers } = useCatalogAndSuppliers();
  const {
    ticket,
    customer,
    notes,
    lineItems,
    partsOrders,
    estimates,
    invoices,
    isLoading,
  } = useTicketData(ticketId);
  const orgDetails = {
    name: "Phone Medic",
    address_line_1: "123 Tech Lane",
    address_line_2: "Sydney, NSW 2000",
    abn: "12 345 678 901",
  };
  const [activeTab, setActiveTab] = useState("overview");
  const [internalNote, setInternalNote] = useState("");
  const [isSavingStatus, setIsSavingStatus] = useState(false);
  const [isSavingPriority, setIsSavingPriority] = useState(false);
  const [isSavingPartsStatus, setIsSavingPartsStatus] = useState(false);
  const [isSendingInvoice, setIsSendingInvoice] = useState(false);
  const [isSendingEstimate, setIsSendingEstimate] = useState(false);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [newLineItem, setNewLineItem] = useState({
    name: "",
    price: 0,
    quantity: 1,
  });
  const [isAddingCharge, setIsAddingCharge] = useState(false);
  const [isAddChargeModalOpen, setIsAddChargeModalOpen] = useState(false);
  const [newPartName, setNewPartName] = useState("");
  const [newPartSupplier, setNewPartSupplier] = useState("");
  const [partCatalogSearch, setPartCatalogSearch] = useState("");
  const [showPartCatalog, setShowPartCatalog] = useState(false);
  const [supplierSearch, setSupplierSearch] = useState("");
  const [showSupplierMenu, setShowSupplierMenu] = useState(false);
  const [newPartNotes, setNewPartNotes] = useState("");
  const [isAddingPart, setIsAddingPart] = useState(false);
  const [isAddPartModalOpen, setIsAddPartModalOpen] = useState(false);
  const [isNewInvoiceModalOpen, setIsNewInvoiceModalOpen] = useState(false);
  const [invoicePrefill, setInvoicePrefill] = useState<any>(null);
  const [isNewEstimateModalOpen, setIsNewEstimateModalOpen] = useState(false);
  const [isApprovalRequestModalOpen, setIsApprovalRequestModalOpen] = useState(false);
  const [isStartDiagnosisModalOpen, setIsStartDiagnosisModalOpen] = useState(false);
  const [isCompleteRepairModalOpen, setIsCompleteRepairModalOpen] = useState(false);
  const [isQCExpanded, setIsQCExpanded] = useState(false);
  const [isAttachmentsExpanded, setIsAttachmentsExpanded] = useState(false);
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagText, setNewTagText] = useState("");
  const [isChangeCustomerModalOpen, setIsChangeCustomerModalOpen] =
    useState(false);
  const [isEditCustomerModalOpen, setIsEditCustomerModalOpen] = useState(false);
  const [editCustomerData, setEditCustomerData] = useState<any>({});
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);
  
  const [isEditDeviceModalOpen, setIsEditDeviceModalOpen] = useState(false);
  const [editDeviceData, setEditDeviceData] = useState<any>({});
  const [isSavingDevice, setIsSavingDevice] = useState(false);

  const [customerSearchTerm, setCustomerSearchTerm] = useState("");
  const [customerSearchResults, setCustomerSearchResults] = useState<any[]>([]);
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
  const [quickSmsText, setQuickSmsText] = useState("");
  const [isSendingQuickSms, setIsSendingQuickSms] = useState(false);
  const [chatTemplates, setChatTemplates] = useState<
    { name: string; text: string }[]
  >([
    { name: "Greeting", text: "Hi {firstName}, how can I help you today?" },
    {
      name: "Quote Ready",
      text: "Hi {firstName}, the quote for repairing your {device} is ready for review. Please reply to this SMS if you have any questions, or approve it so we can start work.",
    },
    { name: "Repair Complete", text: "Your {device} is ready for pickup." },
    {
      name: "Job Complete",
      text: "Your repair (Job #{ticketNumber}) is complete and your {device} is ready for pickup.",
    },
    {
      name: "Investigating",
      text: "We're currently looking into the issue with your {device} and will update you shortly.",
    },
    { name: "Thank You", text: "Thank you for choosing Phone Medic!" },
    {
      name: "Google Review",
      text: "Hi {firstName}, thanks for choosing Phone Medic Milton! We'd really appreciate it if you could leave us a quick Google review here: https://tinyurl.com/2avrh2sx",
    },
  ]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingStage, setEditingStage] = useState<string | null>(null);
  const [stageNoteInput, setStageNoteInput] = useState("");

  const [expandedStageTask, setExpandedStageTask] = useState<string | null>(null);
  const [newChargeName, setNewChargeName] = useState("");
  const [newChargePrice, setNewChargePrice] = useState<number | "">("");
  const [isInitializingEstimate, setIsInitializingEstimate] = useState(false);
  const [isSendingStageSms, setIsSendingStageSms] = useState<Record<string, boolean>>({});
  const [stageSmsInputs, setStageSmsInputs] = useState<Record<string, string>>({});
  const [shortenedPortalLink, setShortenedPortalLink] = useState<string>(`${window.location.origin}/s/${ticketId}`);

  React.useEffect(() => {
    if (!ticketId) return;
    const longUrl = `${window.location.origin}/s/${ticketId}`;
    fetch(`/api/mobilemessage/shorten?url=${encodeURIComponent(longUrl)}`)
      .then(res => {
        if (res.ok) return res.json();
        throw new Error('Network response was not ok');
      })
      .then(data => {
        if (data && data.shortUrl && data.shortUrl.startsWith('http')) {
          setShortenedPortalLink(data.shortUrl.trim());
        }
      })
      .catch(err => {
        console.error('[Client Shortener] Failed to shorten portal link via proxy:', err);
      });
  }, [ticketId]);

  React.useEffect(() => {
    if (ticket?.status) {
      const currentStatus = ticket.status;
      const matchedStage = [
        { value: "New", equivalents: ["New", "Customer Reply"] },
        { value: "In Progress", equivalents: ["In Progress", "Approved", "Approved - Ready for Repair"] },
        { value: "Waiting on Customer", equivalents: ["Waiting on Customer", "RWA"] },
        { value: "Waiting for Parts", equivalents: ["Waiting for Parts", "Waiting on Parts"] },
        { value: "Repair in progress", equivalents: ["Repair in progress", "Repair in Progress"] },
        { value: "Ready for Pickup", equivalents: ["Ready for Pickup", "Ready For Pickup"] },
        { value: "Resolved", equivalents: ["Resolved", "Declined", "Escalated"] },
      ].find(s => s.equivalents.includes(currentStatus) || s.value === currentStatus);
      
      if (matchedStage) {
        setExpandedStageTask(matchedStage.value);
      }
    }
  }, [ticket?.status]);

  const handleSendStageSms = async (stageValue: string, messageText: string) => {
    if (!customer?.phone || !messageText.trim()) return;
    setIsSendingStageSms(prev => ({ ...prev, [stageValue]: true }));
    try {
      const cname = customer.firstname
        ? `${customer.firstname} ${customer.lastname || ""}`.trim()
        : customer.business_then_name || customer.fullname || undefined;
      
      await axios.post("/api/mobilemessage/send", {
        to: customer.phone,
        message: messageText.trim(),
        customerId: customer.id || null,
        customerName: cname,
        ticket_id: ticketId,
      });

      // Update message status on Firestore
      const ticketRef = doc(db, "crm_tickets", ticketId);
      await updateDoc(ticketRef, {
        [`stage_message_status.${stageValue}`]: "sent",
        updated_at: new Date().toISOString()
      });

      // Add note
      await addDoc(collection(db, "crm_notes"), {
        ticket_id: ticketId,
        body: `Workflow stage "${stageValue}" SMS sent to customer.\nContent: "${messageText.trim()}"`,
        subject: `SMS Notify - ${stageValue}`,
        tech: auth.currentUser?.displayName || "System Agent",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      toast.success(`SMS update for "${stageValue}" has been sent!`);
    } catch (e: any) {
      toast.error(e.response?.data?.error || e.message || "Failed to send SMS");
    } finally {
      setIsSendingStageSms(prev => ({ ...prev, [stageValue]: false }));
    }
  };

  const handleCreateDraftEstimate = async () => {
    if (!ticketId) return;
    setIsInitializingEstimate(true);
    try {
      const estNum = `EST-${Math.floor(100000 + Math.random() * 900000)}`;
      await addDoc(collection(db, "estimates"), {
        customer_id: ticket.customer_id || customer?.id || "",
        ticket_id: ticketId,
        estimate_number: estNum,
        status: "DRAFT",
        subtotal: 0,
        total_tax: 0,
        total: 0,
        amount_due: 0,
        line_items: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      toast.success(`Draft Estimate ${estNum} initialized successfully.`);
    } catch (err: any) {
      toast.error("Failed to initialize estimate: " + err.message);
    } finally {
      setIsInitializingEstimate(false);
    }
  };

  const handleAddEstimateItem = async (est: any) => {
    if (!newChargeName.trim() || !newChargePrice) {
      toast.error("Please enter a valid charge name and amount.");
      return;
    }
    try {
      const estimateItemId = Math.random().toString(36).substring(7);
      const updatedItems = [...(est.line_items || [])];
      updatedItems.push({
        id: estimateItemId,
        name: newChargeName.trim(),
        description: "Charge added via Workflow panel",
        unit_price: Number(newChargePrice),
        quantity: 1,
        tax_rate: 0,
      });

      const subtotal = updatedItems.reduce((acc, curr) => acc + (Number(curr.unit_price) * Number(curr.quantity || 1)), 0);
      const total = subtotal;

      await updateDoc(doc(db, "estimates", est.id), {
        line_items: updatedItems,
        subtotal,
        total,
        amount_due: total,
        updated_at: new Date().toISOString()
      });

      // Also add directly to crm_line_items so they appear in the top section and can be converted into invoices
      await addDoc(collection(db, "crm_line_items"), {
        ticket_id: ticketId,
        name: newChargeName.trim(),
        price: Number(newChargePrice),
        quantity: 1,
        created_at: serverTimestamp(),
        uid: auth.currentUser?.uid || "system",
        estimate_item_id: estimateItemId,
      });

      setNewChargeName("");
      setNewChargePrice("");
      toast.success("Charge successfully added!");
    } catch (e: any) {
      toast.error("Failed to append charge: " + e.message);
    }
  };

  const handleDeleteEstimateItem = async (est: any, indexToRemove: number) => {
    try {
      const itemToRemove = est.line_items?.[indexToRemove];
      const updatedItems = (est.line_items || []).filter((_: any, idx: number) => idx !== indexToRemove);
      const subtotal = updatedItems.reduce((acc, curr) => acc + (Number(curr.unit_price) * Number(curr.quantity || 1)), 0);
      const total = subtotal;

      await updateDoc(doc(db, "estimates", est.id), {
        line_items: updatedItems,
        subtotal,
        total,
        amount_due: total,
        updated_at: new Date().toISOString()
      });

      if (itemToRemove && itemToRemove.id) {
        // Query crm_line_items with estimate_item_id === itemToRemove.id and delete them
        const q = query(
          collection(db, "crm_line_items"),
          where("ticket_id", "==", ticketId),
          where("estimate_item_id", "==", itemToRemove.id)
        );
        const snap = await getDocs(q);
        for (const docSnap of snap.docs) {
          await deleteDoc(doc(db, "crm_line_items", docSnap.id));
        }
      }

      toast.success("Charge removed from builder.");
    } catch (e: any) {
      toast.error("Failed to remove charge: " + e.message);
    }
  };

  React.useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const snapshot = await getDocs(collection(db, "chat_templates"));
        const templates: { name: string; text: string }[] = [];
        snapshot.forEach((doc) => {
          if (doc.data().text) {
            templates.push({
              name: doc.data().name || doc.data().text.substring(0, 30) + "...",
              text: doc.data().text,
            });
          }
        });
        if (templates.length > 0) {
          setChatTemplates(templates);
        }
      } catch (e) {
        console.error("Failed to fetch chat templates", e);
      }
    };
    fetchTemplates();
  }, []);

  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: notes?.length || 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 120, // Estimate row height
    overscan: 5,
  });

  const handleApproveEstimate = async (estimateId: string) => {
    try {
      const estimate = estimates?.find((e: any) => e.id === estimateId);
      await updateDoc(doc(db, "estimates", estimateId), {
        status: "approved",
        updated_at: new Date().toISOString()
      });
      // Also add a note indicating the estimate was approved from the UI
      await addDoc(collection(db, "crm_notes"), {
        ticket_id: ticketId,
        body: `Estimate has been marked as approved. Automatically added estimate line items to the ticket.`,
        subject: "Estimate Approved",
        tech: auth.currentUser?.displayName || "System",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      
      // Auto-add charges (line items) to the ticket based on the estimate
      const existingItemsSnap = await getDocs(
        query(collection(db, "crm_line_items"), where("ticket_id", "==", ticketId))
      );
      const existingEstimateItemIds = new Set(
        existingItemsSnap.docs.map(doc => (doc.data() as any).estimate_item_id).filter(Boolean)
      );

      if (estimate && estimate.line_items && Array.isArray(estimate.line_items)) {
        for (const item of estimate.line_items) {
          if (item.id && existingEstimateItemIds.has(item.id)) {
            continue; // Already added as a charge!
          }
          await addDoc(collection(db, "crm_line_items"), {
            ticket_id: ticketId,
            name: item.name || item.description || "Estimate Charge",
            price: Number(item.unit_price || item.price || 0),
            quantity: Number(item.quantity || 1),
            created_at: serverTimestamp(),
            uid: auth.currentUser?.uid || "system",
            estimate_item_id: item.id || null,
          });
        }
      }

      toast.success("Estimate marked as approved. Charges added to ticket.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to approve estimate.");
    }
  };

  const handleEmailLatestEstimate = async (estimateId?: string) => {
    if (!customer?.email) {
      toast.error("Customer email is missing.");
      return;
    }

    if (!estimates || estimates.length === 0) {
      toast.error("No estimate to send.");
      return;
    }

    const latestEstimate = estimateId
      ? estimates.find((e) => e.id === estimateId)
      : [...estimates].sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        )[0];

    if (!latestEstimate) {
      toast.error("Estimate not found.");
      return;
    }

    setIsSendingEstimate(true);
    try {
      const doc = new jsPDF();

      // Document Settings
      doc.setFontSize(22);
      doc.setTextColor(33, 33, 33);
      doc.text("ESTIMATE", 14, 22);

      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`Estimate Number: ${latestEstimate.estimate_number}`, 14, 30);
      doc.text(
        `Date: ${latestEstimate.created_at ? format(new Date(latestEstimate.created_at), "dd MMM yyyy") : "N/A"}`,
        14,
        35,
      );

      // Organization Details (Top Right)
      const rightColX = 140;
      doc.setFontSize(12);
      doc.setTextColor(33, 33, 33);
      doc.setFont(undefined, "bold");
      doc.text(orgDetails.name || "Auto Repairs", rightColX, 22);
      doc.setFont(undefined, "normal");
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      if (orgDetails.address_line_1)
        doc.text(orgDetails.address_line_1, rightColX, 27);
      if (orgDetails.address_line_2)
        doc.text(orgDetails.address_line_2, rightColX, 32);
      if (orgDetails.abn) doc.text(`ABN: ${orgDetails.abn}`, rightColX, 37);

      // Customer Details
      doc.setFontSize(10);
      doc.setTextColor(150, 150, 150);
      doc.text("ESTIMATE FOR", 14, 55);

      doc.setFontSize(12);
      doc.setTextColor(33, 33, 33);
      doc.setFont(undefined, "bold");
      const customerName = customer
        ? customer.business_then_name ||
          customer.fullname ||
          `${customer.firstname || customer.first_name || ""} ${customer.lastname || customer.last_name || ""}`.trim() ||
          "Unknown Customer"
        : "Unknown Customer";
      doc.text(customerName, 14, 62);

      doc.setFont(undefined, "normal");
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      let customerY = 67;
      if (customer?.email) {
        doc.text(customer.email, 14, customerY);
        customerY += 5;
      }
      if (customer?.phone) {
        doc.text(customer.phone, 14, customerY);
        customerY += 5;
      }
      if (customer?.address) {
        doc.text(customer.address, 14, customerY);
        customerY += 5;
      }

      // Line Items Table
      const tableColumn = ["Description", "Qty", "Unit Price", "Total"];
      const tableRows: any[] = [];

      (latestEstimate.line_items || []).forEach((item: any) => {
        const itemData = [
          item.description || "Item",
          item.quantity?.toString() || "1",
          `$${Number(item.unit_amount || item.price || 0).toFixed(2)}`,
          `$${(Number(item.quantity || 1) * Number(item.unit_amount || item.price || 0)).toFixed(2)}`,
        ];
        tableRows.push(itemData);
      });

      autoTable(doc, {
        startY: customerY + 10,
        head: [tableColumn],
        body: tableRows,
        theme: "striped",
        styles: { fontSize: 10, cellPadding: 3 },
        headStyles: {
          fillColor: [40, 40, 40],
          textColor: [255, 255, 255],
          fontStyle: "bold",
        },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        columnStyles: {
          0: { cellWidth: 80 },
          1: { halign: "center" },
          2: { halign: "right" },
          3: { halign: "right" },
        },
      });

      // Totals
      const finalY = (doc as any).lastAutoTable.finalY + 10;
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text("Subtotal:", 140, finalY);
      doc.text(
        `$${Number(latestEstimate.subtotal || 0).toFixed(2)}`,
        180,
        finalY,
        { align: "right" },
      );

      const hasTax = latestEstimate.line_amount_types === "Exclusive";
      doc.text(`Tax${hasTax ? " (Exclusive)" : ""}:`, 140, finalY + 7);
      doc.text(
        `$${Number(latestEstimate.total_tax || 0).toFixed(2)}`,
        180,
        finalY + 7,
        { align: "right" },
      );

      doc.setFontSize(12);
      doc.setTextColor(33, 33, 33);
      doc.setFont(undefined, "bold");
      doc.text("Total:", 140, finalY + 17);
      doc.text(
        `$${Number(latestEstimate.total || 0).toFixed(2)}`,
        180,
        finalY + 17,
        { align: "right" },
      );

      const base64Data = doc.output("datauristring");
      const subject = `Estimate #${latestEstimate.estimate_number || "Receipt"} from ${orgDetails.name || "Phone Medic"}`;
      const content = `Hi ${customer?.firstname || customer?.fullname || ""},<br><br>Here is your estimate for your recent service request.<br><br>Please find the PDF copy attached to this email.<br><br>Kind regards,<br>${orgDetails.name || "Our Team"}`;

      const res = await axios.post("/api/zoho/send", {
        toAddress: customer.email,
        subject,
        content,
        attachmentBase64: base64Data,
        attachmentName: `Estimate_${latestEstimate.estimate_number || "Doc"}.pdf`,
      });

      toast.success("Estimate emailed successfully.");
    } catch (err: any) {
      console.error("Failed to send estimate email:", err);
      toast.error(
        err.response?.data?.error || err.message || "Failed to send email.",
      );
    } finally {
      setIsSendingEstimate(false);
    }
  };

  const handleEmailLatestInvoice = async () => {
    if (!customer?.email) {
      toast.error("Customer email is missing.");
      return;
    }

    if (!invoices || invoices.length === 0) {
      toast.error("No invoice to send.");
      return;
    }

    // get latest invoice
    const latestInvoice = [...invoices].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )[0];

    setIsSendingInvoice(true);
    try {
      const subject = `Invoice #${latestInvoice.invoice_number ? latestInvoice.invoice_number.replace(/\D/g, '') : "Receipt"} from Auto Repairs`;
      const content = `Hi ${customer?.firstname || customer?.fullname || ""},<br><br>Here is your invoice for your recent repair/purchase.<br><br>You can view it online here: <a href="${window.location.origin}/invoice/${latestInvoice.id}">${window.location.origin}/invoice/${latestInvoice.id}</a><br><br>Kind regards,<br>Our Team`;

      const res = await axios.post("/api/zoho/send", {
        toAddress: customer.email,
        subject,
        content,
      });

      toast.success("Email sent successfully.");
    } catch (err: any) {
      console.error("Failed to send email:", err);
      toast.error(
        err.response?.data?.error || err.message || "Failed to send email.",
      );
    } finally {
      setIsSendingInvoice(false);
    }
  };

  const handleTemplateSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const template = e.target.value;
    if (!template) return;

    let parsed = template;
    const fName =
      customer?.firstname || customer?.business_then_name || "Customer";
    const deviceStr =
      `${ticket?.brand || ""} ${ticket?.device_model || ""}`.trim() || "device";

    parsed = parsed.replace(/{firstName}/g, fName);
    parsed = parsed.replace(/{device}/g, deviceStr);
    parsed = parsed.replace(/{ticketNumber}/g, String(ticket?.number || ""));

    setQuickSmsText(parsed);
    e.target.value = ""; // reset dropdown
  };

  const handleSendQuickSms = async () => {
    if (!customer?.phone || !quickSmsText.trim()) return;
    setIsSendingQuickSms(true);
    try {
      const cname = customer.firstname
        ? `${customer.firstname} ${customer.lastname || ""}`.trim()
        : customer.business_then_name || customer.fullname || undefined;
      await axios.post("/api/mobilemessage/send", {
        to: customer.phone,
        message: quickSmsText.trim(),
        customerId: customer.id || null,
        customerName: cname,
        ticket_id: ticket?.id || ticket?.number || null,
      });
      toast.success("SMS Sent Successfully");
      setQuickSmsText("");
    } catch (e: any) {
      toast.error(e.response?.data?.error || e.message || "Failed to send SMS");
    } finally {
      setIsSendingQuickSms(false);
    }
  };

  // Auto-find color
  const statusColor =
    TICKET_PIPELINE.find((p) => p.value === ticket?.status)?.color ||
    "bg-zinc-500";

  const handleCustomerSearch = async (term: string) => {
    setCustomerSearchTerm(term);
    if (!term || term.length < 2) {
      setCustomerSearchResults([]);
      return;
    }
    setIsSearchingCustomer(true);
    try {
      const results = await SearchService.globalSearch(term, {
        limit: 10,
        viewName: "ChangeCustomer",
      });
      setCustomerSearchResults(results.contacts);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearchingCustomer(false);
    }
  };

  const handleSelectCustomer = async (selectedCustomer: any) => {
    try {
      await updateDoc(doc(db, "crm_tickets", ticketId), {
        customer_id: selectedCustomer.id,
        customer_name:
          `${selectedCustomer.firstName || selectedCustomer.firstname || ""} ${selectedCustomer.lastName || selectedCustomer.lastname || ""}`.trim() ||
          selectedCustomer.fullname ||
          "",
        updated_at: new Date().toISOString(),
      });
      setIsChangeCustomerModalOpen(false);
      setCustomerSearchTerm("");
      setCustomerSearchResults([]);
      toast.success("Customer updated successfully");
    } catch (err) {
      toast.error("Failed to update customer");
    }
  };

  const handleSaveCustomerDetails = async () => {
    if (!customer?.id) return;
    setIsSavingCustomer(true);
    try {
      await updateDoc(doc(db, "crm_customers", customer.id), {
        firstname: editCustomerData.firstname || "",
        lastname: editCustomerData.lastname || "",
        phone: editCustomerData.phone || "",
        email: editCustomerData.email || "",
        updated_at: new Date().toISOString(),
      });
      // also optionally update the ticket reference if needed
      await updateDoc(doc(db, "crm_tickets", ticketId), {
        customer_name:
          `${editCustomerData.firstname || ""} ${editCustomerData.lastname || ""}`.trim(),
        customer_firstname: editCustomerData.firstname || "",
        customer_lastname: editCustomerData.lastname || "",
        updated_at: new Date().toISOString(),
      });
      setIsEditCustomerModalOpen(false);
      toast.success("Customer details updated");
    } catch (err) {
      toast.error("Failed to update customer");
    } finally {
      setIsSavingCustomer(false);
    }
  };

  const handleSaveDeviceDetails = async () => {
    if (!ticketId) return;
    setIsSavingDevice(true);
    try {
      await updateDoc(doc(db, "crm_tickets", ticketId), {
        brand: editDeviceData.brand || "",
        device_model: editDeviceData.device_model || "",
        repair_category: editDeviceData.repair_category || "",
        subject: editDeviceData.subject || "",
        issue_description: editDeviceData.issue_description || "",
        updated_at: new Date().toISOString(),
      });
      setIsEditDeviceModalOpen(false);
      toast.success("Device details updated");
    } catch (err) {
      toast.error("Failed to update device details");
    } finally {
      setIsSavingDevice(false);
    }
  };

  const computedPartsStatus = useMemo(() => {
    if (!partsOrders || partsOrders.length === 0) return ticket?.parts_status || "None";
    
    const activeOrders = partsOrders.filter((o: any) => o.status !== "cancelled");
    if (activeOrders.length === 0) return ticket?.parts_status || "None";
    
    const needsOrdering = activeOrders.some((o: any) => o.status === "needs_ordering");
    if (needsOrdering) return "Needs Ordering";
    
    const allReceived = activeOrders.every((o: any) => o.status === "received");
    if (allReceived) return "Received";
    
    const someReceived = activeOrders.some((o: any) => o.status === "received");
    const someOrdered = activeOrders.some((o: any) => o.status === "ordered");
    if (someReceived && someOrdered) return "Partial";
    if (someOrdered) return "Ordered";
    
    return ticket?.parts_status || "None";
  }, [partsOrders, ticket?.parts_status]);

  if (isLoading) {
    return (
      <div className="p-8 flex justify-center items-center h-full">
        Loading ticket...
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="p-8 text-center text-zinc-500">Ticket not found.</div>
    );
  }

  const handleAddTag = async () => {
    if (!newTagText.trim() || !ticketId) return;
    
    const currentTags = Array.isArray(ticket.tag_list) ? ticket.tag_list : [];
    const newTags = [...currentTags, newTagText.trim()];
    
    try {
      await updateDoc(doc(db, "crm_tickets", ticketId), {
        tag_list: newTags,
        updated_at: new Date().toISOString()
      });
      setIsAddingTag(false);
      setNewTagText("");
    } catch (err) {
      console.error("Failed to add tag", err);
    }
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    if (!ticketId) return;
    
    const currentTags = Array.isArray(ticket.tag_list) ? ticket.tag_list : [];
    const newTags = currentTags.filter((t: string) => t !== tagToRemove);
    
    try {
      await updateDoc(doc(db, "crm_tickets", ticketId), {
        tag_list: newTags,
        updated_at: new Date().toISOString()
      });
    } catch (err) {
      console.error("Failed to remove tag", err);
    }
  };

  const handleStatusChange = async (
    e: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const newStatus = e.target.value;
    if (newStatus === ticket.status || isSavingStatus) return;

    setIsSavingStatus(true);
    try {
      await TicketWorkflowEngine.updateStatus(
        ticketId,
        newStatus,
        ticket.status,
        ticket.customer_id,
      );
    } catch (err) {
      console.error("Failed to update status", err);
    } finally {
      setIsSavingStatus(false);
    }
  };

  const handlePriorityChange = async (
    e: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const newPriority = e.target.value;
    if (newPriority === ticket.priority || isSavingPriority) return;

    setIsSavingPriority(true);
    try {
      const ticketRef = doc(db, "crm_tickets", ticketId!);
      await updateDoc(ticketRef, { 
        priority: newPriority,
        updated_at: new Date().toISOString()
      });
    } catch (err) {
      console.error("Failed to update priority", err);
    } finally {
      setIsSavingPriority(false);
    }
  };

  const handlePartsStatusChange = async (
    e: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const newPartsStatus = e.target.value;
    if (newPartsStatus === ticket.parts_status || isSavingPartsStatus) return;

    setIsSavingPartsStatus(true);
    try {
      const ticketRef = doc(db, "crm_tickets", ticketId!);
      await updateDoc(ticketRef, { 
        parts_status: newPartsStatus,
        updated_at: new Date().toISOString()
      });
    } catch (err) {
      console.error("Failed to update parts status", err);
    } finally {
      setIsSavingPartsStatus(false);
    }
  };

  const handleWorkflowAction = async (newStatus: string) => {
    if (newStatus === ticket.status || isSavingStatus) return;

    setIsSavingStatus(true);
    try {
      await TicketWorkflowEngine.updateStatus(
        ticketId,
        newStatus,
        ticket.status,
        ticket.customer_id,
      );
    } catch (err) {
      console.error("Failed to update status", err);
    } finally {
      setIsSavingStatus(false);
    }
  };

  const handleSaveStageNote = async (stageValue: string) => {
    if (!ticketId) return;
    try {
      const ticketRef = doc(db, "crm_tickets", ticketId);
      const currentNotes = ticket?.stage_notes || {};
      const updatedNotes = {
        ...currentNotes,
        [stageValue]: stageNoteInput
      };
      await updateDoc(ticketRef, {
        stage_notes: updatedNotes,
        updated_at: new Date().toISOString()
      });
      toast.success(`Stage note updated for "${stageValue}".`);
      setEditingStage(null);
    } catch (err: any) {
      console.error("Failed to save stage note", err);
      toast.error("Failed to save stage note: " + err.message);
    }
  };

  const handleDeleteTicket = async () => {
    if (
      !window.confirm(
        `Are you sure you want to delete ticket #${ticket?.number}? This action cannot be undone.`,
      )
    )
      return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, "crm_tickets", ticketId));
      toast.success("Ticket deleted successfully.");
      onBack();
    } catch (err) {
      console.error("Failed to delete ticket", err);
      toast.error("Failed to delete ticket.");
      setIsDeleting(false);
    }
  };

  const handleAddNote = async () => {
    if (!internalNote.trim() || isSavingNote) return;
    setIsSavingNote(true);
    try {
      await addDoc(collection(db, "crm_notes"), {
        ticket_id: ticketId,
        body: internalNote.trim(),
        subject: "Internal Note",
        tech: auth.currentUser?.displayName || "Technician",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      setInternalNote("");
    } catch (err) {
      console.error("Failed to add note", err);
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleAddLineItem = async () => {
    if (!newLineItem.name || isAddingCharge) return;
    setIsAddingCharge(true);
    try {
      await addDoc(collection(db, "crm_line_items"), {
        ticket_id: ticketId,
        name: newLineItem.name,
        price: Number(newLineItem.price),
        quantity: Number(newLineItem.quantity),
        created_at: serverTimestamp(),
        uid: auth.currentUser?.uid,
      });
      setNewLineItem({ name: "", price: 0, quantity: 1 });
      setIsAddChargeModalOpen(false);
    } catch (e) {
      console.error(e);
    } finally {
      setIsAddingCharge(false);
    }
  };

  const handleAddPart = async () => {
    if (!newPartName.trim() || isAddingPart) return;
    setIsAddingPart(true);
    try {
      await addDoc(collection(db, "parts_orders"), {
        partName: newPartName,
        description: newPartNotes,
        status: "needs_ordering",
        supplier: newPartSupplier,
        ticketId: ticketId,
        ticketNumber: ticket.number || ticket.id || ticketId,
        customerId: customer?.id || "",
        customerName:
          `${customer?.firstname || ""} ${customer?.lastname || ""}`.trim(),
        uid: auth.currentUser?.uid,
        createdAt: serverTimestamp(),
        orderDate: new Date().toISOString(),
      });
      
      // Auto-save to catalog if it's new
      if (newPartName && !products.some((p: any) => p?.description?.toLowerCase() === newPartName.toLowerCase())) {
         await addDoc(collection(db, "product_catalog"), {
           code: "PART-" + Math.random().toString(36).substring(2, 6).toUpperCase(),
           description: newPartName,
           price: 0,
           created_at: serverTimestamp()
         });
      }

      // Auto-save supplier if it's new
      if (newPartSupplier && !suppliers.some((s: any) => s?.toLowerCase() === newPartSupplier.toLowerCase())) {
         await addDoc(collection(db, "suppliers"), {
           name: newPartSupplier,
           created_at: serverTimestamp()
         });
      }
      
      const phone = customer?.phone || customer?.mobile;
      if (phone) {
         try {
           const { mobileMessage } = await import("../../lib/api");
           const msg = `Hi ${customer?.firstname || customer?.fullname || 'there'}, your part (${newPartName}) has been ordered for further testing. We will advise you once the part has arrived and been tested for delivery. - Phone Medic`;
           await mobileMessage.sendSms(phone, msg, ticketId, ticketId);
         } catch (smsErr) {
           console.error("Failed to send part order SMS", smsErr);
         }
      }

      setNewPartName("");
      setNewPartNotes("");
      setNewPartSupplier("");
      setIsAddPartModalOpen(false);
    } catch (e) {
      console.error(e);
    } finally {
      setIsAddingPart(false);
    }
  };

  return (
    <div className="flex flex-col min-h-max w-full bg-zinc-50/50">
      {/* FULL WIDTH TOP HEADER (DARK THEME) */}
      <div className="bg-[#1c1c1c] text-white p-4 md:px-6 md:py-6 shrink-0 flex flex-col gap-4">
        <div>
          <button
            onClick={onBack}
            className="text-zinc-300 hover:text-white flex items-center text-sm font-medium transition-colors"
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> Back
          </button>
        </div>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          {/* Left side: Ticket ID and Issue */}
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white">
                #{ticket.number}
              </h1>
              {estimates?.filter((e: any) => e.status === "approved").map((approved: any) => (
                <div key={approved.id} className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold px-3 py-1.5 rounded-md flex items-center text-sm shadow-sm gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  APPROVED: ${Number(approved.total || 0).toFixed(2)}
                </div>
              ))}
              <div className="relative flex items-center bg-blue-600 hover:bg-blue-500 rounded-md py-1.5 px-3 pr-8 transition-colors cursor-pointer border border-blue-500 shrink-0 shadow-sm">
                <span className="text-sm font-medium text-blue-200 mr-1.5 pointer-events-none">
                  Status:
                </span>
                <span className="text-sm font-bold text-white pointer-events-none whitespace-nowrap drop-shadow-sm">
                  {TICKET_PIPELINE.find((p) => p.value === ticket?.status)
                    ?.label || "New"}
                  {isSavingStatus && "..."}
                </span>
                <select
                  value={ticket?.status || "New"}
                  onChange={handleStatusChange}
                  disabled={isSavingStatus}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                >
                  {TICKET_PIPELINE.map((p) => (
                    <option
                      key={p.value}
                      value={p.value}
                      className="bg-zinc-800 text-white"
                    >
                      {p.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 opacity-70 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-white" />
              </div>
              <div className="relative flex items-center bg-transparent hover:bg-zinc-700 rounded-md py-1 px-3 pr-8 transition-colors cursor-pointer border border-zinc-700 shrink-0">
                <span className="text-sm font-medium text-zinc-400 mr-1.5 pointer-events-none">
                  Priority:
                </span>
                <span className="text-sm font-medium text-white pointer-events-none whitespace-nowrap">
                  {ticket?.priority || "Medium"}
                  {isSavingPriority && "..."}
                </span>
                <select
                  value={ticket?.priority || "Medium"}
                  onChange={handlePriorityChange}
                  disabled={isSavingPriority}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                >
                  {["Low", "Medium", "High", "Urgent"].map((p) => (
                    <option key={p} value={p} className="bg-zinc-800 text-white">
                      {p}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 opacity-70 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-white" />
              </div>
              
              <div className="relative flex items-center bg-transparent hover:bg-zinc-700 rounded-md py-1 px-3 pr-8 transition-colors cursor-pointer border border-zinc-700 shrink-0">
                <span className="text-sm font-medium text-zinc-400 mr-1.5 pointer-events-none">
                  Parts:
                </span>
                <span className="text-sm font-medium text-white pointer-events-none whitespace-nowrap">
                  {computedPartsStatus}
                  {isSavingPartsStatus && "..."}
                </span>
                <select
                  value={computedPartsStatus}
                  onChange={handlePartsStatusChange}
                  disabled={isSavingPartsStatus}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                >
                  {["None", "Needs Ordering", "Ordered", "In Transit", "Received", "Partial"].map((p) => (
                    <option key={p} value={p} className="bg-zinc-800 text-white">
                      {p}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 opacity-70 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-white" />
              </div>
              {(() => {
                const findProperty = (keywords: string[]) => {
                  if (!ticket.properties) return null;
                  for (const [key, val] of Object.entries(ticket.properties)) {
                    const keyLower = key.toLowerCase();
                    if (keywords.some((kw) => keyLower.includes(kw))) {
                      return { key, val };
                    }
                  }
                  return null;
                };

                const passcodeProp = findProperty([
                  "passcode",
                  "pin code",
                  "password",
                  "device pin",
                ]);
                const dockProp = findProperty(["dock", "bay", "shelf", "bin"]);

                return (
                  <div className="flex flex-wrap gap-2">
                    {passcodeProp?.val && (
                      <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono font-bold text-xs px-3 py-1 rounded-xl flex items-center gap-1.5 shadow-sm">
                        <span className="text-[9px] uppercase tracking-wider text-amber-500/80 font-bold">
                          {passcodeProp.key}:
                        </span>
                        <span className="text-white select-all">
                          {String(passcodeProp.val)}
                        </span>
                      </div>
                    )}
                    {dockProp?.val && (
                      <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-mono font-bold text-xs px-3 py-1 rounded-xl flex items-center gap-1.5 shadow-sm">
                        <span className="text-[9px] uppercase tracking-wider text-emerald-500/80 font-bold">
                          {dockProp.key}:
                        </span>
                        <span className="text-white select-all">
                          {String(dockProp.val)}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
            
            <div className="text-base font-medium flex items-center gap-2 flex-wrap text-zinc-300">
              <span className="text-white font-semibold">
                {ticket.brand || ticket.vehicle_make || "Unknown"} {ticket.device_model || ticket.vehicle_model || "Device"}
              </span>
              {(ticket.repair_category || ticket.problem_type) && (
                <>
                  <span className="text-zinc-600">•</span>
                  <span>{ticket.repair_category || ticket.problem_type}</span>
                </>
              )}
              {(ticket.issue_description || ticket.subject) && (
                <>
                  <span className="text-zinc-600">•</span>
                  <span>{ticket.issue_description || ticket.subject}</span>
                </>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-zinc-500 hover:text-white rounded-md ml-1"
                onClick={() => {
                  setEditDeviceData({ ...ticket });
                  setIsEditDeviceModalOpen(true);
                }}
              >
                <Edit className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* Right side: Button groups */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex bg-zinc-800 rounded-full border border-zinc-700 h-9 overflow-hidden px-1">
              <Button
                onClick={() => setIsAddChargeModalOpen(true)}
                variant="ghost"
                className="text-white hover:bg-zinc-700 rounded-full h-full px-3 text-sm font-medium"
              >
                Add/View Charges: $
                {lineItems
                  .reduce(
                    (acc, curr) =>
                      acc + Number(curr.price) * Number(curr.quantity || 1),
                    0,
                  )
                  .toFixed(2)}
              </Button>
            </div>

            <Button
              onClick={() => setIsAddPartModalOpen(true)}
              variant="outline"
              size="sm"
              className="h-9 px-4 text-sm font-medium bg-white text-zinc-900 border-zinc-200 hover:bg-zinc-100 rounded-full flex items-center shadow-sm"
            >
              <Plus className="w-4 h-4 mr-1.5 text-zinc-500" /> Parts
            </Button>
            <Button
              onClick={() => setIsNewEstimateModalOpen(true)}
              variant="outline"
              size="sm"
              className="h-9 px-4 text-sm font-medium bg-white text-zinc-900 border-zinc-200 hover:bg-zinc-100 rounded-full flex items-center shadow-sm"
            >
              <Plus className="w-4 h-4 mr-1.5 text-zinc-500" /> Estimate
            </Button>
            <Button
              onClick={() => setIsNewInvoiceModalOpen(true)}
              variant="outline"
              size="sm"
              className="h-9 px-4 text-sm font-medium bg-white text-zinc-900 border-zinc-200 hover:bg-zinc-100 rounded-full flex items-center shadow-sm"
            >
              <Plus className="w-4 h-4 mr-1.5 text-zinc-500" /> Invoice
            </Button>

            {invoices && invoices.length > 0 && (
              <div className="flex bg-zinc-800 rounded-full border border-zinc-700 h-9 overflow-hidden px-1 ml-1">
                <Button
                  onClick={handleEmailLatestInvoice}
                  disabled={isSendingInvoice}
                  variant="ghost"
                  className="text-white hover:bg-zinc-700 rounded-full h-full px-3 text-sm font-medium gap-1.5 flex items-center"
                >
                  <Mail className="w-4 h-4" />
                  {isSendingInvoice ? "Sending..." : "Email Invoice"}
                </Button>
              </div>
            )}

            <div className="flex bg-zinc-800 rounded-full border border-zinc-700 h-9 overflow-hidden ml-1">
              <Button
                onClick={() => printLabel(ticket, customer, 1)}
                variant="ghost"
                className="text-white hover:bg-zinc-700 rounded-none h-full px-3 text-sm font-medium gap-1.5 border-r border-zinc-700"
              >
                <Printer className="w-4 h-4" /> x1
              </Button>
              <Button
                onClick={() => printLabel(ticket, customer, 2)}
                variant="ghost"
                className="text-white hover:bg-zinc-700 rounded-none h-full px-3 text-sm font-medium gap-1.5 border-r border-zinc-700"
              >
                <Printer className="w-4 h-4" /> x2
              </Button>
              <Button
                onClick={handleDeleteTicket}
                disabled={isDeleting}
                variant="ghost"
                className="text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded-none h-full px-3 text-sm font-medium gap-1.5 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row flex-1 min-h-max">
        {/* LEFT PANEL: Context & Details */}
        <div className="w-full md:w-[320px] lg:w-[350px] border-r border-zinc-200 bg-white flex flex-col shrink-0 p-4 space-y-4">
          
          {/* Customer Summary Card */}
          <div className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-blue-700 bg-blue-600 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-4 h-4" /> Customer Profile
              </h3>
              <div className="flex items-center gap-1">
                {customer && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-zinc-400 hover:text-zinc-600 rounded-md"
                    onClick={() => {
                      setEditCustomerData({ ...customer });
                      setIsEditCustomerModalOpen(true);
                    }}
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-zinc-400 hover:text-zinc-600 rounded-md"
                  onClick={() => setIsChangeCustomerModalOpen(true)}
                >
                  <Search className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
            
            <div className="p-4 flex flex-col gap-4">
              {customer ? (
                <>
                  <div className="space-y-1">
                    <p
                      className="font-semibold text-zinc-900 text-base cursor-pointer hover:underline"
                      onClick={() => navigate(`/customers/${customer?.id || ticket?.customer_id}`)}
                    >
                      {`${customer.firstname || ""} ${customer.lastname || ""}`.trim() || customer.fullname || "Unknown Customer"}
                    </p>
                    {customer.phone && (
                      <p className="flex items-center gap-2 text-sm text-zinc-600">
                        <Phone className="w-3.5 h-3.5 text-zinc-400" /> {customer.phone}
                      </p>
                    )}
                    {customer.email && (
                      <p className="flex items-center gap-2 text-sm text-zinc-600 truncate opacity-80">
                        <Mail className="w-3.5 h-3.5 text-zinc-400" /> <span className="truncate">{customer.email}</span>
                      </p>
                    )}
                  </div>
                  
                  {/* Quick Comms Action Row inside Customer Card */}
                  <div className="grid grid-cols-2 gap-2 pt-3 border-t border-zinc-100">
                    <Button variant="outline" className="w-full text-xs h-8 text-zinc-600 bg-white">
                      <MessageSquare className="w-3 h-3 mr-1.5" /> SMS
                    </Button>
                    <Button variant="outline" className="w-full text-xs h-8 text-zinc-600 bg-white" onClick={() => window.location.href = `mailto:${customer.email}`}>
                      <Mail className="w-3 h-3 mr-1.5" /> Email
                    </Button>
                  </div>
                </>
              ) : (
                <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-4 text-center">
                  <p className="text-sm text-zinc-500">No customer attached</p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
              {/* Overview & Notes Card */}
              <div id="overview" className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
                <div className="px-5 py-4 border-b border-zinc-200 bg-zinc-50/50">
                  <h3 className="font-bold flex items-center text-sm text-zinc-800">
                    Overview & Notes
                  </h3>
                </div>
                <div className="p-5 space-y-6">
                  {/* Quick Internal Note Add */}
                  <div className="bg-zinc-50 border border-zinc-200 rounded-xl shadow-inner flex flex-col gap-3 p-3">
                    <textarea
                      placeholder="Click to add an internal note..."
                      className="w-full text-sm bg-transparent border-none outline-none resize-none min-h-20"
                      value={internalNote}
                      onChange={(e) => setInternalNote(e.target.value)}
                    />
                    <div className="flex justify-between items-center pt-2">
                       <Button
                        variant="ghost"
                        size="sm"
                        className="text-zinc-500 rounded-full h-8"
                      >
                        <Paperclip className="w-4 h-4 mr-1.5" /> Attach Photo
                      </Button>
                      <Button
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-5"
                        onClick={handleAddNote}
                        disabled={!internalNote.trim() || isSavingNote}
                      >
                        {isSavingNote ? "Adding..." : "Add Note"}
                      </Button>
                    </div>
                  </div>
                  
                  {/* Timeline Feed in a Collapsible Section */}
                  <div className="-mx-2">
                    <CollapsibleSection
                      title="Activity Timeline"
                      icon={Activity}
                      defaultExpanded={false}
                    >
                      <div
                        className="relative w-full"
                        style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
                      >
                        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                          const note = notes[virtualRow.index];
                          return (
                            <div
                              key={virtualRow.key}
                              data-index={virtualRow.index}
                              ref={rowVirtualizer.measureElement}
                              className="absolute top-0 left-0 w-full pb-4"
                              style={{
                                transform: `translateY(${virtualRow.start}px)`,
                              }}
                            >
                              <div className="relative pl-6">
                                <div className="absolute left-[11px] top-7 bottom-[-24px] w-px bg-zinc-200" />
                                <div className="absolute left-0 top-2 w-6 h-6 rounded-full bg-zinc-100 border-2 border-white flex items-center justify-center text-zinc-400 z-10 shadow-sm">
                                  <Activity className="w-3 h-3" />
                                </div>
                                <div className="bg-white border border-zinc-200/80 p-4 rounded-2xl shadow-sm text-sm">
                                  <div className="flex justify-between items-start mb-2">
                                    <span className="font-semibold text-zinc-900">
                                      {note.tech || "Technician"}
                                    </span>
                                    <span className="text-xs text-zinc-400 font-medium">
                                      {new Date(
                                        note.created_at,
                                      ).toLocaleString()}
                                    </span>
                                  </div>
                                  <p
                                    className="text-zinc-700"
                                    dangerouslySetInnerHTML={{
                                      __html: note.body?.replace(
                                        /\\n/g,
                                        "<br/>",
                                      ),
                                    }}
                                  ></p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {notes.length === 0 && (
                        <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-zinc-200 text-zinc-400 flex flex-col items-center">
                          <MessageSquare className="w-8 h-8 mb-3 opacity-20" />
                          <p className="text-sm font-medium">
                            No activity yet.
                          </p>
                        </div>
                      )}
                    </CollapsibleSection>
                  </div>
                </div>
              </div>

              {/* Communication Card */}
              <div id="communication" className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
                <div className="px-5 py-3 border-b border-blue-700 bg-blue-600 flex justify-between items-center">
                  <h3 className="font-bold flex items-center text-sm text-white">
                    Communication
                  </h3>
                </div>
                <div className="flex flex-col bg-zinc-50/30 h-[550px] max-h-[70vh]">
                  <ErrorBoundary>
                    <ConversationThread
                      conversation={{
                        id: customer?.id || "unknown",
                        customerId: customer?.id || "",
                        phone: customer?.phone || customer?.mobile || "",
                        customerName:
                          `${customer?.firstname || ""} ${customer?.lastname || ""}`.trim() || customer?.fullname || "Unknown Customer",
                        ticketNumber: ticket?.number,
                      }}
                    />
                  </ErrorBoundary>
                </div>
              </div>

              {/* Tasks Card */}
              <div id="tasks" className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
                <div className="px-5 py-4 border-b border-blue-700 bg-blue-600">
                  <h3 className="font-bold flex items-center text-sm text-white">
                    Linked Tasks
                  </h3>
                </div>
                <div className="p-5 h-[400px] flex flex-col">
                  <InlineTaskList linkedTicketId={ticketId} />
                </div>
              </div>

            </div>
        </div>

        {/* MAIN CONTENT AREA */}
        <div className="flex-1 flex flex-col bg-zinc-100/60">
          <div
            ref={parentRef}
            className="flex-none p-4 md:p-6 pb-24 md:pb-6"
          >
            <div className="max-w-4xl mx-auto h-full space-y-12">
              {/* Activity Summary */}
              <div className="bg-white border text-zinc-900 border-zinc-200 rounded-2xl shadow-sm overflow-hidden p-5 flex flex-col gap-4">
                <h3 className="text-sm font-bold text-zinc-800 whitespace-nowrap min-w-max">
                  Activity Summary
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-zinc-600">
                  <div className="flex flex-col gap-1 w-full bg-zinc-50 border border-zinc-100 p-3 rounded-xl min-w-0">
                    <span className="text-zinc-500 text-xs uppercase tracking-wider font-bold">Created</span>
                    <span className="font-medium text-zinc-900 truncate">
                      {new Date(ticket?.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 w-full bg-zinc-50 border border-zinc-100 p-3 rounded-xl min-w-0">
                    <span className="text-zinc-500 text-xs uppercase tracking-wider font-bold">Wait Time</span>
                    <span className="font-medium text-rose-600 truncate">
                      {ticket?.wait_time || "48h"}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 w-full bg-zinc-50 border border-zinc-100 p-3 rounded-xl min-w-0">
                    <span className="text-zinc-500 text-xs uppercase tracking-wider font-bold">Assignee</span>
                    <span className="font-medium text-zinc-900 truncate">
                      {auth.currentUser?.displayName || "Unassigned"}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 w-full bg-zinc-50 border border-zinc-100 p-3 rounded-xl min-w-0">
                    <span className="text-zinc-500 text-xs uppercase tracking-wider font-bold truncate">Service Level</span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge
                        variant="secondary"
                        className={`bg-zinc-100 hover:bg-zinc-200 border-none h-6 px-2 text-xs truncate max-w-full ${TicketSLAEngine.calculateSLA(ticket).color}`}
                      >
                        <Clock className="w-3 h-3 mr-1 flex-shrink-0" />
                        <span className="truncate">{TicketSLAEngine.calculateSLA(ticket).label}</span>
                      </Badge>
                      {ticket.priority === "High" && (
                        <Badge className="bg-red-100 text-red-700 hover:bg-red-200 border-none shadow-none h-6 px-2 text-xs flex-shrink-0">
                          High Priority
                        </Badge>
                      )}
                      {TicketSLAEngine.calculateSLA(ticket).isBreached && (
                        <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-200 border-none shadow-none h-6 px-2 text-xs flex-shrink-0">
                          Breached
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Workflow Actions & Tags */}
              <div className="bg-white border text-zinc-900 border-zinc-200 rounded-2xl shadow-sm overflow-hidden p-5 flex flex-col gap-5">
                <div>
                  <h3 className="text-sm font-bold text-zinc-800 mb-1">
                    Workflow Actions & Stage Notes
                  </h3>
                  <p className="text-xs text-zinc-500 mb-4 bg-zinc-50 border border-zinc-100 p-2.5 rounded-lg leading-relaxed">
                    Track the progress of this repair step-by-step. Technicians can update the current stage and document concise notes to easily communicate what has been done.
                  </p>

                  <div className="space-y-4 relative before:absolute before:left-5 before:top-2 before:bottom-2 before:w-[2px] before:bg-zinc-100">
                    {[
                      { 
                        value: "New", 
                        label: "1. Intake & Assessment", 
                        desc: "New repair registered, awaiting diagnosis or baseline checks.",
                        equivalents: ["New", "Customer Reply"],
                        icon: "Sparkles", 
                        color: "text-blue-500 bg-blue-50 border-blue-100",
                        checklist: [
                          "Verify device physical & cosmetic conditions.",
                          "Record serial number (IMEI/SN).",
                          "Set realistic repair timeline with customer."
                        ],
                        defaultSms: "Hi {customerName}, your {brand} {model} has been successfully checked in. Track state 24/7 here: {link}"
                      },
                      { 
                        value: "In Progress", 
                        label: "2. Diagnostics & Repair", 
                        desc: "Device opened, diagnostics run, and repairs active.",
                        equivalents: ["In Progress", "Approved", "Approved - Ready for Repair"],
                        icon: "Wrench", 
                        color: "text-amber-500 bg-amber-50 border-amber-100",
                        modalTrigger: () => setIsStartDiagnosisModalOpen(true),
                        checklist: [
                          "Run quality diagnostic tool checklist.",
                          "Inspect interior board for corrosion or physical impact.",
                          "Identify necessary replacement components."
                        ],
                        defaultSms: "Hi {customerName}, our technicians are now diagnosing your {brand} {model}. Follow updates online: {link}"
                      },
                      { 
                        value: "Waiting on Customer", 
                        label: "3. Quote Approval", 
                        desc: "Awaiting client authorization of quote or additional services.",
                        equivalents: ["Waiting on Customer", "RWA"],
                        icon: "AlertCircle", 
                        color: "text-purple-500 bg-purple-50 border-purple-100",
                        modalTrigger: () => setIsApprovalRequestModalOpen(true),
                        checklist: [
                          "Draft a clear, itemized repair estimate.",
                          "Generate client approval portal link.",
                          "Obtain customer confirmation."
                        ],
                        defaultSms: "Hi {customerName}, options & quote for your {brand} {model} are ready for approval. View & authorize charges online here: {link}"
                      },
                      { 
                        value: "Waiting for Parts", 
                        label: "4. Parts Sourcing", 
                        desc: "Waiting for ordering, receipt, or arrival of parts.",
                        equivalents: ["Waiting for Parts", "Waiting on Parts"],
                        icon: "Package", 
                        color: "text-rose-500 bg-rose-50 border-rose-100",
                        checklist: [
                          "Check inventory/catalog for components.",
                          "Place order with verified suppliers.",
                          "Log tracking number and ETA."
                        ],
                        defaultSms: "Hi {customerName}, repair parts for your {brand} are on order. We will resume your repair upon receipt. Details: {link}"
                      },
                      { 
                        value: "Repair in progress", 
                        label: "5. Repair in Progress", 
                        desc: "Parts received, and actual repairs/reassembly are currently in progress.",
                        equivalents: ["Repair in progress", "Repair in Progress"],
                        icon: "Wrench", 
                        color: "text-blue-600 bg-blue-50 border-blue-100",
                        checklist: [
                          "Install received replacement parts.",
                          "Perform intermediate diagnostic checks.",
                          "Prepare device for final reassembly."
                        ],
                        defaultSms: "Hi {customerName}, the parts for your {brand} {model} have been received, and repairs are now in progress. Track details: {link}"
                      },
                      { 
                        value: "Ready for Pickup", 
                        label: "6. QC Passed & Ready", 
                        desc: "All repair checks passed. Device packed, ready for handover.",
                        equivalents: ["Ready for Pickup", "Ready For Pickup"],
                        icon: "CheckCircle2", 
                        color: "text-emerald-500 bg-emerald-50 border-emerald-100",
                        modalTrigger: () => setIsCompleteRepairModalOpen(true),
                        checklist: [
                          "Run quality control matrix (10-point test).",
                          "Clean device with sanitizing micro-wipe.",
                          "Pack in protective pick-up envelope."
                        ],
                        defaultSms: "Hi {customerName}, great news! Repairs on your {brand} are finished and passed QC checks. Ready for collection. Track: {link}"
                      },
                      { 
                        value: "Resolved", 
                        label: "7. Handed Back", 
                        desc: "Device collected, invoice processed, and job closed.",
                        equivalents: ["Resolved", "Declined", "Escalated"],
                        icon: "Receipt", 
                        color: "text-zinc-500 bg-zinc-50 border-zinc-100",
                        checklist: [
                          "Take final handover signatures.",
                          "Provide receipt document copy.",
                          "Ask for feedback rating."
                        ],
                        defaultSms: "Hi {customerName}, thanks for trusting PhoneMedic for your repair! We hope your device works perfectly. Share feedback here: {reviewLink}"
                      }
                    ].map((stage, sIdx) => {
                      const currentStatus = ticket?.status || "New";
                      const isCurrentStageActive = stage.equivalents.includes(currentStatus) || (stage.value === currentStatus);
                      
                      const isCompleted = !isCurrentStageActive && (() => {
                        const currentGroupIdx = [
                          ["New", "Customer Reply"],
                          ["In Progress", "Approved", "Approved - Ready for Repair"],
                          ["Waiting on Customer", "RWA"],
                          ["Waiting for Parts", "Waiting on Parts"],
                          ["Repair in progress", "Repair in Progress"],
                          ["Ready for Pickup", "Ready For Pickup"],
                          ["Resolved", "Declined", "Escalated"]
                        ].findIndex(grp => grp.map(g => g.toLowerCase()).includes(currentStatus.toLowerCase()));
                        
                        return currentGroupIdx > sIdx;
                      })();

                      const stageNotes = ticket?.stage_notes || {};
                      const stageNoteText = stageNotes[stage.value] || "";
                      const isExpanded = expandedStageTask === stage.value;

                      return (
                        <div key={stage.value} className={`flex gap-4 items-start relative z-10 group/step ${isCompleted ? "opacity-75" : ""}`}>
                          {/* Left node indicator */}
                          <div className={`w-12 h-12 rounded-full border flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                            isCurrentStageActive 
                              ? "bg-zinc-900 border-zinc-900 text-white shadow-lg ring-4 ring-zinc-100 scale-105" 
                              : isCompleted 
                              ? "bg-emerald-600 border-emerald-600 text-white shadow-md" 
                              : "bg-white border-zinc-200 text-zinc-400 group-hover/step:border-zinc-300"
                          }`} onClick={() => setExpandedStageTask(isExpanded ? null : stage.value)}>
                            {isCompleted ? (
                              <CheckCircle2 className="w-7 h-7 text-white stroke-[3px]" />
                            ) : (
                              stage.icon === "Sparkles" ? <Sparkles className={`w-5 h-5 ${isCurrentStageActive ? "text-white" : "text-zinc-500"}`} /> :
                              stage.icon === "Wrench" ? <Wrench className={`w-5 h-5 ${isCurrentStageActive ? "text-white" : "text-zinc-500"}`} /> :
                              stage.icon === "AlertCircle" ? <AlertCircle className={`w-5 h-5 ${isCurrentStageActive ? "text-white" : "text-zinc-500"}`} /> :
                              stage.icon === "Package" ? <Package className={`w-5 h-5 ${isCurrentStageActive ? "text-white" : "text-zinc-500"}`} /> :
                              stage.icon === "CheckCircle2" ? <CheckCircle2 className={`w-5 h-5 ${isCurrentStageActive ? "text-white" : "text-zinc-500"}`} /> :
                              <Receipt className={`w-5 h-5 ${isCurrentStageActive ? "text-white" : "text-zinc-500"}`} />
                            )}
                          </div>

                          {/* Right content box */}
                          <div className={`flex-1 min-w-0 border rounded-2xl p-4 transition-all shadow-sm ${
                            isCurrentStageActive
                              ? "bg-zinc-50/70 border-zinc-950 ring-2 ring-zinc-950/10 shadow-md scale-[1.01]"
                              : isCompleted
                              ? "bg-zinc-50/40 border-zinc-200/50 opacity-80"
                              : "bg-white border-zinc-200/80 hover:shadow-md"
                          }`}>
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                              <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setExpandedStageTask(isExpanded ? null : stage.value)}>
                                <span className={`text-[13px] font-bold flex items-center gap-2 ${
                                  isCurrentStageActive ? "text-zinc-900 font-black text-sm" : isCompleted ? "text-zinc-400 line-through font-medium" : "text-zinc-700"
                                }`}>
                                  {stage.label}
                                  {isCurrentStageActive && (
                                    <span className="px-1.5 py-0.5 text-[9px] font-semibold uppercase bg-zinc-900 text-white rounded-md tracking-wider animate-pulse whitespace-nowrap">
                                      Active Stage
                                    </span>
                                  )}
                                  {isCompleted && (
                                    <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-md tracking-wide whitespace-nowrap">
                                      Done
                                    </span>
                                  )}
                                </span>
                                <p className={`text-xs font-medium leading-normal mt-0.5 ${
                                  isCurrentStageActive ? "text-zinc-600 font-semibold" : isCompleted ? "text-zinc-300" : "text-zinc-400"
                                }`}>{stage.desc}</p>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <Button
                                  variant="ghost"
                                  size="xs"
                                  onClick={() => setExpandedStageTask(isExpanded ? null : stage.value)}
                                  className="text-xs font-medium text-zinc-500 px-2 h-7 border border-zinc-200"
                                >
                                  {isExpanded ? "Hide Panel" : "View Panel"}
                                </Button>
                                {!isCurrentStageActive && (
                                  <Button
                                    variant="ghost"
                                    size="xs"
                                    disabled={isSavingStatus}
                                    onClick={() => {
                                      if (stage.modalTrigger) {
                                        stage.modalTrigger();
                                      } else {
                                        handleWorkflowAction(stage.value);
                                      }
                                    }}
                                    className="text-xs font-medium text-zinc-500 hover:text-zinc-950 hover:bg-zinc-100 px-2.5 py-1 rounded-lg h-7 border border-zinc-200/50 shrink-0"
                                  >
                                    Switch State
                                  </Button>
                                )}
                              </div>
                            </div>

                            {/* Collapsible / Pop-out Task Details Panel */}
                            {isExpanded && (
                              <div className="mt-4 text-xs bg-zinc-50 border border-zinc-200/80 p-4 rounded-xl space-y-5 shadow-sm">
                                {/* Informational Checklist */}
                                <div className="space-y-1.5">
                                  <p className="font-bold text-zinc-700 uppercase text-[9px] tracking-wider flex items-center gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-zinc-500" />
                                    Expected Process Checklist
                                  </p>
                                  <ul className="text-zinc-500 space-y-1 pl-1 font-medium text-xs">
                                    {stage.checklist.map((item, idx) => (
                                      <li key={idx} className="flex gap-1.5 items-start">
                                        <span className="text-zinc-400 mt-0.5">•</span>
                                        <span>{item}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>

                                {/* Step 1: Notes & Work Carried Out */}
                                <div className="space-y-2 border-t border-zinc-200/60 pt-3">
                                  <p className="font-bold text-zinc-700 uppercase text-[9px] tracking-wider flex items-center gap-1">
                                    📝 {sIdx + 1}.1 Notes & Work Carried Out
                                  </p>
                                  {editingStage === stage.value ? (
                                    <div className="space-y-2 bg-white border border-zinc-200 p-2.5 rounded-xl shadow-sm">
                                      <textarea
                                        value={stageNoteInput}
                                        onChange={(e) => setStageNoteInput(e.target.value)}
                                        className="w-full text-xs p-2 bg-transparent border-none rounded-lg min-h-[64px] focus:outline-none focus:ring-0 font-sans leading-normal"
                                        placeholder="Detail what work has been carried out and what diagnosis was found..."
                                      />
                                      <div className="flex justify-end gap-1.5 border-t border-zinc-100 pt-2">
                                        <Button
                                          size="xs"
                                          variant="ghost"
                                          onClick={() => setEditingStage(null)}
                                          className="text-xs h-7 px-2.5 text-zinc-500 hover:bg-zinc-100"
                                        >
                                          Cancel
                                        </Button>
                                        <Button
                                          size="xs"
                                          onClick={() => handleSaveStageNote(stage.value)}
                                          className="text-xs h-7 px-3 bg-zinc-950 text-white hover:bg-zinc-900 border-none"
                                        >
                                          Save Note
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="bg-white border border-zinc-200 p-3 rounded-xl shadow-sm">
                                      {stageNoteText ? (
                                        <div className="flex flex-col gap-2">
                                          <p className="leading-relaxed whitespace-pre-wrap text-zinc-700 font-medium">{stageNoteText}</p>
                                          <div className="flex justify-end pt-1 border-t border-zinc-100">
                                            <button
                                              onClick={() => {
                                                setEditingStage(stage.value);
                                                setStageNoteInput(stageNoteText);
                                              }}
                                              className="text-xs text-blue-600 hover:text-blue-700 font-bold transition-all"
                                            >
                                              Edit Note
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        <button
                                          onClick={() => {
                                            setEditingStage(stage.value);
                                            setStageNoteInput("");
                                          }}
                                          className="text-[11px] text-zinc-400 hover:text-zinc-600 flex items-center gap-1 font-bold transition-all py-1"
                                        >
                                          <Plus className="w-3.5 h-3.5 text-zinc-400" /> Add work details...
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>

                                {/* Custom Estimate builder (Waiting on Customer Stage only) */}
                                {stage.value === "Waiting on Customer" && (
                                   <div className="space-y-3 border-t border-zinc-200/60 pt-3">
                                      <p className="font-bold text-zinc-700 uppercase text-[9px] tracking-wider">
                                         💰 Estimate Items & Charges
                                      </p>
                                      
                                      {(!estimates || estimates.length === 0) ? (
                                         <div className="text-center bg-white p-3 rounded-xl border border-zinc-200 shadow-sm">
                                            <p className="text-zinc-500 italic mb-2">No active estimate for this ticket.</p>
                                            <Button
                                               size="xs"
                                               disabled={isInitializingEstimate}
                                               onClick={handleCreateDraftEstimate}
                                               className="bg-purple-600 text-white font-bold text-xs hover:bg-purple-700 border-none"
                                            >
                                               {isInitializingEstimate ? "Creating..." : "Initialize Repair Estimate"}
                                            </Button>
                                         </div>
                                      ) : (() => {
                                         const activeEst = [...estimates].sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())[0];
                                         return (
                                            <div className="space-y-2 bg-white/70 p-3 rounded-xl border border-zinc-200 shadow-sm">
                                               <div className="flex justify-between items-center text-xs font-medium text-zinc-400 uppercase tracking-wide pb-1.5 border-b border-zinc-100">
                                                  <span className="flex items-center gap-1.5">
                                                    {activeEst.estimate_number}
                                                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-black tracking-wider ${
                                                      (activeEst.status || '').toLowerCase() === 'approved' ? 'bg-emerald-100 text-emerald-800' :
                                                      (activeEst.status || '').toLowerCase() === 'declined' ? 'bg-rose-100 text-rose-800' :
                                                      (activeEst.status || '').toLowerCase() === 'draft' ? 'bg-zinc-200 text-zinc-700' :
                                                      'bg-amber-100 text-amber-800'
                                                    }`}>
                                                      {activeEst.status || 'Pending'}
                                                    </span>
                                                  </span>
                                                  <span className="font-mono">Total: ${Number(activeEst.total || 0).toFixed(2)}</span>
                                               </div>

                                               <div className="space-y-1.5">
                                                  {(!activeEst.line_items || activeEst.line_items.length === 0) ? (
                                                     <p className="text-xs text-zinc-400 italic">No charges added yet.</p>
                                                  ) : (
                                                     activeEst.line_items?.map((item: any, itIdx: number) => (
                                                        <div key={item.id || itIdx} className="flex justify-between items-center text-xs bg-white border border-zinc-200/60 p-2 rounded-lg">
                                                           <div className="min-w-0 flex-1">
                                                              <span className="font-semibold text-zinc-800">{item.name}</span>
                                                           </div>
                                                           <div className="flex items-center gap-3">
                                                              <span className="font-mono text-zinc-900 font-bold">${Number(item.unit_price).toFixed(2)}</span>
                                                              <button
                                                                 onClick={() => handleDeleteEstimateItem(activeEst, itIdx)}
                                                                 className="text-rose-600 hover:text-rose-700 font-bold text-xs transition-colors"
                                                              >
                                                                 Delete
                                                              </button>
                                                           </div>
                                                        </div>
                                                     ))
                                                  )}
                                               </div>

                                               <div className="pt-2 border-t border-zinc-100 flex flex-col sm:flex-row gap-1.5">
                                                  <input
                                                     type="text"
                                                     placeholder="Charge Name (e.g. Screen replacement)"
                                                     value={newChargeName}
                                                     onChange={(e) => setNewChargeName(e.target.value)}
                                                     className="text-[11px] p-2 bg-white border border-zinc-200 focus:outline-none focus:border-zinc-400 rounded-lg flex-1 font-semibold shadow-sm"
                                                  />
                                                  <input
                                                     type="text"
                                                     placeholder="Price ($)"
                                                     value={newChargePrice}
                                                     onChange={(e) => {
                                                        const val = e.target.value;
                                                        if (val === "" || !isNaN(Number(val))) {
                                                           setNewChargePrice(val === "" ? "" : Number(val));
                                                        }
                                                     }}
                                                     className="text-[11px] p-2 bg-white border border-zinc-200 focus:outline-none focus:border-zinc-400 rounded-lg w-20 font-mono font-semibold shadow-sm"
                                                  />
                                                  <Button
                                                     size="xs"
                                                     onClick={() => handleAddEstimateItem(activeEst)}
                                                     className="bg-purple-600 text-white font-extrabold text-xs h-8 px-3 border-none hover:bg-purple-700 shadow-sm"
                                                  >
                                                     Add Charge
                                                  </Button>
                                               </div>
                                            </div>
                                         );
                                      })()}
                                   </div>
                                )}

                                {/* Step 2: Main task completion trigger actions block */}
                                <div className="space-y-2 border-t border-zinc-200/60 pt-3">
                                  <p className="font-bold text-zinc-700 uppercase text-[9px] tracking-wider">
                                     ✅ {sIdx + 1}.2 Complete Stage Task
                                  </p>
                                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white border border-zinc-200 p-3 rounded-xl shadow-sm">
                                     <div className="flex-1">
                                       <p className="font-bold text-zinc-800 text-[11px]">Advance Ticket Progress</p>
                                       <p className="text-xs text-zinc-400">Advance this ticket to the next logical stage state immediately.</p>
                                     </div>
                                     <Button
                                       size="xs"
                                       disabled={isSavingStatus}
                                       onClick={() => {
                                         let nextStageValue = "";
                                         if (stage.value === "New") nextStageValue = "In Progress";
                                         else if (stage.value === "In Progress") nextStageValue = "Waiting on Customer";
                                         else if (stage.value === "Waiting on Customer") nextStageValue = "Waiting for Parts";
                                         else if (stage.value === "Waiting for Parts") nextStageValue = "Repair in progress";
                                         else if (stage.value === "Repair in progress") nextStageValue = "Ready for Pickup";
                                         else if (stage.value === "Ready for Pickup") nextStageValue = "Resolved";
                                         else nextStageValue = "Permanently Closed";

                                         if (nextStageValue === "In Progress") {
                                           setIsStartDiagnosisModalOpen(true);
                                         } else if (nextStageValue === "Waiting on Customer") {
                                           setIsApprovalRequestModalOpen(true);
                                         } else if (nextStageValue === "Ready for Pickup") {
                                           setIsCompleteRepairModalOpen(true);
                                         } else {
                                           handleWorkflowAction(nextStageValue);
                                         }
                                       }}
                                       className="bg-emerald-600 font-extrabold border-none hover:bg-emerald-700 text-white text-xs h-8 px-4 flex items-center gap-1 shadow-sm w-full sm:w-auto shrink-0"
                                     >
                                       <Check className="w-3.5 h-3.5" />
                                       {stage.value === "New" ? "Intake Finished -> Begin Repair" :
                                        stage.value === "In Progress" ? "Diagnostics Complete, Next step - create quote" :
                                        stage.value === "Waiting on Customer" ? "Manually Authorize & Order Parts" :
                                        stage.value === "Waiting for Parts" ? "Parts Received -> Start Repair" :
                                         stage.value === "Repair in progress" ? "Repairs Finished -> Run QC Check" :
                                        stage.value === "Ready for Pickup" ? "Mark Picked up & paid" :
                                        "Archive & Close Ticket"}
                                     </Button>
                                  </div>
                                </div>
                              </div>
                            )}

                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t border-zinc-100 pt-4 flex flex-col md:flex-row items-start md:items-center gap-4">
                  <h3 className="text-sm font-bold text-zinc-800 whitespace-nowrap min-w-max">
                    Tags
                  </h3>
                  <div className="flex-1 w-full flex flex-wrap items-center gap-2">
                    {Array.isArray(ticket.tag_list) && ticket.tag_list.map((tag: string, i: number) => (
                      <Badge
                        key={i}
                        variant="secondary"
                        className="bg-orange-100 text-orange-800 hover:bg-orange-200 border-none flex items-center pr-1.5"
                      >
                        {tag}
                        <button
                          className="ml-1 text-orange-600 hover:bg-orange-200/50 rounded-full p-0.5"
                          onClick={() => handleRemoveTag(tag)}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                    {isAddingTag ? (
                      <div className="flex items-center">
                        <input
                          type="text"
                          value={newTagText}
                          onChange={(e) => setNewTagText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddTag();
                            if (e.key === 'Escape') setIsAddingTag(false);
                          }}
                          placeholder="Type and press enter"
                          className="text-xs bg-zinc-50 border border-zinc-200 rounded px-2 py-1 outline-none focus:border-zinc-400 w-32"
                          autoFocus
                          onBlur={handleAddTag}
                        />
                      </div>
                    ) : (
                      <button
                        onClick={() => setIsAddingTag(true)}
                        className="text-xs font-medium text-zinc-500 hover:text-zinc-800 flex items-center bg-zinc-50 hover:bg-zinc-100 border border-dashed border-zinc-300 rounded px-2 py-1"
                      >
                        <Plus className="w-3 h-3 mr-1" /> Add tag
                      </button>
                    )}
                  </div>
                </div>
              </div>



              {/* Financial Card */}
              <div id="financial" className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
                <div className="px-5 py-4 border-b border-zinc-200 bg-zinc-50/50 flex flex-wrap gap-3 justify-between items-center">
                  <h3 className="font-bold flex items-center text-sm text-zinc-800">
                    Financial Records
                  </h3>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsAddChargeModalOpen(true)}
                      className="h-8 text-xs bg-white text-zinc-700 hover:text-zinc-900"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" /> Charge
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsNewEstimateModalOpen(true)}
                      className="h-8 text-xs bg-white text-zinc-700 hover:text-zinc-900"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" /> Estimate
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsNewInvoiceModalOpen(true)}
                      className="h-8 text-xs bg-white text-zinc-700 hover:text-zinc-900"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" /> Invoice
                    </Button>
                  </div>
                </div>
                <div className="flex flex-col bg-white">
                  <div className="divide-y divide-zinc-100/80">
                    {/* Charges */}
                    {lineItems.map((item) => (
                      <div
                        key={item.id}
                        className="px-5 py-3 flex flex-wrap justify-between items-center gap-3 hover:bg-zinc-50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-500 flex flex-shrink-0 items-center justify-center">
                            <DollarSign className="w-4 h-4" />
                          </div>
                          <div className="flex flex-col">
                            <span className="font-medium text-sm text-zinc-900 line-clamp-1">
                              {item.name}
                            </span>
                            <span className="text-[11px] text-zinc-500">
                              Charge • Qty: {item.quantity || 1}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="font-semibold text-sm text-zinc-900">
                            ${Number(item.price * (item.quantity || 1)).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}

                    {/* Estimates */}
                    {estimates && estimates.map((estimate) => (
                      <div
                        key={estimate.id}
                        onClick={() => navigate(`/app/estimate/${estimate.id}`)}
                        className="px-5 py-3 flex flex-wrap justify-between items-center gap-3 hover:bg-zinc-50 transition-colors cursor-pointer group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-100 text-blue-600 flex flex-shrink-0 items-center justify-center group-hover:bg-blue-100 transition-colors">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="flex flex-col">
                            <span className="font-medium text-sm text-zinc-900 group-hover:text-blue-700 transition-colors">
                              {estimate.estimate_number || "Estimate"}
                            </span>
                            <span className="text-[11px] text-zinc-500 flex items-center gap-1.5">
                              Estimate <span className="w-1 h-1 rounded-full bg-zinc-300"></span> {estimate.status}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="font-semibold text-sm text-zinc-900">
                            ${Number(estimate.total || 0).toFixed(2)}
                          </span>
                          <div className="hidden sm:flex items-center gap-2">
                            {(estimate.status === "DRAFT" || estimate.status === "PENDING" || estimate.status === "draft" || estimate.status === "pending") && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 hover:text-emerald-800 pointer-events-auto"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleApproveEstimate(estimate.id);
                                }}
                              >
                                Mark Approved
                              </Button>
                            )}
                            {estimate.status !== "INVOICED" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs bg-white pointer-events-auto"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setInvoicePrefill(estimate.line_items || []);
                                  setIsNewInvoiceModalOpen(true);
                                }}
                              >
                                Invoice It
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 pointer-events-auto"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEmailLatestEstimate(estimate.id);
                              }}
                              disabled={isSendingEstimate}
                            >
                              <Mail className="w-3.5 h-3.5 text-zinc-500" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Invoices */}
                    {invoices && invoices.map((inv) => (
                      <div
                        key={inv.id}
                        onClick={() => navigate(`/invoice/${inv.id}`)}
                        className="px-5 py-3 flex flex-wrap justify-between items-center gap-3 hover:bg-zinc-50 transition-colors cursor-pointer group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-600 flex flex-shrink-0 items-center justify-center group-hover:bg-emerald-100 transition-colors">
                            <Receipt className="w-4 h-4" />
                          </div>
                          <div className="flex flex-col">
                            <span className="font-medium text-sm text-zinc-900 group-hover:text-emerald-700 transition-colors">
                              {inv.invoice_number ? inv.invoice_number.replace(/\D/g, '') : "Invoice"}
                            </span>
                            <span className="text-[11px] text-zinc-500 flex items-center gap-1.5">
                              Invoice <span className="w-1 h-1 rounded-full bg-zinc-300"></span> {inv.status}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="font-semibold text-sm text-zinc-900">
                            ${Number(inv.total || inv.amount_due || 0).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}

                    {(!lineItems || lineItems.length === 0) && (!estimates || estimates.length === 0) && (!invoices || invoices.length === 0) && (
                      <div className="px-5 py-8 text-center">
                        <p className="text-sm text-zinc-500 italic">No financial records yet.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Parts Orders wrapper */}
              </div>

              {/* Parts Orders Card */}
              <div id="parts" className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
                <div className="px-5 py-4 border-b border-zinc-200 bg-zinc-50/50 flex justify-between items-center">
                  <h3 className="font-bold flex items-center text-sm text-zinc-800">
                    <Package className="w-4 h-4 mr-2 text-zinc-500" /> Parts Required
                  </h3>
                </div>
                <div className="p-5 bg-white space-y-4">
                      {partsOrders.length > 0 ? (
                        <div className="divide-y divide-zinc-100 border border-zinc-100 rounded-xl overflow-hidden">
                          {partsOrders.map((part) => (
                            <div
                              key={part.id}
                              className="p-3 flex justify-between items-center text-sm hover:bg-zinc-50"
                            >
                              <div className="flex flex-col">
                                <span className="font-medium text-zinc-900">
                                  {part.partName}
                                </span>
                                {part.description && (
                                  <span className="text-xs text-zinc-500">
                                    {part.description}
                                  </span>
                                )}
                                {part.supplier && (
                                  <span className="text-xs uppercase font-bold text-zinc-400 mt-1">
                                    {part.supplier}
                                  </span>
                                )}
                              </div>
                              <Badge
                                variant="outline"
                                className="text-xs bg-white text-zinc-600 shadow-sm"
                              >
                                {part.status}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-zinc-500 italic">
                          No parts ordered for this ticket.
                        </p>
                      )}

                    </div>
                  </div>

              {/* Attachments Card */}
              <div id="attachments" className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
                <div 
                  className="px-5 py-4 border-b border-zinc-200 bg-zinc-50/50 flex justify-between items-center cursor-pointer hover:bg-zinc-100 transition-colors"
                  onClick={() => setIsAttachmentsExpanded(!isAttachmentsExpanded)}
                >
                  <h3 className="font-bold flex items-center text-sm text-zinc-800">
                    Attachments
                  </h3>
                  <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform ${isAttachmentsExpanded ? 'rotate-180' : ''}`} />
                </div>
                {isAttachmentsExpanded && (
                  <div className="p-5">
                    <div className="bg-zinc-50 border border-dashed border-zinc-300 rounded-xl h-64 flex items-center justify-center text-zinc-400 flex-col hover:bg-zinc-100 transition-colors cursor-pointer">
                      <Paperclip className="w-10 h-10 mb-3 opacity-20" />
                      <p className="font-medium text-sm">
                        Drag and drop files and images here.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Quality Control Card */}
              <div id="quality-control" className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
                <div 
                  className="px-5 py-4 border-b border-zinc-200 bg-zinc-50/50 flex justify-between items-center cursor-pointer hover:bg-zinc-100 transition-colors"
                  onClick={() => setIsQCExpanded(!isQCExpanded)}
                >
                  <h3 className="font-bold flex items-center text-sm text-zinc-800">
                    Quality Control & Intelligence
                  </h3>
                  <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform ${isQCExpanded ? 'rotate-180' : ''}`} />
                </div>
                {isQCExpanded && (
                  <div className="p-5 space-y-6 bg-zinc-50/30">
                    <QCChecklist
                      ticketId={ticketId}
                      category={
                        ticket.repair_category ||
                        ticket.device_model ||
                        "smartphone"
                      }
                    />

                    <InteractiveWorkflowSteps
                      ticketId={ticketId}
                      deviceModel={ticket.device_model || ticket.brand || ""}
                      brand={ticket.brand || ""}
                    />
                    
                    <RiskIntelligencePanel ticket={ticket} />
                    <PredictiveSmsDrafts ticket={ticket} customer={customer} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Bottom Action Bar */}
        <div className="fixed bottom-0 left-0 right-0 p-3 bg-white border-t border-zinc-200 z-50 md:hidden flex items-center justify-between gap-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-4px_10px_rgba(0,0,0,0.02)]">
          <div className="relative group flex-1 max-w-[180px]">
            <div
              className={`absolute left-3 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full pointer-events-none ${statusColor}`}
            ></div>
            <select
              value={ticket?.status || "New"}
              onChange={handleStatusChange}
              disabled={isSavingStatus}
              className={` w-full bg-zinc-50 border border-zinc-200 text-zinc-900 hover:bg-zinc-100 font-bold text-sm pl-8 pr-8 py-2 rounded-xl outline-none focus:ring-0 focus:border-zinc-300 transition-all cursor-pointer truncate h-10`}
              style={{ WebkitAppearance: "none", MozAppearance: "none" }}
            >
              {TICKET_PIPELINE.map((p) => (
                <option key={p.value} value={p.value} className="font-medium">
                  {p.label}
                </option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              size="icon"
              variant="outline"
              className="w-10 h-10 rounded-xl border-zinc-200 text-zinc-600 bg-white shrink-0 shadow-sm"
              onClick={() => setIsNewInvoiceModalOpen(true)}
            >
              <FileText className="w-4 h-4" />
            </Button>
            <Button
              size="icon"
              className="w-10 h-10 rounded-xl bg-zinc-900 text-white shrink-0 shadow-sm hover:bg-black transition-colors"
              onClick={() => {
                const qcElement = document.getElementById("quality-control");
                if (qcElement) {
                  qcElement.scrollIntoView({ behavior: "smooth" });
                }
              }}
            >
              <Save className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <NewInvoiceModal
        isOpen={isNewInvoiceModalOpen}
        onClose={() => {
          setIsNewInvoiceModalOpen(false);
          setInvoicePrefill(null);
        }}
        prefillCustomerId={ticket?.customer_id}
        prefillCustomer={customer}
        prefillTicketId={ticketId}
        prefillLineItems={
          invoicePrefill ||
          lineItems.map((item: any) => ({
            description: item.name || "",
            quantity: Number(item.quantity) || 1,
            unit_amount: Number(item.price) || 0,
          }))
        }
      />

      <NewEstimateModal
        isOpen={isNewEstimateModalOpen}
        onClose={() => setIsNewEstimateModalOpen(false)}
        prefillCustomerId={ticket?.customer_id}
        prefillCustomer={customer}
        prefillTicketId={ticketId}
      />

      <ApprovalRequestModal
        isOpen={isApprovalRequestModalOpen}
        onClose={() => setIsApprovalRequestModalOpen(false)}
        ticketId={ticketId}
        ticketNumber={ticket?.number?.toString() || ""}
        customerId={ticket?.customer_id || ""}
        customerName={customer ? `${customer.firstname || ""} ${customer.lastname || ""}`.trim() : ""}
        customerPhone={customer?.phone || customer?.mobile || ""}
        onSuccess={(status) => handleWorkflowAction(status)}
      />

      <StartDiagnosisModal
        isOpen={isStartDiagnosisModalOpen}
        onClose={() => setIsStartDiagnosisModalOpen(false)}
        ticketId={ticketId}
        ticketNumber={ticket?.number?.toString() || ""}
        customerId={ticket?.customer_id || ""}
        customerName={customer ? `${customer.firstname || ""} ${customer.lastname || ""}`.trim() : ""}
        customerPhone={customer?.phone || customer?.mobile || ""}
        onSuccess={(status) => handleWorkflowAction(status)}
      />

      <CompleteRepairModal
        isOpen={isCompleteRepairModalOpen}
        onClose={() => setIsCompleteRepairModalOpen(false)}
        ticketId={ticketId}
        ticketNumber={ticket?.number?.toString() || ""}
        customerId={ticket?.customer_id || ""}
        customerName={customer ? `${customer.firstname || ""} ${customer.lastname || ""}`.trim() : ""}
        customerPhone={customer?.phone || customer?.mobile || ""}
        onSuccess={(status) => handleWorkflowAction(status)}
      />

      <Dialog
        open={isChangeCustomerModalOpen}
        onOpenChange={setIsChangeCustomerModalOpen}
      >
        <DialogContent className="max-w-md sm:max-w-lg bg-zinc-900 border border-zinc-800 text-white rounded-2xl">
          <DialogHeader>
            <DialogTitle>Change Customer</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Search for an existing customer to reassign this ticket to.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <DebouncedInput
                value={customerSearchTerm}
                onChange={handleCustomerSearch}
                placeholder="Search customers..."
                className="pl-10 bg-zinc-800 border-zinc-700 h-12 w-full rounded-xl text-white outline-none"
              />
              {isSearchingCustomer && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 animate-spin" />
              )}
            </div>

            <div className="max-h-64 overflow-y-auto space-y-2">
              {customerSearchResults.map((cust) => (
                <div
                  key={cust.id}
                  onClick={() => handleSelectCustomer(cust)}
                  className="flex items-center justify-between p-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 cursor-pointer border border-zinc-700 transition-colors"
                >
                  <div className="flex flex-col">
                    <span className="font-bold text-sm text-white">
                      {cust.firstName || cust.firstname}{" "}
                      {cust.lastName || cust.lastname}
                    </span>
                    <span className="text-xs text-zinc-400 font-mono mt-0.5">
                      {cust.phone || cust.mobile}
                    </span>
                  </div>
                  <User className="w-4 h-4 text-zinc-500" />
                </div>
              ))}
              {customerSearchTerm.length > 1 &&
                !isSearchingCustomer &&
                customerSearchResults.length === 0 && (
                  <div className="text-center py-6 text-zinc-500 text-sm">
                    No match found
                  </div>
                )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isEditCustomerModalOpen}
        onOpenChange={setIsEditCustomerModalOpen}
      >
        <DialogContent className="max-w-md bg-zinc-900 border border-zinc-800 text-white rounded-2xl">
          <DialogHeader>
            <DialogTitle>Edit Customer</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Update the customer details. This changes their profile
              everywhere.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wide pl-1">
                  First Name
                </label>
                <Input
                  value={editCustomerData.firstname || ""}
                  onChange={(e) =>
                    setEditCustomerData({
                      ...editCustomerData,
                      firstname: e.target.value,
                    })
                  }
                  className="bg-zinc-800 border-zinc-700 h-11"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wide pl-1">
                  Last Name
                </label>
                <Input
                  value={editCustomerData.lastname || ""}
                  onChange={(e) =>
                    setEditCustomerData({
                      ...editCustomerData,
                      lastname: e.target.value,
                    })
                  }
                  className="bg-zinc-800 border-zinc-700 h-11"
                />
              </div>
              <div className="col-span-2 space-y-2">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wide pl-1">
                  Phone
                </label>
                <Input
                  value={editCustomerData.phone || ""}
                  onChange={(e) =>
                    setEditCustomerData({
                      ...editCustomerData,
                      phone: e.target.value,
                    })
                  }
                  className="bg-zinc-800 border-zinc-700 h-11"
                  type="tel"
                />
              </div>
              <div className="col-span-2 space-y-2">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wide pl-1">
                  Email
                </label>
                <Input
                  value={editCustomerData.email || ""}
                  onChange={(e) =>
                    setEditCustomerData({
                      ...editCustomerData,
                      email: e.target.value,
                    })
                  }
                  className="bg-zinc-800 border-zinc-700 h-11"
                  type="email"
                />
              </div>
            </div>
            <div className="flex justify-end pt-4">
              <Button
                onClick={(e) => {
                  e.preventDefault();
                  handleSaveCustomerDetails();
                }}
                disabled={isSavingCustomer}
                className="bg-primary text-primary-foreground font-semibold px-6 hover:opacity-90"
              >
                {isSavingCustomer ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isEditDeviceModalOpen}
        onOpenChange={setIsEditDeviceModalOpen}
      >
        <DialogContent className="max-w-md bg-zinc-900 border border-zinc-800 text-white rounded-2xl">
          <DialogHeader>
            <DialogTitle>Edit Device & Issue</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Update the device and issue details for this ticket.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wide pl-1">
                  Brand
                </label>
                <Input
                  value={editDeviceData.brand || ""}
                  onChange={(e) =>
                    setEditDeviceData({
                      ...editDeviceData,
                      brand: e.target.value,
                    })
                  }
                  className="bg-zinc-800 border-zinc-700 h-11"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wide pl-1">
                  Model
                </label>
                <Input
                  value={editDeviceData.device_model || ""}
                  onChange={(e) =>
                    setEditDeviceData({
                      ...editDeviceData,
                      device_model: e.target.value,
                    })
                  }
                  className="bg-zinc-800 border-zinc-700 h-11"
                />
              </div>
              <div className="col-span-2 space-y-2">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wide pl-1">
                  Repair Type / Category
                </label>
                <Input
                  value={editDeviceData.repair_category || ""}
                  onChange={(e) =>
                    setEditDeviceData({
                      ...editDeviceData,
                      repair_category: e.target.value,
                    })
                  }
                  className="bg-zinc-800 border-zinc-700 h-11"
                />
              </div>
              <div className="col-span-2 space-y-2">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wide pl-1">
                  Subject / Short Title
                </label>
                <Input
                  value={editDeviceData.subject || ""}
                  onChange={(e) =>
                    setEditDeviceData({
                      ...editDeviceData,
                      subject: e.target.value,
                    })
                  }
                  className="bg-zinc-800 border-zinc-700 h-11"
                />
              </div>
              <div className="col-span-2 space-y-2">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wide pl-1">
                  Full Issue Description
                </label>
                <Textarea
                  value={editDeviceData.issue_description || editDeviceData.subject || ""}
                  onChange={(e) =>
                    setEditDeviceData({
                      ...editDeviceData,
                      issue_description: e.target.value,
                    })
                  }
                  className="bg-zinc-800 border-zinc-700 min-h-[100px] resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end pt-4">
              <Button
                onClick={(e) => {
                  e.preventDefault();
                  handleSaveDeviceDetails();
                }}
                disabled={isSavingDevice}
                className="bg-primary text-primary-foreground font-semibold px-6 hover:opacity-90"
              >
                {isSavingDevice ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isAddChargeModalOpen}
        onOpenChange={setIsAddChargeModalOpen}
      >
        <DialogContent className="max-w-md bg-zinc-900 border border-zinc-800 text-white rounded-2xl">
          <DialogHeader>
            <DialogTitle>Add Charge</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Add a new charge or line item to this ticket.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wide pl-1">
                Item Name
              </label>
              <Input
                value={newLineItem.name}
                onChange={(e) =>
                  setNewLineItem((p) => ({
                    ...p,
                    name: e.target.value,
                  }))
                }
                className="bg-zinc-800 border-zinc-700 h-11 text-white"
                placeholder="e.g. Screen Replacement"
                autoFocus
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wide pl-1">
                  Price ($)
                </label>
                <Input
                  type="number"
                  value={newLineItem.price || ""}
                  onChange={(e) =>
                    setNewLineItem((p) => ({
                      ...p,
                      price: Number(e.target.value),
                    }))
                  }
                  className="bg-zinc-800 border-zinc-700 h-11 text-white"
                  placeholder="0.00"
                  step="0.01"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wide pl-1">
                  Quantity
                </label>
                <Input
                  type="number"
                  value={newLineItem.quantity || ""}
                  onChange={(e) =>
                    setNewLineItem((p) => ({
                      ...p,
                      quantity: Number(e.target.value),
                    }))
                  }
                  className="bg-zinc-800 border-zinc-700 h-11 text-white"
                  placeholder="1"
                  min="1"
                />
              </div>
            </div>
            
            <div className="flex justify-end pt-4">
              <Button
                onClick={handleAddLineItem}
                disabled={isAddingCharge || !newLineItem.name}
                className="bg-primary text-primary-foreground font-semibold px-6 hover:opacity-90 w-full sm:w-auto"
              >
                {isAddingCharge ? "Adding..." : "Add Charge"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isAddPartModalOpen}
        onOpenChange={setIsAddPartModalOpen}
      >
        <DialogContent className="max-w-md bg-zinc-900 border border-zinc-800 text-white rounded-2xl">
          <DialogHeader>
            <DialogTitle>Request Part</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Add a new part to be ordered for this ticket.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wide pl-1">
                Part Name
              </label>
                  <div className="relative">
                    <Input
                      value={newPartName}
                      onChange={(e) => {
                        setNewPartName(e.target.value);
                        setPartCatalogSearch(e.target.value);
                        setShowPartCatalog(true);
                      }}
                      onFocus={() => setShowPartCatalog(true)}
                      onBlur={() => setTimeout(() => setShowPartCatalog(false), 200)}
                      className="bg-zinc-800 border-zinc-700 h-11 text-white pr-10"
                      placeholder="Search catalog or type custom part..."
                      autoFocus
                    />
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                    {showPartCatalog && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-800 border border-zinc-700 rounded-xl shadow-lg z-[100] max-h-[200px] overflow-y-auto ">
                        {partCatalogSearch && !products.some((p: any) => p?.description?.toLowerCase() === partCatalogSearch.toLowerCase()) && (
                          <div 
                            className="p-3 text-sm font-semibold text-emerald-400 hover:bg-zinc-700 cursor-pointer flex items-center gap-2 border-b border-zinc-700"
                            onMouseDown={async (e) => {
                              e.preventDefault(); // prevent blur
                              setNewPartName(partCatalogSearch);
                              setShowPartCatalog(false);
                              try {
                                await addDoc(collection(db, "product_catalog"), {
                                  code: "PART-" + Math.random().toString(36).substring(2, 6).toUpperCase(),
                                  description: partCatalogSearch,
                                  price: 0,
                                  created_at: serverTimestamp()
                                });
                                toast.success(`"${partCatalogSearch}" added to catalog`);
                              } catch(err) {
                                toast.error("Failed to add to catalog");
                              }
                            }}
                          >
                            <Plus className="w-4 h-4" /> Add "{partCatalogSearch}" as New Item
                          </div>
                        )}
                        {products.filter((p: any) => p?.description?.toLowerCase().includes(partCatalogSearch.toLowerCase()) || p.code?.toLowerCase().includes(partCatalogSearch.toLowerCase())).map((p: any, idx: number) => (
                           <div 
                             key={idx}
                             className="p-3 text-sm text-white hover:bg-zinc-700 cursor-pointer"
                             onMouseDown={(e) => {
                               e.preventDefault(); // prevent blur
                               setNewPartName(p.description);
                               setShowPartCatalog(false);
                             }}
                           >
                              <span className="font-bold text-zinc-400 mr-2 uppercase text-xs">{p.code}</span>
                              {p.description}
                           </div>
                        ))}
                      </div>
                    )}
                  </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wide pl-1">
                Supplier (Optional)
              </label>
              <div className="relative">
                <Input
                  value={newPartSupplier}
                  onChange={(e) => {
                    setNewPartSupplier(e.target.value);
                    setSupplierSearch(e.target.value);
                    setShowSupplierMenu(true);
                  }}
                  onFocus={() => setShowSupplierMenu(true)}
                  onBlur={() => setTimeout(() => setShowSupplierMenu(false), 200)}
                  className="bg-zinc-800 border-zinc-700 h-11 text-white pr-10"
                  placeholder="Select or type new supplier..."
                />
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                {showSupplierMenu && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-800 border border-zinc-700 rounded-xl shadow-lg z-[100] max-h-[200px] overflow-y-auto ">
                    {supplierSearch && !suppliers.some((s: string) => s?.toLowerCase() === supplierSearch.toLowerCase()) && (
                      <div 
                        className="p-3 text-sm font-semibold text-emerald-400 hover:bg-zinc-700 cursor-pointer flex items-center gap-2 border-b border-zinc-700"
                        onMouseDown={async (e) => {
                          e.preventDefault(); // prevent blur
                          setNewPartSupplier(supplierSearch);
                          setShowSupplierMenu(false);
                          try {
                             await addDoc(collection(db, "suppliers"), {
                               name: supplierSearch,
                               created_at: serverTimestamp()
                             });
                             toast.success(`"${supplierSearch}" added to suppliers`);
                          } catch(err) {
                             toast.error("Failed to add supplier");
                          }
                        }}
                      >
                        <Plus className="w-4 h-4" /> Add "{supplierSearch}" as Supplier
                      </div>
                    )}
                    {suppliers.filter((s: string) => s?.toLowerCase().includes(supplierSearch.toLowerCase())).map((s: string, idx: number) => (
                       <div 
                         key={idx}
                         className="p-3 text-sm text-white hover:bg-zinc-700 cursor-pointer"
                         onMouseDown={(e) => {
                           e.preventDefault(); // prevent blur
                           setNewPartSupplier(s);
                           setShowSupplierMenu(false);
                         }}
                       >
                          {s}
                       </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wide pl-1">
                Notes / Description
              </label>
              <Input
                value={newPartNotes}
                onChange={(e) => setNewPartNotes(e.target.value)}
                className="bg-zinc-800 border-zinc-700 h-11 text-white"
                placeholder="Any special requests or instructions..."
              />
            </div>
            
            <div className="flex justify-end pt-4">
              <Button
                onClick={handleAddPart}
                disabled={isAddingPart || !newPartName}
                className="bg-primary text-primary-foreground font-semibold px-6 hover:opacity-90 w-full sm:w-auto"
              >
                {isAddingPart ? "Adding..." : "Add Part Request"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
