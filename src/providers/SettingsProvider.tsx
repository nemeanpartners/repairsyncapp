import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc, onSnapshot, updateDoc, collection } from 'firebase/firestore';
import { 
  GeneralSettings, NotificationSettings, BrandingSettings, 
  AiSettings, SecuritySettings, AppSettings 
} from '../types/settings';
import { toast } from 'sonner';
import { useAuth } from './AuthProvider';

interface SettingsContextType {
  settings: AppSettings | null;
  loading: boolean;
  updateSettings: <K extends keyof AppSettings>(section: K, data: Partial<AppSettings[K]>) => Promise<void>;
  orgId: string;
}

const DEFAULT_ORG_ID = 'default';

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const DEFAULT_SETTINGS: AppSettings = {
  general: {
    shopName: 'PhoneMedic Repairs',
    supportEmail: 'support@phonemedic.au',
    businessPhone: '0400 000 000',
    address: '123 Repair St, Tech City',
    timezone: 'Australia/Sydney',
    currency: 'AUD ($)'
  },
  notifications: {
    emailAlerts: true,
    smsAlerts: true,
    notifyNewTickets: true,
    notifyPartsArrived: true
  },
  branding: {
    theme: 'System'
  },
  ai: {
    geminiApiKey: '',
    autoSuggestDiagnostics: true
  },
  security: {
    require2FA: false
  },
  integrations: {
    rcsEnabled: false
  },
  devices: {
    brands: [
      { name: 'Apple', models: ['iPhone 12', 'iPhone 13', 'iPhone 14', 'iPhone 15'] },
      { name: 'Samsung', models: ['Galaxy S22', 'Galaxy S23', 'Galaxy S24'] },
      { name: 'Google', models: ['Pixel 7', 'Pixel 8'] }
    ]
  }
};

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const orgId = DEFAULT_ORG_ID;

  useEffect(() => {
    if (!user) {
      setSettings(DEFAULT_SETTINGS);
      setLoading(false);
      return;
    }

    // Listen to settings changes in real-time
    const sections: Array<keyof AppSettings> = ['general', 'notifications', 'branding', 'ai', 'security', 'integrations', 'devices'];
    
    // Deep clone defaults to prevent any property access crashes during mount or loading
    const currentSettings: AppSettings = {
      general: { ...DEFAULT_SETTINGS.general },
      notifications: { ...DEFAULT_SETTINGS.notifications },
      branding: { ...DEFAULT_SETTINGS.branding },
      ai: { ...DEFAULT_SETTINGS.ai },
      security: { ...DEFAULT_SETTINGS.security },
      integrations: { ...DEFAULT_SETTINGS.integrations },
      devices: { ...DEFAULT_SETTINGS.devices }
    };
    let initializedSections = 0;

    const unsubs = sections.map(section => {
      const docRef = doc(db, 'organizations', orgId, 'settings', section);
      
      return onSnapshot(docRef, (snapshot) => {
        if (snapshot.exists()) {
          currentSettings[section] = {
            ...DEFAULT_SETTINGS[section],
            ...snapshot.data()
          } as any;
        } else {
          // If section does not exist, initialize it with defaults
          currentSettings[section] = DEFAULT_SETTINGS[section] as any;
          setDoc(docRef, DEFAULT_SETTINGS[section], { merge: true }).catch(console.error);
        }
        
        initializedSections++;
        // Update state with a complete object
        setSettings({ ...currentSettings });
        if (initializedSections >= sections.length) {
          setLoading(false);
        }
      }, (err) => {
        console.error(`Error listening to settings/${section}:`, err);
        // Fallback for this section is already pre-populated, just increment
        initializedSections++;
        setSettings({ ...currentSettings });
        if (initializedSections >= sections.length) {
          setLoading(false);
        }
      });
    });

    return () => {
      unsubs.forEach(unsub => unsub());
    };
  }, [orgId]);

  const updateSettings = async <K extends keyof AppSettings>(section: K, data: Partial<AppSettings[K]>) => {
    try {
      const docRef = doc(db, 'organizations', orgId, 'settings', section);
      // Optimistic update
      setSettings(prev => prev ? {
        ...prev,
        [section]: { ...prev[section], ...data }
      } : null);
      
      await setDoc(docRef, data, { merge: true });

      // Audit log entry
      const auditRef = doc(collection(db, 'organizations', orgId, 'audit_logs'));
      await setDoc(auditRef, {
        action: 'UPDATE_SETTINGS',
        section,
        changes: data,
        timestamp: new Date().toISOString()
      }).catch(err => console.error("Failed to write audit log:", err));

    } catch (e) {
      console.error("Failed to update settings", e);
      toast.error(`Failed to update ${section} settings`);
      throw e;
    }
  };

  return (
    <SettingsContext.Provider value={{ settings, loading, updateSettings, orgId }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
