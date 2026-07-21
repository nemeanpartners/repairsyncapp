import React, { useState, useEffect, useRef } from "react";
import { PrivacyPolicyView } from "./PrivacyPolicyView";
import { 
  motion, 
  AnimatePresence, 
  useScroll, 
  useTransform, 
  Variants 
} from "motion/react";
import { auth } from "../firebase";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { toast } from "sonner";
import { 
  Sparkles, 
  MessageSquare, 
  ArrowRight, 
  Cpu, 
  HardHat, 
  Activity, 
  Wrench, 
  Terminal, 
  ShieldAlert, 
  Sliders, 
  Layers, 
  CheckCircle, 
  Play, 
  Clock, 
  UserCheck, 
  TrendingUp, 
  Search, 
  Smartphone, 
  Laptop, 
  Zap, 
  Lock, 
  Globe, 
  Check, 
  HelpCircle, 
  ChevronRight, 
  BookOpen, 
  Menu, 
  X, 
  DollarSign, 
  QrCode, 
  Camera, 
  Send, 
  User, 
  Phone, 
  AlertTriangle 
} from "lucide-react";

interface PublicLandingPageProps {
  onLogin: () => void;
  onGuestLogin?: () => void;
}

export function PublicLandingPage({ onLogin, onGuestLogin }: PublicLandingPageProps) {
  const [currentHash, setCurrentHash] = useState(() => typeof window !== "undefined" ? window.location.hash : "");

  useEffect(() => {
    const handleHashChange = () => {
      setCurrentHash(window.location.hash);
    };
    window.addEventListener("hashchange", handleHashChange);
    handleHashChange();
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  const [activePlanInterval, setActivePlanInterval] = useState<"monthly" | "yearly">("yearly");
  const [liveTicketStatus, setLiveTicketStatus] = useState<"Diagnostic" | "Approval" | "Parts" | "QC" | "Ready">("Diagnostic");
  const [smsMockContent, setSmsMockContent] = useState<string>("Your iPhone 15 Pro battery replacement is completed.");
  const [smsList, setSmsList] = useState<Array<{ id: number; text: string; dir: "in" | "out"; status?: string }>>([
    { id: 1, text: "Hey! Does the iPhone screen repair include TrueTone calibrations?", dir: "in" },
    { id: 2, text: "Yes! All Screen calibrators run active calibrations automatically under QC protocols.", dir: "out", status: "Delivered" },
    { id: 3, text: "Sweet. Go ahead and start the service! 🛠️", dir: "in" }
  ]);
  const [liveSlaHours, setLiveSlaHours] = useState(3.4);
  const [triageDevice, setTriageDevice] = useState("MacBook Pro M2");
  const [triageProblem, setTriageProblem] = useState("Liquid split over keyboard");
  const [triageResult, setTriageResult] = useState<any>(null);
  const [isTriaging, setIsTriaging] = useState(false);
  const [estimateApproved, setEstimateApproved] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"triage" | "messaging" | "technician" | "sla">("triage");
  const [commandQuery, setCommandQuery] = useState("");
  const [selectedDemoDevice, setSelectedDemoDevice] = useState<"iphone" | "laptop" | "ipad">("iphone");

  // Track scroll metrics for custom floating headers
  const rootRef = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll({ container: rootRef });
  const headerBg = useTransform(scrollY, [0, 80], ["rgba(24, 24, 27, 0.95)", "rgba(15, 15, 18, 0.98)"]);
  const headerBorder = useTransform(scrollY, [0, 80], ["rgba(255, 255, 255, 0.1)", "rgba(255, 255, 255, 0.08)"]);

  // Automatically count down active SLA preview clock loop
  useEffect(() => {
    const interval = setInterval(() => {
      setLiveSlaHours((prev) => {
        if (prev <= 0.1) return 4.0;
        return Number((prev - 0.1).toFixed(1));
      });
    }, 3800);
    return () => clearInterval(interval);
  }, []);

  // Handler for custom mock interactive AI Triage
  const handleMockTriage = () => {
    setIsTriaging(true);
    setTimeout(() => {
      setTriageResult({
        category: "Logic Board Liquid Damage",
        difficulty: "High (Level 3 Board Repair Required)",
        estimatedTime: "24-48 Hours (SLA Class B)",
        riskScore: "87% Success Expectancy",
        steps: [
          "Complete ultrasonic wash & microscopic audit of PMIC circuit",
          "Replace secondary charging controllers CD3217 series (2 units required)",
          "Inspect display backlighting lines & fuse values",
          "Mark for multi-point stress test and QC logic seals"
        ]
      });
      setIsTriaging(false);
    }, 1200);
  };

  const handleSendMockSms = () => {
    if (!smsMockContent.trim()) return;
    const newMsg = {
      id: Date.now(),
      text: smsMockContent,
      dir: "out" as const,
      status: "Sent"
    };
    setSmsList([...smsList, newMsg]);
    setSmsMockContent("");
    
    // Simulate auto deliver checkmark
    setTimeout(() => {
      setSmsList(prev => prev.map(m => m.id === newMsg.id ? { ...m, status: "Delivered" } : m));
    }, 1000);
  };

  return (
    <div ref={rootRef} className="bg-[#09090b] text-zinc-100 h-full w-full overflow-y-auto overflow-x-hidden font-sans selection:bg-purple-500/20 selection:text-purple-300     hover:  [scrollbar-color:#27272a_#09090b]">
      {currentHash === "#privacy-policy" || currentHash === "#/privacy-policy" ? (
        <PrivacyPolicyView 
          onClose={() => { 
            window.location.hash = ""; 
            setCurrentHash("");
            if (typeof window !== "undefined" && window.history) {
              window.history.replaceState("", document.title, window.location.pathname + window.location.search);
            }
          }} 
        />
      ) : (
        <>
          {/* Dynamic SEO JSON-LD injection */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          "name": "RepairSync",
          "applicationCategory": "BusinessApplication",
          "operatingSystem": "All",
          "description": "The Realtime Repair Operating System. Accelerate technicians, streamline diagnostic SLA triggers, automate customer alerts, and run enterprise workflow boards.",
          "offers": {
            "@type": "Offer",
            "price": "49.00",
            "priceCurrency": "USD"
          },
          "aggregateRating": {
            "@type": "AggregateRating",
            "ratingValue": "4.9",
            "ratingCount": "1280"
          }
        })}
      </script>

      {/* Modern Fixed Navigation */}
      <motion.header 
        style={{ backgroundColor: headerBg, borderColor: headerBorder }}
        className="fixed top-0 left-0 right-0 h-[calc(4rem+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] border-b z-50 transition-colors backdrop-blur-md flex items-center justify-between px-6 lg:px-16"
      >
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-gradient-to-tr from-purple-600 to-indigo-600 rounded-xl flex items-center justify-center font-black text-white text-base shadow-lg shadow-purple-500/20">
            R
          </div>
          <div>
            <span className="text-md font-black tracking-tight bg-gradient-to-r from-zinc-50 to-zinc-300 bg-clip-text text-transparent">RepairSync</span>
            <span className="text-[8px] border border-emerald-500/30 bg-emerald-950/40 text-emerald-400 font-extrabold px-1 ml-1.5 rounded">R3</span>
          </div>
        </div>

        {/* Desktop Links */}
        <nav className="hidden md:flex items-center gap-8 text-xs font-semibold text-zinc-400">
          <a href="#features" className="hover:text-zinc-100 transition-colors">OS Capabilities</a>
          <a href="#technician" className="hover:text-zinc-100 transition-colors">TechnicianOS</a>
          <a href="#workflow" className="hover:text-zinc-100 transition-colors">Command Center</a>
          <a href="#pricing" className="hover:text-zinc-100 transition-colors">Pricing Policies</a>
          <a href="#faq" className="hover:text-zinc-100 transition-colors">FAQ Specs</a>
          <a href="#privacy-policy" className="hover:text-zinc-100 transition-colors">Privacy Policy</a>
        </nav>

        {/* Action Buttons & Mobile Menu */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2">
            <button 
              onClick={onGuestLogin}
              className="text-xs font-bold text-zinc-300 hover:text-zinc-100 transition-colors px-4 py-2 cursor-pointer"
            >
              Guest Demo
            </button>
            <button 
              onClick={() => { window.location.href = "/payments"; }}
              className="text-xs font-bold text-zinc-300 hover:text-zinc-100 transition-colors px-4 py-2 cursor-pointer hidden lg:block"
            >
              Get Subscription Now
            </button>
          </div>
          
          <button 
            onClick={() => setIsAuthModalOpen(true)}
            className="text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-zinc-50 px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl shadow-lg shadow-purple-900/30 transition-all cursor-pointer font-semibold flex items-center gap-1.5"
          >
            <Lock className="w-3.5 h-3.5 hidden sm:block" /> Sign In
          </button>

          {/* Mobile menu trigger */}
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-1.5 text-zinc-400 hover:text-zinc-100 md:hidden hover:bg-zinc-800 rounded-lg ml-1"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </motion.header>

      {/* Mobile Drawer Navigation */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-[calc(4rem+env(safe-area-inset-top))] left-0 right-0 bg-[#0c0c0f] border-b border-zinc-800 p-6 flex flex-col gap-5 z-40 md:hidden font-sans shadow-2xl"
          >
            <div className="flex flex-col gap-4 text-sm font-semibold text-zinc-300">
              <a href="#features" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-zinc-100 py-1 transition-colors">OS Capabilities</a>
              <a href="#technician" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-zinc-100 py-1 transition-colors">TechnicianOS Mode</a>
              <a href="#workflow" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-zinc-100 py-1 transition-colors">Command Center</a>
              <a href="#pricing" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-zinc-100 py-1 transition-colors">Pricing Packages</a>
              <a href="#privacy-policy" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-zinc-100 py-1 transition-colors">Privacy Policy</a>
            </div>
            <div className="h-px bg-zinc-800" />
            <div className="flex flex-col gap-3 font-sans">
              <button 
                onClick={() => { setIsMobileMenuOpen(false); if (onGuestLogin) onGuestLogin(); }}
                className="w-full text-center py-2.5 rounded-lg border border-zinc-700 font-bold text-xs hover:bg-zinc-900 transition-colors text-white cursor-pointer"
              >
                Guest Demo Sign-In
              </button>
              <button 
                onClick={() => { setIsMobileMenuOpen(false); setIsAuthModalOpen(true); }}
                className="w-full text-center py-2.5 rounded-lg border border-zinc-700 font-bold text-xs hover:bg-zinc-900 transition-colors text-white cursor-pointer"
              >
                Sign In
              </button>
              <button 
                onClick={() => { setIsMobileMenuOpen(false); window.location.href = "/payments"; }}
                className="w-full text-center py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 rounded-lg text-xs font-bold text-white shadow-lg cursor-pointer"
              >
                Get Subscription Now
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 1. CINEMATIC HERO SECTION */}
      <section className="relative pt-[calc(8rem+env(safe-area-inset-top))] pb-[calc(8rem+env(safe-area-inset-bottom))] lg:pt-40 lg:pb-36 px-6 lg:px-16 max-w-7xl mx-auto flex flex-col items-center text-center">
        {/* Glow Spheres */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] lg:w-[600px] lg:h-[600px] bg-indigo-700/10 blur-[120px] rounded-full pointer-events-none -z-10" />
        <div className="absolute top-1/3 left-1/4 w-[250px] h-[250px] bg-purple-700/10 blur-[100px] rounded-full pointer-events-none -z-10" />

        {/* Mini Pill Tag styling */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-1.5 px-3 py-1 bg-zinc-900/80 border border-zinc-800 rounded-full mb-6 relative overflow-hidden group shadow-inner"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs uppercase font-mono font-black text-zinc-300 tracking-wider">Enterprise Status Online</span>
          <div className="h-4 w-px bg-zinc-800 mx-1" />
          <span className="text-xs font-semibold text-purple-400 group-hover:text-purple-300 flex items-center gap-1 cursor-pointer" onClick={onLogin}>
            Version 3.4 Active <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </span>
        </motion.div>

        {/* Exploding Headline */}
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="text-4xl sm:text-5xl lg:text-7xl font-black tracking-tight text-white max-w-4xl leading-[1.08] lg:leading-[1.05]"
        >
          The Realtime <br />
          <span className="bg-gradient-to-r from-purple-400 via-indigo-300 to-indigo-500 bg-clip-text text-transparent">
            Repair Operating System
          </span>
        </motion.h1>

        {/* Sophisticated Subtitle */}
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25 }}
          className="mt-6 text-sm sm:text-base lg:text-lg text-zinc-400 max-w-2xl leading-relaxed"
        >
          Synthesizing mobile TechnicianOS, intelligent AI triage pipelines, responsive SLA breach triggers, and automated RCS customer communications in a singular robust architecture. Built for scale.
        </motion.p>

        {/* Responsive Hero CTA */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.35 }}
          className="mt-10 flex flex-col sm:flex-row gap-4 items-center justify-center w-full max-w-md"
        >
          <button 
            onClick={() => { window.location.href = "/payments"; }}
            className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-zinc-50 rounded-xl sm:text-sm font-extrabold shadow-xl hover:shadow-purple-500/20 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            Get Subscription Now <ArrowRight className="w-4 h-4" />
          </button>
          
          <button 
            onClick={onGuestLogin}
            className="w-full sm:w-auto px-8 py-3 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 text-zinc-200 rounded-xl sm:text-sm font-extrabold transition-all cursor-pointer"
          >
            View Demo Dashboard
          </button>
        </motion.div>

        {/* Visual Showcase: Main Interactive Mockup Console */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.45 }}
          className="mt-16 sm:mt-24 w-full border border-zinc-800 rounded-2xl bg-[#0c0c10]/95 shadow-2xl overflow-hidden text-left relative focus-within:ring-2 focus-within:ring-purple-500/30 hover:border-zinc-700/80 transition-all p-1"
        >
          {/* Glass Top Controls */}
          <div className="flex items-center justify-between px-6 py-4 bg-zinc-950/80 border-b border-zinc-800 rounded-t-[2.5rem]">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#f43f5e]/30 border border-[#f43f5e]/70" />
              <span className="w-3 h-3 rounded-full bg-[#eab308]/30 border border-[#eab308]/70" />
              <span className="w-3 h-3 rounded-full bg-[#10b981]/30 border border-[#10b981]/70" />
              <span className="text-xs text-zinc-500 font-mono font-bold tracking-wide uppercase ml-3">REPAIR_SYNC_OPERATING_SYSTEM_ACTIVE</span>
            </div>
            
            <div className="flex items-center gap-3">
              <span className="hidden md:inline-block text-[9px] bg-purple-950/60 text-purple-400 border border-purple-800 px-2 py-0.5 rounded font-semibold uppercase tracking-wide">
                Bench Node: OK
              </span>
              <span className="text-xs text-zinc-400 font-mono font-extrabold flex items-center gap-1">
                <Clock className="w-3 h-3 text-purple-500" /> UTC LIVE: {new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[460px] divide-y lg:divide-y-0 lg:divide-x divide-zinc-800">
            {/* Sidebar Live State Check */}
            <div className="lg:col-span-4 p-5 flex flex-col gap-5 bg-zinc-950/40">
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wide font-black mb-2">Primary Active Bench</p>
                <div 
                  onClick={() => setSelectedDemoDevice("iphone")}
                  className={`p-3 bg-zinc-900/60 rounded-xl border flex items-center gap-3 hover:bg-zinc-900 transition-colors cursor-pointer ${selectedDemoDevice === "iphone" ? "border-purple-500/60 bg-purple-500/5" : "border-zinc-800"}`}
                >
                  <Smartphone className="w-5 h-5 text-purple-500" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-zinc-100 truncate">iPhone 15 Pro OLED</p>
                    <p className="text-xs text-red-400 font-bold">Priority Tick: Critical (SLA: A)</p>
                  </div>
                  <span className="text-[9px] font-mono text-zinc-400 font-bold bg-zinc-800 px-1.5 py-0.5 rounded">R#104</span>
                </div>
                
                <div 
                  onClick={() => setSelectedDemoDevice("laptop")}
                  className={`mt-2.5 p-3 bg-zinc-900/60 rounded-xl border flex items-center gap-3 hover:bg-zinc-900 transition-colors cursor-pointer ${selectedDemoDevice === "laptop" ? "border-purple-500/60 bg-purple-500/5" : "border-zinc-800"}`}
                >
                  <Laptop className="w-5 h-5 text-indigo-500" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-zinc-100 truncate">MacBook Air Liquid Logic</p>
                    <p className="text-xs text-amber-400 font-bold">Priority Tick: High (SLA: B)</p>
                  </div>
                  <span className="text-[9px] font-mono text-zinc-400 font-bold bg-zinc-800 px-1.5 py-0.5 rounded">R#108</span>
                </div>
              </div>

              {/* Triage Mini-App */}
              <div className="border border-zinc-800 rounded-xl p-4 bg-zinc-900/40">
                <span className="text-[9px] bg-indigo-950/60 text-indigo-400 border border-indigo-800 px-2 py-0.5 rounded font-semibold uppercase tracking-wider block w-fit mb-3">AI Diagnostic Engine</span>
                
                <div className="space-y-2 text-xs">
                  <div>
                    <label className="text-[9px] uppercase tracking-wide font-bold text-zinc-500 block mb-1">Target Spec</label>
                    <input 
                      type="text" 
                      value={triageDevice}
                      onChange={(e) => setTriageDevice(e.target.value)} 
                      className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-[11px] text-zinc-200 outline-none focus:border-zinc-700"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] uppercase tracking-wide font-bold text-zinc-500 block mb-1">Reported Issue symptoms</label>
                    <input 
                      type="text" 
                      value={triageProblem}
                      onChange={(e) => setTriageProblem(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-[11px] text-zinc-200 outline-none focus:border-zinc-700"
                    />
                  </div>
                  <button 
                    onClick={handleMockTriage}
                    disabled={isTriaging}
                    className="w-full py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded font-bold text-xs tracking-wider uppercase mt-1 transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    {isTriaging ? "Analyzing Specs..." : "Trigger AI Triage Engine"}
                  </button>
                </div>

                {triageResult && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="mt-3.5 pt-3.5 border-t border-zinc-800 text-xs space-y-2"
                  >
                    <div className="flex justify-between font-bold">
                      <span className="text-[#a78bfa]">Classification:</span>
                      <span className="text-zinc-300">{triageResult.category}</span>
                    </div>
                    <div className="flex justify-between font-bold">
                      <span className="text-[#a78bfa]">Difficulty:</span>
                      <span className="text-zinc-300">{triageResult.difficulty}</span>
                    </div>
                    <div className="flex justify-between font-bold">
                      <span className="text-[#a78bfa]">Success Rate:</span>
                      <span className="text-emerald-400 font-extrabold">{triageResult.riskScore}</span>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>

            {/* Messaging Interactive Console */}
            <div className="lg:col-span-5 p-5 flex flex-col justify-between bg-[#08080b]/40">
              <div className="flex flex-col h-full justify-between gap-4">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-ping" />
                      <span className="text-xs font-black text-zinc-200">RCS Live Chat Sync</span>
                    </div>
                    <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 bg-[#4c1d95] text-[#ddd6fe] rounded">ACTIVE</span>
                  </div>

                  {/* Messages Bubble Viewport */}
                  <div className="space-y-3.5 py-4 max-h-[220px] overflow-y-auto">
                    {smsList.map((m) => (
                      <div key={m.id} className={`flex ${m.dir === "out" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[85%] rounded-xl px-3.5 py-2 text-xs font-medium leading-relaxed shadow-sm ${m.dir === "out" ? "bg-[#3b82f6] text-white rounded-br-none" : "bg-zinc-900 text-zinc-200 rounded-bl-none border border-zinc-800"}`}>
                          <p>{m.text}</p>
                          {m.status && (
                            <span className="text-[8px] text-blue-200 font-mono block text-right mt-1 font-bold">{m.status} ✓✓</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Simulated SMS Send form */}
                <div className="relative mt-2">
                  <input 
                    type="text" 
                    value={smsMockContent}
                    onChange={(e) => setSmsMockContent(e.target.value)}
                    placeholder="Type outbound test update..."
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-3 pr-12 py-2 text-[11px] text-zinc-200 outline-none focus:border-zinc-700 font-medium"
                    onKeyDown={(e) => e.key === "Enter" && handleSendMockSms()}
                  />
                  <button 
                    onClick={handleSendMockSms}
                    className="absolute right-2 top-1.5 p-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* SLA countdown queue status widget */}
            <div className="lg:col-span-3 p-5 flex flex-col justify-between bg-zinc-950/20">
              <div className="space-y-4">
                <div className="pb-3 border-b border-zinc-800 flex items-center justify-between">
                  <span className="text-xs text-zinc-500 uppercase tracking-wider font-black">Active SLA Counter</span>
                  <span className="text-xs bg-red-950 text-red-400 font-bold border border-red-800 px-1.5 py-0.1 rounded">URGENT</span>
                </div>

                <div className="text-center py-4 bg-zinc-950/80 rounded-xl border border-zinc-800 relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-2 h-full bg-rose-500" />
                  <p className="text-xs text-zinc-400 uppercase tracking-wide font-bold">Remaining SLA Action</p>
                  <p className="text-3xl font-mono font-black text-rose-500 tracking-tight mt-1 animate-pulse">{liveSlaHours}h</p>
                  <p className="text-[9px] text-zinc-500 font-mono mt-1">Automatic alert pending</p>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="p-2.5 bg-zinc-900/60 rounded-lg flex items-center justify-between border border-zinc-800/80">
                    <span className="text-zinc-400 font-semibold text-xs">Bench Time:</span>
                    <span className="font-mono text-zinc-200 text-xs">14.2 Hours</span>
                  </div>
                  <div className="p-2.5 bg-zinc-900/60 rounded-lg flex items-center justify-between border border-zinc-800/80">
                    <span className="text-zinc-400 font-semibold text-xs">Total Touches:</span>
                    <span className="font-mono text-emerald-400 text-xs font-medium">4 Times</span>
                  </div>
                </div>
              </div>

              <button 
                onClick={onLogin}
                className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 rounded-lg font-bold text-xs tracking-wider uppercase transition-colors cursor-pointer"
              >
                Launch Live Sandbox Workspace
              </button>
            </div>
          </div>
        </motion.div>
      </section>

      {/* STICKY CTA MOBILE BOTTOM PRESET */}
      <div className="fixed bottom-0 left-0 right-0 px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-[#09090b]/90 border-t border-zinc-800/80 backdrop-blur-md z-30 flex md:hidden items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-purple-400 uppercase tracking-wide">RepairSync OS</p>
          <p className="text-xs text-zinc-300 font-extrabold">Instant technician platform</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={onGuestLogin}
            className="px-4 py-2 border border-zinc-800 text-white hover:bg-zinc-800 rounded-lg text-xs font-bold"
          >
            Demo
          </button>
          <button 
            onClick={onLogin}
            className="px-5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-zinc-50 rounded-lg text-xs font-black shadow-lg"
          >
            Sign In
          </button>
        </div>
      </div>

      {/* METRIC RIBBON */}
      <section className="border-y border-zinc-800 bg-zinc-950/80 py-10">
        <div className="max-w-7xl mx-auto px-6 lg:px-16 grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
          <div>
            <p className="text-2xl sm:text-4xl font-mono font-black text-white">$14.2M+</p>
            <p className="text-xs sm:text-xs text-zinc-500 font-extrabold uppercase mt-1 tracking-wider">Repair Payments Processed</p>
          </div>
          <div>
            <p className="text-2xl sm:text-4xl font-mono font-black text-purple-400">18.4m</p>
            <p className="text-xs sm:text-xs text-zinc-500 font-extrabold uppercase mt-1 tracking-wider">Average Technican SLA Time</p>
          </div>
          <div>
            <p className="text-2xl sm:text-4xl font-mono font-black text-white">440,000+</p>
            <p className="text-xs sm:text-xs text-zinc-500 font-extrabold uppercase mt-1 tracking-wider">Automated SMS Dispatches</p>
          </div>
          <div>
            <p className="text-2xl sm:text-4xl font-mono font-black text-indigo-400">99.994%</p>
            <p className="text-xs sm:text-xs text-zinc-500 font-extrabold uppercase mt-1 tracking-wider">Operational Uptime Guarantee</p>
          </div>
        </div>
      </section>

      {/* 2. VALUE PROPOSITION: FEATURE BENTO GRID */}
      <section id="features" className="py-24 px-6 lg:px-16 max-w-7xl mx-auto">
        <div className="text-center space-y-4 mb-16">
          <span className="text-xs bg-purple-950/60 text-purple-400 border border-purple-850 px-3 py-1 font-semibold uppercase tracking-wide rounded-full">
            INTELLIGENT REPAIR ENGINE FEATURES
          </span>
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            Engineered For Bench Density.
          </h2>
          <p className="text-sm max-w-xl mx-auto text-zinc-400">
            Ditch spreadsheet chaos. Accelerate multi-point diagnostics, maintain perfect records, and automate client communication on autopilot.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          
          {/* Feature 1: AI Repair Triage */}
          <div className="md:col-span-8 border border-zinc-800 rounded-2xl p-6 lg:p-8 bg-zinc-900/10 hover:border-zinc-700/80 transition-all flex flex-col justify-between group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-[200px] h-[200px] bg-purple-500/5 blur-[50px] rounded-full pointer-events-none group-hover:scale-110 transition-transform" />
            <div className="flex gap-4 items-start">
              <div className="p-3 bg-purple-950/60 text-purple-400 border border-purple-800 rounded-2xl">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">AI-Powered Repair Triage Engine</h3>
                <p className="text-xs text-zinc-400 mt-1 max-w-lg leading-relaxed">
                  Automatically parse client diagnostic logs, assign complexity status levels, recommend specialized components, and calculate exact failure risk benchmarks before picking up a screwdriver.
                </p>
              </div>
            </div>
            {/* Visual simulation aspect inside grid */}
            <div className="mt-8 border border-zinc-800 rounded-2xl bg-zinc-950/95 p-4 font-mono text-xs">
              <div className="flex justify-between items-center text-zinc-500 mb-2.5 pb-2 border-b border-zinc-900">
                <span>[LOG_ANALYZER_NODE_v3.4]</span>
                <span className="text-purple-400">PROCESS: COMPLETE</span>
              </div>
              <p className="text-zinc-300 font-bold mb-1">&gt; ANALYZE SYSTEM "MacBook Pro Liquid keyboard failure"</p>
              <p className="text-emerald-400 font-black">&gt;&gt; Recommended Repair Path: CMOS wash + SMD keyboard flex trace reset</p>
              <p className="text-amber-400 font-black">&gt;&gt; Alert Point: PMIC U3200 controllers have secondary corrosion danger (87.2% Match)</p>
            </div>
          </div>

          {/* Feature 2: SLA Escalation Rules */}
          <div className="md:col-span-4 border border-zinc-800 rounded-2xl p-6 bg-zinc-900/10 hover:border-zinc-700/80 transition-all flex flex-col justify-between group relative overflow-hidden">
            <div className="absolute bottom-0 right-0 w-[150px] h-[150px] bg-indigo-500/5 blur-[40px] rounded-full pointer-events-none" />
            <div>
              <div className="w-11 h-11 p-2.5 bg-indigo-950/60 text-indigo-400 border border-indigo-800 rounded-xl mb-4">
                <ShieldAlert className="w-5 h-5 animate-pulse" />
              </div>
              <h3 className="text-base font-black text-white">Rigid SLA Countdown Systems</h3>
              <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                Define customizable service SLAs. Re-arrange schedules dynamically, assign back-up techs, and dispatch warning SMS updates to clients automatically before thresholds are broken.
              </p>
            </div>
            
            <div className="mt-6 p-4 bg-zinc-950/90 rounded-2xl border border-zinc-800 relative">
              <span className="absolute right-3 top-3 w-2 h-2 rounded-full bg-red-500 animate-ping" />
              <p className="text-[9px] uppercase tracking-wider text-zinc-500 font-bold mb-1">Breach Counter</p>
              <p className="text-xl font-mono font-black text-rose-500">01h : 18m : 44s</p>
              <p className="text-[9px] text-[#fda4af] font-black mt-1 uppercase tracking-wide bg-red-950/40 px-1.5 py-0.5 rounded border border-rose-900/40 w-fit">Alerting Bench Chief</p>
            </div>
          </div>

          {/* Feature 3: Smart Messaging */}
          <div className="md:col-span-4 border border-zinc-800 rounded-2xl p-6 bg-zinc-900/10 hover:border-zinc-700/80 transition-all flex flex-col justify-between group relative overflow-hidden">
            <div>
              <div className="w-11 h-11 p-2.5 bg-emerald-950/60 text-emerald-400 border border-emerald-800 rounded-xl mb-4">
                <MessageSquare className="w-5 h-5" />
              </div>
              <h3 className="text-base font-black text-white">Automated Customer Dispatch</h3>
              <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                Connect and sync instantly via fallback SMS and high-speed RCS. Keep conversational logs in a central workspace, automate tracking, and request immediate client quotes authorization.
              </p>
            </div>

            <div className="mt-6 p-3.5 bg-zinc-950/95 rounded-2xl border border-zinc-800 relative space-y-2">
              <div className="flex items-center gap-1.5 justify-between">
                <span className="text-[8px] font-semibold uppercase text-emerald-400 bg-emerald-950/50 px-1.5 py-0.5 rounded border border-emerald-900">RCS Standard</span>
                <span className="text-[9px] font-mono text-zinc-500">Delivered</span>
              </div>
              <p className="text-[11px] leading-relaxed text-zinc-300 font-medium">"Your logic estimate for Job R#109 is approved! Work commenced immediately."</p>
            </div>
          </div>

          {/* Feature 4: High-Velocity Search */}
          <div className="md:col-span-8 border border-zinc-800 rounded-2xl p-6 lg:p-8 bg-zinc-900/10 hover:border-zinc-700/80 transition-all flex flex-col justify-between group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-[250px] h-[250px] bg-blue-500/5 blur-[60px] pointer-events-none" />
            <div className="flex gap-4 items-start">
              <div className="p-3 bg-blue-950/60 text-blue-400 border border-blue-800 rounded-2xl">
                <Search className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">Predicitive Global Index Lookup</h3>
                <p className="text-xs text-zinc-400 mt-1 max-w-lg leading-relaxed">
                  Lookup any client profile, serial, IMEI, active ticket queue number, or product part count instantly with high-speed indexing. Integrated Command Palette lets operators initiate work tasks with key commands.
                </p>
              </div>
            </div>

            {/* Custom Command Palette visual mockup */}
            <div className="mt-8 border border-zinc-800 rounded-2xl bg-zinc-950/95 p-1 relative">
              <div className="flex items-center gap-2.5 px-3.5 py-2.5 border-b border-zinc-900">
                <Search className="w-4 h-4 text-zinc-400 animate-pulse" />
                <input 
                  type="text" 
                  placeholder="Type IMEI, ticket ID, or key action... (try 'R#104')" 
                  value={commandQuery}
                  onChange={(e) => setCommandQuery(e.target.value)}
                  className="bg-transparent border-none text-xs text-zinc-100 outline-none w-full"
                />
                <kbd className="font-mono text-[9px] px-1.5 py-0.5 bg-zinc-900 rounded text-zinc-500 border border-zinc-800">⌘K</kbd>
              </div>
              
              <div className="p-1 space-y-1">
                <div className="p-2 flex items-center justify-between hover:bg-zinc-900 rounded-lg cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-3.5 h-3.5 text-zinc-400" />
                    <span className="text-[11px] font-black text-zinc-200">iPhone 15 Pro OLED</span>
                  </div>
                  <span className="text-xs text-purple-400 uppercase tracking-wider font-bold">In-Bench R#104</span>
                </div>
                <div className="p-2 flex items-center justify-between hover:bg-zinc-900 rounded-lg cursor-pointer">
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-zinc-400" />
                    <span className="text-[11px] font-black text-zinc-200">Johnathan Doe</span>
                  </div>
                  <span className="text-xs text-zinc-500 font-mono">+1 555 491-9271</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* 3. MAJOR FOCUS: TECHNICIANOS */}
      <section id="technician" className="py-24 border-t border-zinc-800 bg-[#07070a] relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-purple-500/5 blur-[120px] rounded-full pointer-events-none" />
        <div className="max-w-7xl mx-auto px-6 lg:px-16 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          
          <div className="space-y-6">
            <span className="text-xs bg-purple-950/60 text-purple-400 border border-purple-800 px-3 py-1 font-semibold uppercase tracking-wide rounded-full">
              BUILT FOR THE BENCH - NOT OFFICE ADMINS
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-[1.1]">
              TechnicianOS <br />
              <span className="bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">Optimized for Action</span>
            </h2>
            <p className="text-sm text-zinc-400 leading-relaxed max-w-lg">
              Engineered for grease-stained indices and one-handed work execution. Big, bold touch-targets, smart swipe actions, and inline logic checklist guides let technicians complete multi-point diagnostic work without losing momentum.
            </p>

            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-purple-950 text-purple-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 border border-purple-800">
                  ✓
                </div>
                <div>
                  <p className="text-sm font-bold text-zinc-200">Fluid Swipe Controls</p>
                  <p className="text-xs text-zinc-400 mt-0.5">Simply drag/swipe tiles to proceed from assembly, QC checks, to customer pick up.</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-purple-950 text-purple-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 border border-purple-800">
                  ✓
                </div>
                <div>
                  <p className="text-sm font-bold text-zinc-200">Device Camera Logging Integration</p>
                  <p className="text-xs text-zinc-400 mt-0.5">Snapshot device cosmetic status, physical serial numbers, and micro-damage, saving details instantly to the cloud.</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-purple-950 text-purple-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 border border-purple-800">
                  ✓
                </div>
                <div>
                  <p className="text-sm font-bold text-zinc-200">Built-in Interactive Micro-checks</p>
                  <p className="text-xs text-zinc-400 mt-0.5">Custom checklists ensure technicians never overlook safety protocols or diagnostic procedures.</p>
                </div>
              </div>
            </div>

            <button 
              onClick={onLogin}
              className="px-6 py-3 bg-[#18181b] border border-zinc-800 hover:border-zinc-700 text-zinc-200 rounded-xl text-xs font-black tracking-wide transition-all cursor-pointer inline-flex items-center gap-2"
            >
              Examine TechnicianOS Interface <ArrowRight className="w-4 h-4 text-purple-500" />
            </button>
          </div>

          {/* High-Fidelity Responsive Phone Layout Mockup */}
          <div className="relative mx-auto max-w-[325px]">
            {/* Phone casing effect */}
            <div className="border-[8px] border-zinc-850 bg-[#09090b] rounded-[3rem] shadow-2xl p-3 aspect-[9/19.5] relative">
              <div className="absolute top-4 left-1/2 -translate-x-1/2 w-28 h-5 bg-black rounded-full z-15" /> {/* Notch */}
              
              <div className="h-full bg-[#0c0c0f] rounded-[2.3rem] overflow-hidden text-left font-sans text-white border border-zinc-800 relative flex flex-col justify-between">
                
                {/* Header info */}
                <div className="p-4 bg-zinc-950 border-b border-zinc-900 pt-8 flex justify-between items-center bg-gradient-to-b from-indigo-950/20 to-transparent">
                  <div>
                    <p className="text-[8px] uppercase tracking-wider text-zinc-400 font-extrabold">Active Bench</p>
                    <p className="text-xs font-black text-white">iPhone 15 Pro OLED</p>
                  </div>
                  <span className="text-[8px] font-mono font-bold bg-[#a78bfa]/10 text-[#c084fc] px-1.5 py-0.5 rounded border border-purple-900/60">SLA A</span>
                </div>

                {/* Main panel scroll */}
                <div className="p-4 flex-1 space-y-4 overflow-y-auto max-h-[350px]">
                  {/* Status checklist tracker */}
                  <div className="p-3 bg-zinc-900/60 rounded-xl border border-zinc-850 space-y-2.5">
                    <p className="text-[8px] uppercase tracking-wider text-zinc-500 font-bold">Step 2 of 4 • Diagnostic Protocol</p>
                    
                    <div className="flex gap-2.5 items-center">
                      <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/60 text-[9px] font-bold">✓</div>
                      <span className="text-xs text-zinc-400 line-through">Clean battery contact port</span>
                    </div>

                    <div className="flex gap-2.5 items-center">
                      <div className="w-4 h-4 rounded bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/60 text-xs font-medium">2</div>
                      <span className="text-xs text-zinc-100 font-bold">Affix diagnostic gasket sealer</span>
                    </div>

                    <div className="flex gap-2.5 items-center opacity-40">
                      <div className="w-4 h-4 rounded-full border border-zinc-700 text-[9px] text-zinc-500 flex items-center justify-center">3</div>
                      <span className="text-xs text-zinc-400">Run thermal dissipation stress</span>
                    </div>
                  </div>

                  {/* Actions drawer */}
                  <div className="space-y-2">
                    <p className="text-[8px] uppercase tracking-wider text-zinc-500 font-bold">Technician Tools</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button className="flex flex-col items-center justify-center p-2.5 bg-zinc-950 border border-zinc-850 rounded-xl hover:bg-zinc-900">
                        <Camera className="w-4 h-4 text-purple-400" />
                        <span className="text-[8px] text-zinc-300 font-bold mt-1">Snapshot</span>
                      </button>
                      <button className="flex flex-col items-center justify-center p-2.5 bg-zinc-950 border border-zinc-850 rounded-xl hover:bg-zinc-900">
                        <QrCode className="w-4 h-4 text-indigo-400" />
                        <span className="text-[8px] text-zinc-300 font-bold mt-1">Scan Serial</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Technician Slider to Complete */}
                <div className="p-4 bg-zinc-950/80 border-t border-zinc-900">
                  <motion.div 
                    onClick={() => {
                      setLiveTicketStatus("QC");
                    }}
                    className="w-full bg-gradient-to-r from-purple-900/40 to-indigo-900/40 border border-purple-800/80 hover:bg-purple-950 hover:border-purple-600 rounded-xl py-2.5 text-center cursor-pointer transition-colors"
                  >
                    <p className="text-xs uppercase font-semibold tracking-wide text-[#ddd6fe] animate-pulse">Drag / Tap to finalise</p>
                  </motion.div>
                </div>

              </div>
            </div>
          </div>

        </div>
      </section>

      {/* 4. REAL-TIME WORKFLOW COMMAND CENTER / KANBAN */}
      <section id="workflow" className="py-24 border-t border-zinc-800 bg-[#09090c] relative">
        <div className="max-w-7xl mx-auto px-6 lg:px-16">
          <div className="text-center space-y-4 mb-16">
            <span className="text-xs bg-indigo-950/60 text-indigo-400 border border-indigo-850 px-3 py-1 font-semibold uppercase tracking-wide rounded-full">
              CENTRAL COMMAND SYSTEM
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
              A Complete Realtime Bench Workflow.
            </h2>
            <p className="text-sm text-zinc-400 max-w-xl mx-auto">
              Command progress through customizable diagnostic columns, SLA status rules, and auto-dispatch rules seamlessly integrated with inventory reserves.
            </p>
          </div>

          {/* Interactive Kanban Workflow visualizer mockup */}
          <div className="border border-zinc-800 bg-zinc-950/80 rounded-2xl p-5 lg:p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Column 1: Diagnostic */}
            <div className="p-4 bg-zinc-900/30 border border-zinc-800 rounded-2xl flex flex-col justify-between min-h-[300px]">
              <div>
                <div className="flex items-center justify-between pb-3.5 border-b border-zinc-900 mb-4">
                  <span className="text-xs font-black text-zinc-300">1. DIAGNOSTICS</span>
                  <span className="text-xs font-mono text-zinc-500 font-extrabold bg-zinc-900 px-2 py-0.5 rounded">2 Units</span>
                </div>
                
                <div className="space-y-3">
                  <div className="p-3 bg-zinc-950/80 border border-zinc-800 rounded-xl relative overflow-hidden group hover:border-zinc-700">
                    <div className="absolute left-0 top-0 w-1 h-full bg-indigo-500" />
                    <p className="text-[9px] font-mono text-zinc-500 font-bold mb-1">R#112 • OLED Screen</p>
                    <p className="text-xs font-black text-zinc-200">Galaxy S23 Ultra Faded</p>
                    <p className="text-[8px] text-zinc-400 mt-2 font-bold flex items-center gap-1">⏱️ SLA: 1.5 Hours Over</p>
                  </div>
                </div>
              </div>
              <span className="text-[9px] text-zinc-500 font-mono mt-4">Average stay: 18m</span>
            </div>

            {/* Column 2: Quotation Approval */}
            <div className="p-4 bg-zinc-900/30 border border-zinc-800 rounded-2xl flex flex-col justify-between min-h-[300px]">
              <div>
                <div className="flex items-center justify-between pb-3.5 border-b border-zinc-900 mb-4">
                  <span className="text-xs font-black text-zinc-300">2. QUOTE APPROVALS</span>
                  <span className="text-xs font-mono text-zinc-500 font-extrabold bg-zinc-900 px-2 py-0.5 rounded">1 Unit</span>
                </div>
                
                <div className="space-y-3">
                  <div className="p-3 bg-zinc-950/80 border border-zinc-800 rounded-xl relative overflow-hidden">
                    <div className="absolute left-0 top-0 w-1 h-full bg-amber-500" />
                    <p className="text-[9px] font-mono text-indigo-400 font-bold mb-1">R#104 • Water damage</p>
                    <p className="text-xs font-black text-zinc-200">MacBook Air PMIC Corrosion</p>
                    
                    {/* Approve estimate button */}
                    <div className="mt-3">
                      {estimateApproved ? (
                        <div className="p-1.5 bg-emerald-950/40 text-emerald-400 border border-emerald-900 rounded text-[9px] font-black text-center flex items-center justify-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" /> Approved by Client
                        </div>
                      ) : (
                        <button 
                          onClick={() => {
                            setEstimateApproved(true);
                            setSmsList([...smsList, { id: Date.now(), text: "MACBOOK ESTIMATE APPROVED! Commencement active.", dir: "in" }]);
                          }}
                          className="w-full py-1 bg-yellow-500/20 text-yellow-400 border border-yellow-800 hover:bg-yellow-500/35 rounded text-xs font-extrabold text-center block cursor-pointer transition-colors"
                        >
                          Approve $240 Estimate
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <span className="text-[9px] text-zinc-500 font-mono mt-4">Average stage: 2.1h</span>
            </div>

            {/* Column 3: Active Bench Assembly */}
            <div className="p-4 bg-zinc-900/30 border border-zinc-800 rounded-2xl flex flex-col justify-between min-h-[300px]">
              <div>
                <div className="flex items-center justify-between pb-3.5 border-b border-zinc-900 mb-4">
                  <span className="text-xs font-black text-zinc-300">3. ACTIVE ASSEMBLY</span>
                  <span className="text-xs font-mono text-emerald-400 font-bold bg-emerald-950/50 border border-emerald-900 px-2 py-0.5 rounded">1 Task</span>
                </div>
                
                <div className="space-y-3">
                  <div className="p-3 bg-zinc-950/80 border border-zinc-800 rounded-xl relative overflow-hidden">
                    <div className="absolute left-0 top-0 w-1 h-full bg-emerald-500" />
                    <p className="text-[9px] font-mono text-zinc-500 font-bold mb-1">R#109 • Battery Swap</p>
                    <p className="text-xs font-black text-zinc-100">iPhone 15 Pro Battery</p>
                    <p className="text-[8px] text-emerald-400 mt-2 font-bold flex items-center gap-1">⚡ Bench Specialist Assigned</p>
                  </div>
                </div>
              </div>
              <span className="text-[9px] text-zinc-500 font-mono mt-4">Bench Limit: Max 4</span>
            </div>

            {/* Column 4: Quality Control & Audit */}
            <div className="p-4 bg-zinc-900/30 border border-zinc-800 rounded-2xl flex flex-col justify-between min-h-[300px]">
              <div>
                <div className="flex items-center justify-between pb-3.5 border-b border-zinc-900 mb-4">
                  <span className="text-xs font-black text-zinc-300">4. QC AUDIT</span>
                  <span className="text-xs font-mono text-zinc-500 font-extrabold bg-zinc-900 px-2 py-0.5 rounded">Clean</span>
                </div>
                
                <div className="p-4 bg-zinc-950/40 border border-dashed border-zinc-900 rounded-xl flex flex-col items-center justify-center text-center h-28">
                  <UserCheck className="w-6 h-6 text-zinc-600 mb-1" />
                  <p className="text-xs text-zinc-500 font-semibold leading-relaxed">No pending quality audit tickets.</p>
                </div>
              </div>
              <span className="text-[9px] text-zinc-500 font-mono mt-4">100% Pass Metric</span>
            </div>

          </div>
        </div>
      </section>

      {/* 5. INTERACTIVE CLIENT PORTAL REVEAL */}
      <section className="py-24 border-t border-zinc-800 bg-[#07070a] relative">
        <div className="max-w-7xl mx-auto px-6 lg:px-16 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          
          <div className="relative order-last lg:order-first">
            {/* Client Portal Simulated Iframe Container */}
            <div className="border border-zinc-800 bg-zinc-950 rounded-2xl p-6 shadow-2xl space-y-6">
              
              <div className="flex justify-between items-center pb-4 border-b border-zinc-900">
                <div>
                  <p className="text-[9px] uppercase tracking-wide text-[#a78bfa] font-black">Live Trace Portal</p>
                  <h4 className="text-sm font-black text-zinc-100">Phone Medic Repair status</h4>
                </div>
                <div className="text-right">
                  <p className="text-[9px] text-zinc-500 uppercase tracking-wide font-bold">Ticket Number</p>
                  <p className="text-xs font-mono font-bold text-zinc-300">#R104-92A</p>
                </div>
              </div>

              {/* Status Timeline Map */}
              <div className="space-y-4">
                <div className="flex gap-4 items-center">
                  <button 
                    onClick={() => setLiveTicketStatus("Diagnostic")}
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold border transition-all ${liveTicketStatus === "Diagnostic" ? "bg-purple-600 text-white font-black" : "border-zinc-800 text-zinc-500"}`}
                  >
                    1
                  </button>
                  <span className={`text-xs font-bold ${liveTicketStatus === "Diagnostic" ? "text-white" : "text-zinc-500"}`}>Intake & Diagnostics</span>
                </div>

                <div className="flex gap-4 items-center">
                  <button 
                    onClick={() => setLiveTicketStatus("Approval")}
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold border transition-all ${liveTicketStatus === "Approval" ? "bg-purple-600 text-white font-black" : "border-zinc-800 text-zinc-500"}`}
                  >
                    2
                  </button>
                  <span className={`text-xs font-bold ${liveTicketStatus === "Approval" ? "text-white" : "text-zinc-500"}`}>Estimate Approved</span>
                </div>

                <div className="flex gap-4 items-center">
                  <button 
                    onClick={() => setLiveTicketStatus("Parts")}
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold border transition-all ${liveTicketStatus === "Parts" ? "bg-purple-600 text-white font-black" : "border-zinc-800 text-zinc-500"}`}
                  >
                    3
                  </button>
                  <span className={`text-xs font-bold ${liveTicketStatus === "Parts" ? "text-white" : "text-zinc-500"}`}>Parts Allocated</span>
                </div>

                <div className="flex gap-4 items-center">
                  <button 
                    onClick={() => setLiveTicketStatus("QC")}
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold border transition-all ${liveTicketStatus === "QC" ? "bg-purple-600 text-white font-black" : "border-zinc-800 text-zinc-500"}`}
                  >
                    4
                  </button>
                  <span className={`text-xs font-bold ${liveTicketStatus === "QC" ? "text-white" : "text-zinc-500"}`}>Quality Audit</span>
                </div>
              </div>

              {/* Estimate Approve Interactive Area */}
              <div className="p-4 bg-zinc-900/60 rounded-2xl border border-zinc-850">
                <div className="flex justify-between items-center mb-3">
                  <div>
                    <p className="text-xs text-zinc-400 font-bold uppercase">Estimated Service Core Charge</p>
                    <p className="text-xl font-bold text-white">$180.00</p>
                  </div>
                  <span className="text-[9px] px-2 py-0.5 bg-yellow-900/40 text-yellow-400 border border-yellow-950 rounded font-semibold uppercase">Pending Approval</span>
                </div>
                <button 
                  onClick={() => {
                    setLiveTicketStatus("Parts");
                  }}
                  className="w-full py-2.5 bg-[#10b981] hover:bg-[#059669] text-white rounded-xl text-xs font-black tracking-wide cursor-pointer transition-colors"
                >
                  Approve and Commmence Labor
                </button>
              </div>

            </div>
          </div>

          <div className="space-y-6">
            <span className="text-xs bg-emerald-950/40 text-emerald-400 border border-emerald-900 px-3 py-1 font-semibold uppercase tracking-wide rounded-full">
              REDUCE CALLS • INCREASE RETENTION
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-[1.15]">
              Realtime Customer Portal <br />
              <span className="bg-gradient-to-r from-[#34d399] to-[#059669] bg-clip-text text-transparent">Frictionless Transparency</span>
            </h2>
            <p className="text-sm text-zinc-400 leading-relaxed max-w-lg">
              Empower customers with a live URL portal. No registration needed. Let them approve estimates instantly with one click, trace structural repair timelines, read media attachments, and make secure approvals to avoid outbound phone gridlocks.
            </p>
            
            <div className="flex gap-4 items-center">
              <div className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl">
                <Sliders className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-xs font-bold text-zinc-200">92% Outbound Alert Open Rate</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">Automated SMS notifications secure approvals 12X faster than legacy emails.</p>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* 6. ENTERPRISE INTEGRITY: RISK ENGINE & INTEL */}
      <section className="py-24 border-t border-zinc-800 bg-[#09090c] relative">
        <div className="max-w-7xl mx-auto px-6 lg:px-16 text-center space-y-4 mb-20">
          <span className="text-xs bg-purple-950/50 text-purple-400 border border-purple-800 px-3 py-1 font-semibold uppercase tracking-wide rounded-full">
            OPERATIONAL INTEGRITY CRITERIA
          </span>
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            Security. Stability. Absolute Scale.
          </h2>
          <p className="text-sm text-zinc-400 max-w-xl mx-auto">
            Governed by enterprise-class compliance matrices, secure transactional databases, and persistent SLA assurance trackers.
          </p>
        </div>

        <div className="max-w-7xl mx-auto px-6 lg:px-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          
          <div className="p-6 bg-zinc-950/60 border border-zinc-850 rounded-2xl relative overflow-hidden group">
            <div className="p-3 bg-[#e0f2fe]/5 border border-[#38bdf8]/20 text-[#38bdf8] rounded-xl w-fit mb-5">
              <Lock className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-black text-zinc-100 uppercase tracking-wide">Database Sandbox rules</h4>
            <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
              Complete transactional locks and encrypted client databases, safeguarding and insulating critical assets from malicious access vectors.
            </p>
          </div>

          <div className="p-6 bg-zinc-950/60 border border-zinc-850 rounded-2xl relative overflow-hidden group">
            <div className="p-3 bg-[#fdf2f8]/5 border border-[#f472b6]/20 text-[#f472b6] rounded-xl w-fit mb-5">
              <Zap className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-black text-zinc-100 uppercase tracking-wide">Realtime Trigger Webhooks</h4>
            <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
              Connect external billing APIs, inventory databases, and SMS transport lines with standard Webhook integrations and low-latency API wrappers.
            </p>
          </div>

          <div className="p-6 bg-zinc-950/60 border border-zinc-850 rounded-2xl relative overflow-hidden group">
            <div className="p-3 bg-[#f0fdf4]/5 border border-[#4ade80]/20 text-[#4ade80] rounded-xl w-fit mb-5">
              <Globe className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-black text-zinc-100 uppercase tracking-wide">Multi-Branch Telemetry</h4>
            <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
              Govern active bench pipelines in real-time across multiple store locations, warehouses, or repair centers using a single unified operations dashboard.
            </p>
          </div>

        </div>
      </section>

      {/* 7. TRANSPARENT PRICING MATRIX */}
      <section id="pricing" className="py-24 border-t border-zinc-800 bg-[#07070a] relative">
        <div className="max-w-7xl mx-auto px-6 lg:px-16 text-center space-y-4 mb-16">
          <span className="text-xs bg-indigo-950/40 text-indigo-400 border border-indigo-900 px-3 py-1 font-semibold uppercase tracking-wide rounded-full">
            PRICING OPTIONS
          </span>
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            Flat Pricing. Massive Scale.
          </h2>
          <p className="text-sm text-zinc-400 max-w-xl mx-auto">
            Choose a plan optimized for your technician volume. Cancel anytime. Save 20% by committing to an annual billing cycle.
          </p>

          {/* Pricing Toggle Selection */}
          <div className="flex items-center gap-2 justify-center mt-8">
            <button 
              onClick={() => setActivePlanInterval("monthly")}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${activePlanInterval === "monthly" ? "bg-zinc-900 text-white border border-zinc-750" : "text-zinc-500 hover:text-zinc-300"}`}
            >
              Monthly Billing
            </button>
            <div className="relative">
              <button 
                onClick={() => setActivePlanInterval("yearly")}
                className={`px-4 py-1.5 rounded-full text-xs font-black transition-all ${activePlanInterval === "yearly" ? "bg-[#311b92] text-zinc-100 border border-purple-800" : "text-zinc-500 hover:text-zinc-300"}`}
              >
                Yearly Billing
              </button>
              <span className="absolute -top-3.5 -right-16 text-[8px] bg-emerald-500/10 text-emerald-400 border border-emerald-950 px-1.5 py-0.5 rounded-full font-black animate-pulse">SAVE 20%</span>
            </div>
          </div>
        </div>

        {/* Pricing Layout Cards */}
        <div className="max-w-6xl mx-auto px-6 lg:px-16 grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          
          {/* Plan 1: Starter */}
          <div className="p-6 bg-zinc-950/60 border border-zinc-850 rounded-2xl flex flex-col justify-between group relative overflow-hidden">
            <div>
              <p className="text-xs uppercase font-mono font-black text-zinc-500">Starter Bench</p>
              <div className="flex items-baseline mt-4">
                <span className="text-4xl font-mono font-black text-white">${activePlanInterval === "yearly" ? "39" : "49"}</span>
                <span className="text-xs text-zinc-500 font-bold ml-1">/ Month</span>
              </div>
              <p className="text-xs text-zinc-400 mt-4 leading-relaxed">
                Perfect for smaller single-location technician clinics keeping workflow benchmarks clean.
              </p>

              <div className="h-px bg-zinc-900 my-6" />

              <ul className="space-y-3.5 text-xs">
                <li className="flex items-center gap-2 text-zinc-300">
                  <Check className="w-4 h-4 text-purple-500 shrink-0" />
                  <span>Up to 2 Active Technician Nodes</span>
                </li>
                <li className="flex items-center gap-2 text-zinc-300">
                  <Check className="w-4 h-4 text-purple-500 shrink-0" />
                  <span>Interactive Kanban pipeline board</span>
                </li>
                <li className="flex items-center gap-2 text-zinc-300">
                  <Check className="w-4 h-4 text-purple-500 shrink-0" />
                  <span>Automated standard SMS / RCS alerts</span>
                </li>
                <li className="flex items-center gap-2 text-zinc-500 line-through">
                  <span>Custom AI diagnostic triage engine</span>
                </li>
              </ul>
            </div>
            
            <button 
              onClick={() => { window.location.href = `/payments?plan=starter&interval=${activePlanInterval}`; }}
              className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-700 text-zinc-300 rounded-xl text-xs font-semibold uppercase mt-8 transition-colors cursor-pointer"
            >
              Buy Starter Now
            </button>
          </div>

          {/* Plan 2: Pro (Featured Plan) */}
          <div className="p-6 bg-gradient-to-b from-indigo-950/15 to-transparent border border-purple-500/50 rounded-2xl flex flex-col justify-between relative shadow-xl shadow-purple-500/5">
            <span className="absolute -top-3 right-6 text-[8px] bg-purple-500 text-white font-black px-2 py-0.5 rounded-full uppercase tracking-wide">MOST RECONSTRUCTIVE</span>
            <div>
              <p className="text-xs uppercase font-mono font-black text-purple-400">Professional Team</p>
              <div className="flex items-baseline mt-4">
                <span className="text-4xl font-mono font-black text-white">${activePlanInterval === "yearly" ? "79" : "99"}</span>
                <span className="text-xs text-purple-500 font-bold ml-1">/ Month</span>
              </div>
              <p className="text-xs text-zinc-400 mt-4 leading-relaxed">
                Optimized for fast-paced repair networks and active multiple store locations running SLAs.
              </p>

              <div className="h-px bg-purple-900/40 my-6" />

              <ul className="space-y-3.5 text-xs">
                <li className="flex items-center gap-2 text-zinc-200 font-bold">
                  <Check className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>Up to 10 Professional Tech Nodes</span>
                </li>
                <li className="flex items-center gap-2 text-zinc-200 font-bold">
                  <Check className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>AI Repair Triage & Risk Analytics</span>
                </li>
                <li className="flex items-center gap-2 text-zinc-200">
                  <Check className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>Advanced Automated Smart Alerts (RCS)</span>
                </li>
                <li className="flex items-center gap-2 text-zinc-200">
                  <Check className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>Interactive Live Client Estimates approvals</span>
                </li>
              </ul>
            </div>
            
            <button 
              onClick={() => { window.location.href = `/payments?plan=pro&interval=${activePlanInterval}`; }}
              className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold uppercase mt-8 shadow-xl hover:shadow-purple-500/20 transition-all cursor-pointer"
            >
              Buy Professional Now
            </button>
          </div>

          {/* Plan 3: Enterprise */}
          <div className="p-6 bg-zinc-950/60 border border-zinc-850 rounded-2xl flex flex-col justify-between group relative overflow-hidden">
            <div>
              <p className="text-xs uppercase font-mono font-black text-zinc-500">Enterprise Scale</p>
              <div className="flex items-baseline mt-4">
                <span className="text-4xl font-mono font-black text-white">$199</span>
                <span className="text-xs text-zinc-500 font-bold ml-1">/ Month</span>
              </div>
              <p className="text-xs text-zinc-400 mt-4 leading-relaxed">
                Engineered for global depot operators, IT asset recovery lines require absolute customization.
              </p>

              <div className="h-px bg-zinc-900 my-6" />

              <ul className="space-y-3.5 text-xs">
                <li className="flex items-center gap-2 text-zinc-300">
                  <Check className="w-4 h-4 text-purple-500 shrink-0" />
                  <span>Unlimited Operator Roles & Benches</span>
                </li>
                <li className="flex items-center gap-2 text-zinc-300">
                  <Check className="w-4 h-4 text-purple-500 shrink-0" />
                  <span>SLA API Webhooks & Multi-location Sync</span>
                </li>
                <li className="flex items-center gap-2 text-zinc-300">
                  <Check className="w-4 h-4 text-purple-500 shrink-0" />
                  <span>Dedicated Custom API Node Access limits</span>
                </li>
                <li className="flex items-center gap-2 text-zinc-300">
                  <Check className="w-4 h-4 text-purple-500 shrink-0" />
                  <span>Assigned Account Compliance Auditor</span>
                </li>
              </ul>
            </div>
            
            <button 
              onClick={onLogin}
              className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-700 text-zinc-300 rounded-xl text-xs font-semibold uppercase mt-8 transition-colors cursor-pointer"
            >
              Contact Enterprise Strategy
            </button>
          </div>

        </div>
      </section>

      {/* 8. SOCIAL PROOF SECTION */}
      <section className="py-24 border-y border-zinc-805 bg-zinc-950/50">
        <div className="max-w-7xl mx-auto px-6 lg:px-16">
          <div className="text-center space-y-3 mb-16">
            <span className="text-xs bg-emerald-950/40 text-emerald-400 border border-emerald-900 px-3 py-1 font-semibold uppercase tracking-wide rounded-full">
              GLOBAL OPERATOR CASE STORIES
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
              Trusted by Level 3 Bench Specialisms.
            </h2>
            <p className="text-sm text-zinc-400 max-w-lg mx-auto">
              Real telemetry, diagnostic insights, and metrics tracking from live deployment centers across Australia & structural networks.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            
            {/* Case 1 */}
            <div className="p-6 bg-zinc-900/20 border border-zinc-800 rounded-2xl relative">
              <span className="text-4xl text-purple-500/20 font-black absolute top-4 left-4">“</span>
              <p className="text-xs text-zinc-300 leading-relaxed italic relative z-10">
                "Our average estimate authorization cycle dropped from 3.2 hours to just 14 minutes. Customers approve our repairs checklist directly from their phone browser while in transit. RepairSync completely eliminated phone queue fatigue so technicians can just focus on clean operations."
              </p>
              
              <div className="mt-6 flex items-center gap-3.5 border-t border-zinc-900 pt-4">
                <div className="w-9 h-9 rounded-full bg-indigo-900/60 font-black text-xs text-zinc-200 flex items-center justify-center border border-indigo-700">
                  MA
                </div>
                <div>
                  <p className="text-xs font-black text-zinc-100">Marcus Aurelius</p>
                  <p className="text-xs text-zinc-500">General Manager, Logic Board Doctors</p>
                </div>
              </div>
            </div>

            {/* Case 2 */}
            <div className="p-6 bg-zinc-900/20 border border-zinc-800 rounded-2xl relative">
              <span className="text-4xl text-purple-500/20 font-black absolute top-4 left-4">“</span>
              <p className="text-xs text-zinc-300 leading-relaxed italic relative z-10">
                "As an enterprise IT refurbisher, maintaining absolute tracking of logic serials and IMEI tags is critical. The RepairSync indexing speeds are unmatched, and the custom diagnostic checklist has zeroed our return rate for board failures."
              </p>
              
              <div className="mt-6 flex items-center gap-3.5 border-t border-zinc-900 pt-4">
                <div className="w-9 h-9 rounded-full bg-purple-900/60 font-black text-xs text-zinc-200 flex items-center justify-center border border-purple-700">
                  SH
                </div>
                <div>
                  <p className="text-xs font-black text-zinc-100">Sarah Jenkins</p>
                  <p className="text-xs text-zinc-500">Refurbishment Chief, GreenLoop Micro-Logistics</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 9. FAQ SPECTRAL MATRIX */}
      <section id="faq" className="py-24 max-w-5xl mx-auto px-6 lg:px-16">
        <div className="text-center space-y-3 mb-16">
          <span className="text-xs bg-purple-950/40 text-purple-400 border border-purple-900 px-3 py-1 font-semibold uppercase tracking-wide rounded-full">
            SYSTEM ARCHITECTURE SPECIFICATIONS
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Frequently Analyzed Criteria.
          </h2>
        </div>

        <div className="space-y-6">
          <div className="p-5 bg-zinc-950/40 border border-zinc-850 rounded-xl">
            <h4 className="text-sm font-black text-zinc-100">Is our current customer billing platform or CRM database compatible?</h4>
            <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
              Absolutely. Our system provides automated Webhook API routing out-of-the-box, allowing you to synchronize records seamlessly.
            </p>
          </div>

          <div className="p-5 bg-zinc-950/40 border border-zinc-850 rounded-xl">
            <h4 className="text-sm font-black text-zinc-100">Does the SMS automation support dynamic templates for custom parts delayed states?</h4>
            <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
              Yes. Operators can easily establish customized dynamic SMS templates that automatically resolve ticket properties like customer name, serial numbers, estimates, and expected repair dates.
            </p>
          </div>

          <div className="p-5 bg-zinc-950/40 border border-zinc-850 rounded-xl">
            <h4 className="text-sm font-black text-zinc-100">What data regulations govern our repair records?</h4>
            <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
              RepairSync is engineered with robust security. All local diagnostic histories, IMEI indexes, and files are protected with isolated rulesets and transactional data locks.
            </p>
          </div>
        </div>
      </section>

      {/* 10. LAUNCH CTA ACTION CARD */}
      <section className="py-24 px-6 lg:px-16 max-w-6xl mx-auto">
        <div className="bg-gradient-to-tr from-purple-950/30 to-indigo-950/40 border border-purple-500/30 rounded-[3rem] p-8 lg:p-16 text-center space-y-6 relative overflow-hidden shadow-2xl">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-purple-500/10 blur-[90px] rounded-full pointer-events-none" />
          
          <span className="text-xs bg-purple-900/40 text-purple-300 border border-purple-850 px-3 py-1 font-semibold uppercase tracking-wide rounded-full">
            IMMEDIATE ACTION PROTOCOL
          </span>
          <h2 className="text-4xl lg:text-6xl font-black text-white tracking-tight leading-none">
            Run Your Repairs Like An <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">Integrated Operating System.</span>
          </h2>
          <p className="text-sm text-zinc-400 max-w-xl mx-auto leading-relaxed">
            Unleash real-time tracking, elevate technician pace, and secure customer confidence under a single robust structural architecture.
          </p>

          <div className="pt-4 flex flex-col sm:flex-row gap-4 items-center justify-center">
            <button 
              onClick={() => setIsAuthModalOpen(true)}
              className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-zinc-50 rounded-xl text-xs font-black tracking-wide shadow-xl hover:shadow-purple-500/25 cursor-pointer flex items-center justify-center gap-2"
            >
              Start Free Core Deployments <ArrowRight className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setIsAuthModalOpen(true)}
              className="w-full sm:w-auto px-8 py-3.5 bg-zinc-950 hover:bg-zinc-900 text-zinc-300 rounded-xl text-xs font-black tracking-wide border border-zinc-800 hover:border-zinc-700 transition-colors cursor-pointer"
            >
              Speak with Bench Architect
            </button>
          </div>
        </div>
      </section>

      {/* 11. MODERN SaaS FOOTER */}
      <footer className="border-t border-zinc-900 bg-zinc-950/80 py-16 px-6 lg:px-16 text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto grid grid-cols-2 lg:grid-cols-5 gap-12 font-sans">
          
          {/* Column 1 info */}
          <div className="col-span-2 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-purple-600 rounded-lg flex items-center justify-center text-white font-extrabold text-sm">R</div>
              <span className="font-black text-zinc-200 text-sm tracking-tight">RepairSync</span>
            </div>
            <p className="leading-relaxed max-w-xs text-zinc-400">
              The real-time repair operating system designed for density, technician momentum, and absolute compliance.
            </p>
            <p className="text-xs text-zinc-600 font-mono">© 2026 RepairSync Inc. All rights reserved.</p>
          </div>

          {/* Column 2 */}
          <div className="space-y-3.5">
            <h5 className="font-extrabold text-zinc-300 uppercase tracking-wide text-[9px]">Capabilities</h5>
            <ul className="space-y-2.5 font-semibold">
              <li><a href="#features" className="hover:text-zinc-300 transition-colors">AI Repair Triage</a></li>
              <li><a href="#technician" className="hover:text-zinc-300 transition-colors">TechnicianOS</a></li>
              <li><a href="#workflow" className="hover:text-zinc-300 transition-colors">Command Center</a></li>
              <li><a href="#pricing" className="hover:text-zinc-300 transition-colors">SLA Assurance</a></li>
            </ul>
          </div>

          {/* Column 3 */}
          <div className="space-y-3.5">
            <h5 className="font-extrabold text-zinc-300 uppercase tracking-wide text-[9px]">Resources</h5>
            <ul className="space-y-2.5 font-semibold">
              <li><a href="#faq" className="hover:text-zinc-300 transition-colors">Diagnostic Guides</a></li>
              <li><a href="#pricing" className="hover:text-zinc-300 transition-colors">Pricing Policies</a></li>
              <li><span className="text-zinc-600">Enterprise API Specs</span></li>
              <li><span className="text-zinc-600">Developer Sandboxes</span></li>
            </ul>
          </div>

          {/* Column 4 */}
          <div className="space-y-3.5">
            <h5 className="font-extrabold text-zinc-300 uppercase tracking-wide text-[9px]">Legal Specs</h5>
            <ul className="space-y-2.5 font-semibold">
              <li><a href="#privacy-policy" className="text-zinc-400 hover:text-zinc-200 transition-colors">Privacy Policy</a></li>
              <li><span className="text-zinc-600">Compliance Audits</span></li>
              <li><span className="text-zinc-600">Terms of Use</span></li>
            </ul>
          </div>

        </div>
      </footer>

      {/* 12. UNIFIED SIGN IN CHOICE MODAL */}
      <AnimatePresence>
        {isAuthModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto"
            onClick={() => setIsAuthModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-zinc-950 border border-zinc-900 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl relative p-8 font-sans text-zinc-300"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                type="button"
                onClick={() => setIsAuthModalOpen(false)}
                className="absolute top-4 right-4 p-2 text-zinc-500 hover:text-zinc-300 rounded-full hover:bg-zinc-900 transition-colors z-10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div>
                <div className="flex items-center gap-2 mb-6">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-pulse" />
                  <span className="text-xs font-mono font-black text-purple-400 uppercase tracking-wide leading-none">LEVEL 2: SECURE WORKSPACE</span>
                </div>

                <div className="mb-6 flex bg-zinc-900 p-1 rounded-xl border border-zinc-900">
                  <button
                    type="button"
                    onClick={() => setIsSignUp(false)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${!isSignUp ? 'bg-zinc-800 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsSignUp(true)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${isSignUp ? 'bg-zinc-800 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    Create Account
                  </button>
                </div>

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!authEmail || !authPassword) {
                      toast.error("Please fill in email and password fields");
                      return;
                    }
                    setAuthLoading(true);
                    try {
                      if (isSignUp) {
                        await createUserWithEmailAndPassword(auth, authEmail, authPassword);
                        toast.success("Account created successfully!");
                        setIsAuthModalOpen(false);
                      } else {
                        await signInWithEmailAndPassword(auth, authEmail, authPassword);
                        toast.success("Successfully logged in!");
                        setIsAuthModalOpen(false);
                      }
                    } catch (err: any) {
                      console.error(err);
                      let message = err.message || "Authentication failed.";
                      if (err.code === "auth/email-already-in-use") {
                        message = "This email is already registered.";
                      } else if (err.code === "auth/invalid-credential") {
                        message = "Invalid operational credentials.";
                      } else if (err.code === "auth/weak-password") {
                        message = "Password should be at least 6 characters.";
                      }
                      toast.error(message);
                    } finally {
                      setAuthLoading(false);
                    }
                  }}
                  className="space-y-4"
                >
                  <div className="space-y-1.5">
                    <label className="text-xs uppercase font-mono font-bold text-zinc-500" htmlFor="auth-email">
                      Operator Email Address
                    </label>
                    <input
                      type="email"
                      id="auth-email"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      placeholder="operator@company.com"
                      className="w-full px-4 py-2.5 bg-zinc-900 border border-zinc-900 focus:border-purple-500 rounded-xl text-xs text-white placeholder-zinc-750 outline-none transition-colors"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs uppercase font-mono font-bold text-zinc-500" htmlFor="auth-password">
                      Security Password
                    </label>
                    <input
                      type="password"
                      id="auth-password"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      placeholder="••••••••••••••"
                      className="w-full px-4 py-2.5 bg-zinc-900 border border-zinc-900 focus:border-purple-500 rounded-xl text-xs text-white placeholder-zinc-750 outline-none transition-colors"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:from-zinc-800 disabled:to-zinc-800 text-white rounded-xl text-xs font-semibold uppercase tracking-wider transition-all disabled:text-zinc-600 shadow-xl cursor-pointer"
                  >
                    {authLoading ? "Authorizing..." : isSignUp ? "Create Account" : "Sign In"}
                  </button>

                  <div className="relative flex py-2 items-center">
                    <div className="flex-grow border-t border-zinc-900"></div>
                    <span className="flex-shrink mx-4 text-[9px] uppercase font-mono font-bold text-zinc-650">OR</span>
                    <div className="flex-grow border-t border-zinc-900"></div>
                  </div>

                  <button
                    type="button"
                    onClick={async () => {
                      setIsAuthModalOpen(false);
                      onGuestLogin?.();
                    }}
                    className="w-full py-3 bg-zinc-900 hover:bg-zinc-850 hover:text-amber-300 border border-zinc-900 text-zinc-300 rounded-xl text-xs font-bold transition-all cursor-pointer flex flex-col items-center justify-center gap-1"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                      <span>Continue as Guest</span>
                    </div>
                    <span className="text-xs text-zinc-500 font-normal">Anonymous guest user with limitations inside the app</span>
                  </button>
                </form>
              </div>

              <div className="space-y-3 mt-6">
                <div className="relative flex py-2 items-center">
                  <div className="flex-grow border-t border-zinc-900"></div>
                  <span className="flex-shrink mx-4 text-[9px] uppercase font-mono font-bold text-zinc-650">Secure SSO Alternate</span>
                  <div className="flex-grow border-t border-zinc-900"></div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsAuthModalOpen(false);
                    onLogin();
                  }}
                  className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-900 text-zinc-300 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  Continue with Google SSO
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
        </>
      )}
    </div>
  );
}
