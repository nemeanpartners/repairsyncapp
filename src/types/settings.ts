import { z } from "zod";

export const GeneralSettingsSchema = z.object({
  shopName: z.string().min(2, "Shop name must be at least 2 characters"),
  supportEmail: z.string().email("Invalid email address"),
  businessPhone: z.string().min(5, "Phone number is required"),
  address: z.string().min(5, "Address is required"),
  timezone: z.string().min(1, "Timezone is required"),
  currency: z.string().min(1, "Currency is required"),
});
export type GeneralSettings = z.infer<typeof GeneralSettingsSchema>;

export const NotificationSettingsSchema = z.object({
  emailAlerts: z.boolean(),
  smsAlerts: z.boolean(),
  notifyNewTickets: z.boolean(),
  notifyPartsArrived: z.boolean(),
});
export type NotificationSettings = z.infer<typeof NotificationSettingsSchema>;

export const BrandingSettingsSchema = z.object({
  theme: z.enum(['Light', 'Dark', 'System']),
});
export type BrandingSettings = z.infer<typeof BrandingSettingsSchema>;

export const AiSettingsSchema = z.object({
  geminiApiKey: z.string().optional(),
  autoSuggestDiagnostics: z.boolean(),
});
export type AiSettings = z.infer<typeof AiSettingsSchema>;

export const SecuritySettingsSchema = z.object({
  require2FA: z.boolean(),
});
export type SecuritySettings = z.infer<typeof SecuritySettingsSchema>;

export interface ChatTemplate {
  id: string;
  text: string;
}

export interface SmsTemplate {
  status: string;
  message: string;
  enabled: boolean;
}

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Technician' | 'Front Desk';
  createdAt?: string;
}

export const IntegrationsSettingsSchema = z.object({
  rcsEnabled: z.boolean().default(false),
  twilioAccountSid: z.string().optional(),
  twilioAuthToken: z.string().optional(),
  twilioPhoneNumber: z.string().optional(),
});
export type IntegrationsSettings = z.infer<typeof IntegrationsSettingsSchema>;

export interface DeviceBrandModel {
  name: string;
  models: string[];
}

export const DeviceSettingsSchema = z.object({
  brands: z.array(z.object({
    name: z.string(),
    models: z.array(z.string())
  })).default([])
});
export type DeviceSettings = z.infer<typeof DeviceSettingsSchema>;

export interface AppSettings {
  general: GeneralSettings;
  notifications: NotificationSettings;
  branding: BrandingSettings;
  ai: AiSettings;
  security: SecuritySettings;
  integrations: IntegrationsSettings;
  devices: DeviceSettings;
}
