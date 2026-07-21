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
} from "lucide-react";
import { Button } from "@/components/ui/button";

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

  const SETTING_TABS = [
    {
      id: "subscription",
      icon: CreditCard,
      label: "My RepairSync Subscription",
      desc: "Billing, plan and payments",
    },
    {
      id: "general",
      icon: Settings,
      label: "General",
      desc: "Shop details, currency, timezone",
    },
    {
      id: "team",
      icon: Users,
      label: "Team",
      desc: "Manage technicians and staff roles",
    },
    {
      id: "catalog",
      icon: Database,
      label: "Catalogs & Suppliers",
      desc: "Manage products and suppliers",
    },
    {
      id: "notifications",
      icon: Bell,
      label: "Notifications",
      desc: "Email & SMS alerts",
    },
    {
      id: "automations",
      icon: Workflow,
      label: "Automations",
      desc: "Trigger SMS on status change",
    },
    {
      id: "chat_templates",
      icon: MessageSquareDashed,
      label: "Message Templates",
      desc: "Manage SMS fast replies & templates",
    },
    {
      id: "devices",
      icon: Database,
      label: "Device Inventory",
      desc: "Manage brands and device models",
    },
    {
      id: "appearance",
      icon: Palette,
      label: "Appearance",
      desc: "Theme and branding",
    },
    {
      id: "integrations",
      icon: LinkIcon,
      label: "Integrations",
      desc: "Xero, Zoho, RepairShopr",
    },
    {
      id: "ai",
      icon: Zap,
      label: "AI Features",
      desc: "Configure GenAI diagnostics",
    },
    {
      id: "security",
      icon: Shield,
      label: "Security",
      desc: "Active sessions and Deletion Requests",
    },
    {
      id: "database",
      icon: Database,
      label: "Data",
      desc: "Exports and backups",
    },
  ];

  const activeTabContext = SETTING_TABS.find((t) => t.id === activeTab);

  const renderActiveTab = () => {
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
            {SETTING_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${activeTab === tab.id ? "bg-zinc-100 text-zinc-900" : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"}`}
              >
                <tab.icon
                  className={`w-4 h-4 ${activeTab === tab.id ? "text-zinc-900" : "text-zinc-500"}`}
                />
                {tab.label}
              </button>
            ))}
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
                {SETTING_TABS.map((tab) => (
                  <div
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className="bg-white border border-zinc-200 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer hover:border-zinc-300 group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-600 mb-4 group-hover:bg-zinc-900 group-hover:text-white transition-colors">
                      <tab.icon className="w-5 h-5" />
                    </div>
                    <h3 className="font-semibold text-zinc-900">{tab.label}</h3>
                    <p className="text-sm text-zinc-500 mt-1">{tab.desc}</p>
                  </div>
                ))}
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
