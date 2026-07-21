import { useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, limit, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'sonner';
import { useAuth } from '../providers/AuthProvider';

export function useNotifications() {
  const { user } = useAuth();
  const isInitialMount = useRef(true);
  const lastSeenTime = useRef<number>(Date.now());

  useEffect(() => {
    if (!user) return;
    
    // Only fetch notifications created after we mounted, to avoid spam
    
    // Instead of using 'created_at > now', we can use orderby desc limit 1 on mount
    // and then listen to any newer ones. 
    // Wait, simple onSnapshot with limit 5 ordered by createdAt desc and compare dates is easier.

    const q = query(
      collection(db, "notifications"),
      orderBy("createdAt", "desc"),
      limit(5)
    );

    const unsub = onSnapshot(q, (snap) => {
      snap.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          const createdAt = data.createdAt?.toDate ? data.createdAt.toDate().getTime() : 0;
          
          if (!isInitialMount.current && createdAt > lastSeenTime.current) {
            // New notification!
            if (data.type === 'sms_approved') {
               toast.success(data.title, { description: data.message });
            } else if (data.type === 'sms_rejected') {
               toast.error(data.title, { description: data.message });
            } else {
               toast(data.title, { description: data.message });
            }
            lastSeenTime.current = Math.max(lastSeenTime.current, createdAt);
          }
        }
      });
      isInitialMount.current = false;
    }, (error) => {
      console.error("Notifications query listener failed:", error);
    });

    return () => unsub();
  }, []);
}
