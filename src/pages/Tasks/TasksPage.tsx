import React, { useEffect, useState } from "react";
import {
  collection,
  query,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  limit,
  orderBy,
} from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../providers/AuthProvider";
import { TasksView } from "../../components/TasksView";
import { useNavigate } from "react-router-dom";

export function TasksPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const { user } = useAuth();
  const [customers, setCustomers] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "tasks"), limit(2000)),
      (snap) => {
        setTasks(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (error) => {
        console.error("TasksPage tasks snap error:", error);
      },
    );

    const unsubCustomers = onSnapshot(
      query(collection(db, "crm_customers"), limit(2000)),
      (snap) => {
        setCustomers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (error) => {
        console.error("TasksPage customers snap error:", error);
      },
    );

    const unsubCategories = onSnapshot(
      query(collection(db, "task_categories")),
      (snap) => {
        setCategories(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }) as any)
            .sort((a: any, b: any) =>
              (a.name || "").localeCompare(b.name || ""),
            ),
        );
        setIsLoadingCategories(false);
      },
      (error) => {
        console.error("TasksPage categories snap error:", error);
        setIsLoadingCategories(false);
      },
    );

    return () => {
      unsub();
      unsubCustomers();
      unsubCategories();
    };
  }, []);

  const createTask = async (payload: any) => {
    const id = crypto.randomUUID();
    await setDoc(doc(db, "tasks", id), {
      ...payload,
      createdAt: new Date().toISOString(),
    });
  };

  const updateTask = async (id: string, updates: any) => {
    await updateDoc(doc(db, "tasks", id), updates);
  };

  const deleteTask = async (id: string) => {
    await deleteDoc(doc(db, "tasks", id));
  };

  const createCategory = async (name: string) => {
    const id = crypto.randomUUID();
    await setDoc(doc(db, "task_categories", id), {
      name,
      createdAt: new Date().toISOString(),
    });
  };

  const deleteCategory = async (id: string) => {
    await deleteDoc(doc(db, "task_categories", id));
  };

  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [tickets, setTickets] = useState<any[]>([]);

  const fetchTickets = async (customerId: string) => {
    const { getDocs, query, collection, where } =
      await import("firebase/firestore");
    const q = query(
      collection(db, "crm_tickets"),
      where("customer_id", "==", customerId),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  };

  const handleNavigate = (v: string) => {
    navigate(v);
  };

  return (
    <TasksView
      tasks={tasks}
      user={user}
      createTask={createTask}
      updateTask={updateTask}
      deleteTask={deleteTask}
      customers={customers}
      fetchTickets={fetchTickets}
      setSelectedCustomer={setSelectedCustomer}
      setSelectedTicket={setSelectedTicket}
      setTickets={setTickets}
      handleNavigate={handleNavigate}
      categories={categories}
      isLoadingCategories={isLoadingCategories}
      createCategory={createCategory}
      deleteCategory={deleteCategory}
    />
  );
}
