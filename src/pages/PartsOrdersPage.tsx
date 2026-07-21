import React, { useState, useEffect } from "react";
import { collection, query, onSnapshot, orderBy, limit } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../providers/AuthProvider";
import { PartsOrdersView, PartsOrder } from "../components/PartsOrdersView";

export function PartsOrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<PartsOrder[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "parts_orders"), orderBy("createdAt", "desc"), limit(1000));
    const unsub = onSnapshot(q, (snap) => {
      setOrders(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PartsOrder)));
    }, (error) => {
      console.error("PartsOrdersPage load orders snap error:", error);
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "crm_tickets"), orderBy("created_at", "desc"), limit(2000));
    const unsub = onSnapshot(q, (snap) => {
      setTickets(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error("PartsOrdersPage load tickets snap error:", error);
    });
    return () => unsub();
  }, [user]);

  return (
    <div className="h-full w-full">
      <PartsOrdersView orders={orders} currentUserUid={user?.uid || ""} tickets={tickets} />
    </div>
  );
}
