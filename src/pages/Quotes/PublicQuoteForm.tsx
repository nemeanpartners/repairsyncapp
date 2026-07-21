import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle2, RefreshCw, Mail, Phone, Clock } from "lucide-react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";
import { toast, Toaster } from "sonner";
import { Button } from "@/components/ui/button";

interface FormConfig {
  title: string;
  description: string;
  step1: string;
  step2: string;
  step3: string;
  accentColor?: string;
}

const DEFAULT_CONFIG: FormConfig = {
  title: "Get a Repair Quote",
  description: "Fast, professional repairs for all your electronics. Professional service you can trust.",
  step1: "Details",
  step2: "Diagnosis",
  step3: "Quote",
  accentColor: "#2563eb",
};

export function PublicQuoteForm({ config = DEFAULT_CONFIG }: { config?: FormConfig }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    deviceModel: "",
    issueDescription: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await addDoc(collection(db, "quote_inquiries"), {
        ...formData,
        status: "new",
        createdAt: serverTimestamp(),
        source: window.location.origin,
      });
      setIsSuccess(true);
    } catch (error) {
      console.error("Submission error:", error);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-dvh bg-zinc-50 flex items-center justify-center p-6 font-sans">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white w-full max-w-md rounded-2xl p-10 text-center shadow-xl border border-zinc-200"
        >
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-3xl font-black text-zinc-900 tracking-tight">
            Got it!
          </h2>
          <p className="text-zinc-500 mt-4 leading-relaxed mb-8">
            Thanks {formData.name.split(" ")[0]}, we've received your request.
            We'll be in touch shortly via SMS or Email with your quote.
          </p>
          <Button
            className="w-full rounded-2xl bg-zinc-900 text-white font-bold h-12 hover:bg-zinc-800"
            onClick={() => {
              setIsSuccess(false);
              setFormData({
                name: "",
                email: "",
                phone: "",
                deviceModel: "",
                issueDescription: "",
              });
            }}
          >
            Submit Another Request
          </Button>
        </motion.div>
      </div>
    );
  }

  const accentColor = config.accentColor || "#2563eb";

  return (
    <div className="min-h-screen bg-zinc-50 md:p-6 font-sans flex items-center justify-center">
      <Toaster position="top-right" richColors />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white w-full max-w-4xl rounded-none md:rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row border border-zinc-200"
      >
        <div
          className="md:w-2/5 p-8 md:p-12 text-white relative flex flex-col justify-between overflow-hidden"
          style={{ backgroundColor: accentColor }}
        >
          <div className="relative z-10">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-10 border border-white/20">
               <span className="font-black text-xl">R</span>
            </div>
            <h1 className="text-4xl font-black leading-[0.9] tracking-tight mb-6 uppercase">
              {config.title}
            </h1>
            <p className="text-white/80 text-sm leading-relaxed mb-10 font-medium">
              {config.description}
            </p>
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center border border-white/10">
                  <span className="text-sm font-bold">1</span>
                </div>
                <span className="text-xs font-bold uppercase tracking-wide opacity-80">
                  {config.step1}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center border border-white/10">
                  <span className="text-sm font-bold">2</span>
                </div>
                <span className="text-xs font-bold uppercase tracking-wide opacity-80">
                  {config.step2}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center border border-white/10">
                  <span className="text-sm font-bold">3</span>
                </div>
                <span className="text-xs font-bold uppercase tracking-wide opacity-80">
                  {config.step3}
                </span>
              </div>
            </div>
          </div>
          <div className="relative z-10 pt-8 mt-10 border-t border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <span className="flex h-2 w-2 rounded-full bg-green-400"></span>
              <span className="text-xs font-medium uppercase tracking-wide opacity-60">
                Technicians Online
              </span>
            </div>
            <p className="text-xs font-medium opacity-40">
              Powered by RepairSync SMS
            </p>
          </div>
          {/* Decorative Circle */}
          <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-white/10 rounded-full blur-[80px] opacity-50" />
        </div>

        <form onSubmit={handleSubmit} className="flex-1 p-8 md:p-16 space-y-8">
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wide text-zinc-400 ml-1">
                  Full Name
                </label>
                <input
                  required
                  placeholder="John Doe"
                  className="w-full h-14 bg-zinc-50 border border-zinc-200 rounded-2xl px-5 text-sm focus:outline-none focus:ring-0 focus:border-zinc-300 focus:border-primary transition-all"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wide text-zinc-400 ml-1">
                  Mobile Phone
                </label>
                <input
                  required
                  type="tel"
                  placeholder="0400 000 000"
                  className="w-full h-14 bg-zinc-50 border border-zinc-200 rounded-2xl px-5 text-sm focus:outline-none focus:ring-0 focus:border-zinc-300 focus:border-primary transition-all"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wide text-zinc-400 ml-1">
                Email Address
              </label>
              <input
                required
                type="email"
                placeholder="john@example.com"
                className="w-full h-14 bg-zinc-50 border border-zinc-200 rounded-2xl px-5 text-sm focus:outline-none focus:ring-0 focus:border-zinc-300 focus:border-primary transition-all"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wide text-zinc-400 ml-1">
                Device Model
              </label>
              <input
                required
                placeholder="e.g. iPhone 15 Pro, Samsung S24"
                className="w-full h-14 bg-zinc-50 border border-zinc-200 rounded-2xl px-5 text-sm focus:outline-none focus:ring-0 focus:border-zinc-300 focus:border-primary transition-all"
                value={formData.deviceModel}
                onChange={(e) =>
                  setFormData({ ...formData, deviceModel: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wide text-zinc-400 ml-1">
                What's the issue?
              </label>
              <textarea
                required
                rows={4}
                placeholder="e.g. Broken screen, won't charge, water damage..."
                className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl p-5 text-sm focus:outline-none focus:ring-0 focus:border-zinc-300 focus:border-primary transition-all resize-none"
                value={formData.issueDescription}
                onChange={(e) =>
                  setFormData({ ...formData, issueDescription: e.target.value })
                }
              ></textarea>
            </div>
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-16 rounded-2xl bg-zinc-900 hover:bg-black text-white font-black text-xl transition-all shadow-xl active:scale-[0.98] disabled:opacity-50"
          >
            {isSubmitting ? (
              <RefreshCw className="w-5 h-5 animate-spin mx-auto text-white" />
            ) : (
              "Get My Free Quote"
            )}
          </Button>

          <p className="text-xs text-center text-zinc-400 font-bold uppercase tracking-wide">
            By submitting, you agree to SMS contact regarding your quote.
          </p>
        </form>
      </motion.div>
    </div>
  );
}
