import { serverTimestamp, runTransaction, doc } from 'firebase/firestore';
import { getDb } from '../../utils/firebase.js';
import { normalizePhone } from '../../utils/phone.js';

export async function updateConversationMetadata(
  customerId: any,
  phone: string,
  customerName: any,
  ticketNumber: any,
  direction: 'inbound' | 'outbound',
  text: string,
  messageEventId?: string
) {
  const db = getDb();
  if (!db) return;
  try {
    const threadId = normalizePhone(phone);
    if (!threadId) return;

    const convRef = doc(db, 'conversations', threadId);
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(convRef);
      const currentLabels = snap.exists() ? (snap.data().labels || []) : [];
      let updatedLabels = [...currentLabels];
      const isInbound = direction === 'inbound';
      
      let newUnreadCount = snap.exists() ? (snap.data().unreadCount || 0) : 0;
      if (isInbound) {
        newUnreadCount += 1;
      }

      if (isInbound) {
        // System application: check if we should reapply 'your_turn'
        let shouldReapply = true;
        const existingYourTurn = updatedLabels.find((l: any) => l.label === 'your_turn');
        
        if (existingYourTurn && existingYourTurn.dismissed) {
           shouldReapply = false;
           if (existingYourTurn.snoozeUntil) {
             if (new Date() >= new Date(existingYourTurn.snoozeUntil)) {
               shouldReapply = true;
             }
           }
           if (existingYourTurn.reapplyAfterEventId && messageEventId && existingYourTurn.reapplyAfterEventId !== messageEventId) {
             shouldReapply = true;
           }
           // If they just got a new message and didn't snooze, we definitely want to reapply
           // UNLESS reapplyAfterEventId explicitly gates it.
           if (!existingYourTurn.snoozeUntil && !existingYourTurn.reapplyAfterEventId) {
             shouldReapply = true; // standard behaviour: new message = your turn
           }
        }

        if (shouldReapply) {
          updatedLabels = [
            ...updatedLabels.filter((l: any) => l.label !== 'your_turn'),
            {
              label: 'your_turn',
              source: 'system',
              dismissed: false,
              dismissedAt: null,
              dismissedBy: null,
              snoozeUntil: null,
              reapplyAfterEventId: null
            }
          ];
        }
      } else {
        // Outbound dismisses 'your_turn'
        updatedLabels = updatedLabels.map((l: any) => {
          if (l.label === 'your_turn') {
            return {
              ...l,
              dismissed: true,
              dismissedAt: new Date().toISOString(),
              dismissedBy: 'system',
              reapplyAfterEventId: messageEventId || null // Will reapply on NEXT event
            };
          }
          return l;
        });
        if (!updatedLabels.some((l: any) => l.label === 'your_turn')) {
          updatedLabels.push({
            label: 'your_turn',
            source: 'system',
            dismissed: true,
            dismissedAt: new Date().toISOString(),
            dismissedBy: 'system',
            reapplyAfterEventId: messageEventId || null
          });
        }
      }

      const isYourTurnActive = updatedLabels.some((l: any) => l.label === 'your_turn' && !l.dismissed);

      const convData = {
        conversationId: threadId,
        customerId: customerId || null,
        customerName: customerName || (snap.exists() ? (snap.data().customerName || 'Unknown') : 'Unknown'),
        phone: phone,
        lastMessageAt: serverTimestamp(),
        lastMessagePreview: text.substring(0, 100),
        lastMessageDirection: direction,
        unreadCount: direction === 'outbound' ? 0 : newUnreadCount,
        labels: updatedLabels,
        updatedAt: serverTimestamp(),
        isUnread: isInbound || (snap.exists() ? (snap.data().isUnread ?? false) : false),
        isYourTurn: isYourTurnActive,
        isUrgent: snap.exists() ? (snap.data().isUrgent ?? false) : false,
        isArchived: snap.exists() ? (snap.data().isArchived ?? false) : false,
        ticketNumber: ticketNumber || (snap.exists() ? (snap.data().ticketNumber || null) : null),
        uid: 'api-server'
      };

      if (!snap.exists()) {
        transaction.set(convRef, convData);
      } else {
        transaction.update(convRef, convData);
      }
    });

    if (direction === 'inbound') {
      const globalRef = doc(db, 'system_state', 'notifications');
      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(globalRef);
        if (!snap.exists()) {
          transaction.set(globalRef, { unreadSmsCount: 1, uid: 'api-server' });
        } else {
          transaction.update(globalRef, { unreadSmsCount: (snap.data().unreadSmsCount || 0) + 1, uid: 'api-server' });
        }
      });
    }
  } catch (e) {
    console.error('[SMS Service] Metadata update failed:', e);
  }
}
