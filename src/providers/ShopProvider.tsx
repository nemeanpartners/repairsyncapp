import React, { createContext, useContext, useEffect, useState } from "react";
import { 
  collection, 
  query, 
  onSnapshot, 
  orderBy, 
  limit, 
  where,
  getDoc,
  doc
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "./AuthProvider";
import { Customer, ConversationMetadata } from "../types";
import { RealtimeManager } from "../services/RealtimeManager";
import { CostAnalyticsEngine } from "../services/CostAnalyticsEngine";

interface ShopContextType {
  customers: Customer[];
  unreadCount: number;
  settings: any;
  loading: boolean;
}

const ShopContext = createContext<ShopContextType | undefined>(undefined);

export function ShopProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [settings, setSettings] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    // Unread messages count - specific optimized listener
    const unreadQuery = query(
      collection(db, "conversations"), 
      where("isUnread", "==", true),
      where("isArchived", "==", false)
    );
    const unsubUnread = RealtimeManager.subscribe("global_unread_conversations", unreadQuery, (data) => {
      setUnreadCount(data ? data.length : 0);
    });

    // Global Shop Settings
    const fetchSettings = async () => {
      try {
        const orgDoc = await getDoc(doc(db, "settings", "organization"));
        CostAnalyticsEngine.recordReads("settings_organization", 1);
        if (orgDoc.exists()) {
           setSettings(prev => ({ ...prev, organization: orgDoc.data() }));
        }
      } catch (err) {
        console.error("Failed to fetch organization settings in ShopProvider:", err);
      }
    };
    fetchSettings();

    setLoading(false);

    return () => {
      unsubUnread();
    };
  }, [user]);

  return (
    <ShopContext.Provider value={{ customers: [], unreadCount, settings, loading }}>
      {children}
    </ShopContext.Provider>
  );
}

export function useShop() {
  const context = useContext(ShopContext);
  if (context === undefined) {
    throw new Error("useShop must be used within a ShopProvider");
  }
  return context;
}
