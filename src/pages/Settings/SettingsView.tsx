import React, { useState } from "react";
import {
  Settings,
  Shield,
  Bell,
  Zap,
  Palette,
  Link as LinkIcon,
  Database,
  Users,
  ChevronLeft,
  Workflow,
  MessageSquareDashed,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

import { GeneralSettingsForm } from "./components/GeneralSettingsForm";
import { NotificationSettingsForm } from "./components/NotificationSettingsForm";
import { BrandingSettingsForm } from "./components/BrandingSettingsForm";
import { AiSettingsForm } from "./components/AiSettingsForm";
import { SecuritySettingsForm } from "./components/SecuritySettingsForm";
import { IntegrationsSettings } from "./components/IntegrationsSettings";
import { DatabaseSettings } from "./components/DatabaseSettings";
import { AutomationsSettingsForm } from "./components/AutomationsSettingsForm";
import { ChatTemplatesSettingsForm } from "./components/ChatTemplatesSettingsForm";
import { DeviceSettingsForm } from "./components/DeviceSettingsForm";
import { CatalogSettingsForm } from "./components/CatalogSettingsForm";
import { SubscriptionSettingsForm } from "./components/SubscriptionSettingsForm";
import { TeamMembersSettings } from "../../components/TeamMembersSettings"; // existing component
import { useAuth } from "../../providers/AuthProvider";
import { CreditCard } from "lucide-react";

export function SettingsView() {
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin" || profile?.permissions?.includes("admin");

  const SETTING_TABS = [
    {
      id: "subscription",
      icon: CreditCard,
      label: "My RepairSync Subscription",
      desc: "Billing, plan and payments",
      adminOnly: true,
    },
    {
      id: "general",
      icon: Settings,
      label: "General",
      desc: "Shop details, currency, timezone",
      adminOnly: true,
    },
    {
      id: "team",
      icon: Users,
      label: "Team",
      desc: "Manage technicians and staff roles",
      adminOnly: true,
    },
    {
      id: "catalog",
      icon: Database,
      label: "Catalogs & Suppliers",
      desc: "Manage products and suppliers",
      adminOnly: true,
    },
    {
      id: "notifications",
      icon: Bell,
      label: "Notifications",
      desc: "Email & SMS alerts",
      adminOnly: true,
    },
    {
      id: "automations",
      icon: Workflow,
      label: "Automations",
      desc: "Trigger SMS on status change",
      adminOnly: true,
    },
    {
      id: "chat_templates",
      icon: MessageSquareDashed,
      label: "Message Templates",
      desc: "Manage SMS fast replies & templates",
      adminOnly: true,
    },
    {
      id: "devices",
      icon: Database,
      label: "Device Inventory",
      desc: "Manage brands and device models",
      adminOnly: true,
    },
    {
      id: "appearance",
      icon: Palette,
      label: "Appearance",
      desc: "Theme and branding",
      adminOnly: true,
    },
    {
      id: "integrations",
      icon: LinkIcon,
      label: "Integrations",
      desc: "Xero, Zoho, RepairShopr",
      adminOnly: true,
    },
    {
      id: "ai",
      icon: Zap,
      label: "AI Features",
      desc: "Configure GenAI diagnostics",
      adminOnly: true,
    },
    {
      id: "security",
      icon: Shield,
      label: "Security",
      desc: "Active sessions and Deletion Requests",
      adminOnly: false,
    },
    {
      id: "database",
      icon: Database,
      label: "Data",
      desc: "Exports and backups",
      adminOnly: true,
    },
  ];

  const activeTabContext = SETTING_TABS.find((t) => t.id === activeTab);

  const canEditTab = (tabId: string) =>
    isAdmin || Boolean(profile?.permissions?.includes(`settings:${tabId}`));

  const openTab = (tabId: string) => {
    setActiveTab(tabId);
    if (!canEditTab(tabId)) {
      toast.info("Read-only view. Ask your company admin to grant edit access.");
    }
  };

  const renderActiveTab = () => {
    const content = (() => {
      switch (activeTab) {
      case "subscription":
        return <SubscriptionSettingsForm />;
      case "general":
        return <GeneralSettingsForm />;
      case "team":
        return <TeamMembersSettings />;
      case "catalog":
        return <CatalogSettingsForm />;
      case "notifications":
        return <NotificationSettingsForm />;
      case "automations":
        return <AutomationsSettingsForm />;
      case "chat_templates":
        return <ChatTemplatesSettingsForm />;
      case "devices":
        return <DeviceSettingsForm />;
      case "appearance":
        return <BrandingSettingsForm />;
      case "integrations":
        return <IntegrationsSettings />;
      case "ai":
        return <AiSettingsForm />;
      case "security":
        return <SecuritySettingsForm />;
      case "database":
        return <DatabaseSettings />;
      default:
        return null;
      }
    })();

    if (!activeTab || canEditTab(activeTab)) {
      return content;
    }

    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 shadow-sm">
          <div className="flex items-start gap-3">
            <Lock className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-bold">Read-only company view</div>
              <p className="mt-1 leading-5">
                Your company admin has not granted edit access for this settings
                area. You can view the information, but changes are disabled.
              </p>
            </div>
          </div>
        </div>
        <div className="read-only-settings [&_button]:pointer-events-none [&_button]:opacity-70 [&_input]:pointer-events-none [&_input]:bg-zinc-50 [&_select]:pointer-events-none [&_select]:bg-zinc-50 [&_textarea]:pointer-events-none [&_textarea]:bg-zinc-50">
          {content}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white w-full">
      <div className="px-4 md:px-8 py-4 md:py-5 border-b border-zinc-200 flex items-center justify-between sticky top-0 bg-white z-10 shrink-0">
        <div className="flex items-center gap-3">
          {activeTab && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setActiveTab(null)}
              className="md:hidden -ml-2 text-zinc-500"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
          )}
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-zinc-900">
              {activeTab ? activeTabContext?.label : "Settings"}
            </h1>
            <p className="text-zinc-500 text-sm mt-1">
              {activeTab
                ? activeTabContext?.desc
                : "Manage your shop operating system"}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex bg-zinc-50/50">
        {/* Desktop Sidebar */}
        <div
          className={`hidden md:flex w-64 border-r border-zinc-200 bg-white flex-col h-full overflow-y-auto ${activeTab ? "flex shrink-0" : "hidden"}`}
        >
          <div className="p-4 flex flex-col gap-1">
            <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 px-2">
              Settings Menu
            </div>
            {SETTING_TABS.map((tab) => {
              const locked = !canEditTab(tab.id);
              return (
              <button
                key={tab.id}
                onClick={() => openTab(tab.id)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${activeTab === tab.id ? "bg-zinc-100 text-zinc-900" : locked ? "text-zinc-400 hover:bg-zinc-50" : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"}`}
              >
                <tab.icon
                  className={`w-4 h-4 ${activeTab === tab.id ? "text-zinc-900" : locked ? "text-zinc-300" : "text-zinc-500"}`}
                />
                <span className="flex-1">{tab.label}</span>
                {locked ? <Lock className="h-3.5 w-3.5 text-zinc-300" /> : null}
              </button>
              );
            })}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-24 md:pb-8">
          {!activeTab ? (
            <div className="max-w-5xl w-full mx-auto space-y-4 md:space-y-6">
              <div className="bg-white border border-zinc-200 p-5 rounded-2xl shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                      Billing Status
                    </p>
                    <h2 className="text-lg font-bold text-zinc-900 mt-1">
                      {profile?.subscriptionActive
                        ? "Subscription Active"
                        : "Subscription Required"}
                    </h2>
                    <p className="text-sm text-zinc-500 mt-2">
                      Status:{" "}
                      <span className="font-semibold text-zinc-700">
                        {profile?.subscriptionStatus || "inactive"}
                      </span>
                      {profile?.subscriptionPlan
                        ? ` • Plan: ${profile.subscriptionPlan}`
                        : ""}
                      {profile?.subscriptionInterval
                        ? ` • ${profile.subscriptionInterval}`
                        : ""}
                    </p>
                  </div>
                  <div
                    className={`rounded-full px-3 py-1 text-xs font-bold ${profile?.subscriptionActive ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}
                  >
                    {profile?.subscriptionActive ? "Active" : "Pending"}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 align-top">
                {SETTING_TABS.map((tab) => {
                  const locked = !canEditTab(tab.id);
                  return (
                  <div
                    key={tab.id}
                    onClick={() => openTab(tab.id)}
                    className={`bg-white border p-5 rounded-2xl shadow-sm transition-all group cursor-pointer ${locked ? "border-zinc-200 opacity-80 hover:border-zinc-300 hover:shadow-md" : "border-zinc-200 hover:shadow-md hover:border-zinc-300"}`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-colors ${locked ? "bg-zinc-100 text-zinc-400" : "bg-zinc-100 text-zinc-600 group-hover:bg-zinc-900 group-hover:text-white"}`}>
                      <tab.icon className="w-5 h-5" />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-semibold text-zinc-900">{tab.label}</h3>
                      {locked ? <Lock className="h-4 w-4 text-zinc-300" /> : null}
                    </div>
                    <p className="text-sm text-zinc-500 mt-1">{tab.desc}</p>
                  </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto md:mx-0 w-full min-h-full">
              {renderActiveTab()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
