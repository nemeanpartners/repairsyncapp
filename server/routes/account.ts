import { Router } from 'express';
import { getFirestore, collection, addDoc, updateDoc, doc, serverTimestamp, getDocs, getDoc, query, orderBy, where } from 'firebase/firestore';

export const accountRouter = Router();

import { getServerDb } from '../firebase.js';

const getDb = () => getServerDb();

// Helper to simulate authentication token decoding (since this is client sdk admin hybrid)
// For a real app with Firebase Admin, you would use admin.auth().verifyIdToken()
const checkAuth = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  // Simplification for the hybrid preview sandbox.
  // We assume the frontend passes the UID in an X-User-Id header for now as a makeshift auth
  const userId = req.headers['x-user-id'];
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.user = { uid: userId };
  next();
};

const checkAdmin = (req: any, res: any, next: any) => {
  // Simplification: In a real app check role from Firestore or Custom Claims
  const role = req.headers['x-user-role'];
  if (role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
};

// 1. Request Account Deletion
accountRouter.post('/api/account/delete-request', checkAuth, async (req: any, res: any) => {
  try {
    const db = getDb();
    const { reason, email } = req.body;
    const userId = req.user.uid;
    
    // Prevent guest accounts from requesting deletion
    const isGuest = req.headers['x-is-guest'] === 'true';
    if (isGuest) {
      return res.status(403).json({ error: 'Guest accounts cannot request deletion' });
    }

    const requestRef = await addDoc(collection(db, 'accountDeletionRequests'), {
      userId,
      email: email || 'unknown@user.com',
      tenantId: 'default',
      requestedAt: serverTimestamp(),
      requestedBy: userId,
      reason: reason || '',
      status: 'pending'
    });

    await addDoc(collection(db, 'auditLogs'), {
      action: 'deletion_requested',
      actorUserId: userId,
      targetUserId: userId,
      tenantId: 'default',
      timestamp: serverTimestamp(),
      metadata: { reason, requestId: requestRef.id }
    });

    res.json({ success: true, requestId: requestRef.id });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Cancel Deletion Request
accountRouter.post('/api/account/delete-request/cancel', checkAuth, async (req: any, res: any) => {
  try {
    const db = getDb();
    const userId = req.user.uid;
    
    const q = query(collection(db, 'accountDeletionRequests'), where('userId', '==', userId), where('status', '==', 'pending'));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return res.status(404).json({ error: 'No pending request found' });
    }

    const requestDoc = snapshot.docs[0];
    await updateDoc(doc(db, 'accountDeletionRequests', requestDoc.id), {
      status: 'cancelled'
    });

    await addDoc(collection(db, 'auditLogs'), {
      action: 'deletion_cancelled',
      actorUserId: userId,
      targetUserId: userId,
      tenantId: 'default',
      timestamp: serverTimestamp(),
      metadata: { requestId: requestDoc.id }
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Admin: View Pending Requests
accountRouter.get('/api/admin/account-deletion-requests', checkAuth, checkAdmin, async (req: any, res: any) => {
  try {
    const db = getDb();
    const q = query(collection(db, 'accountDeletionRequests'), orderBy('requestedAt', 'desc'));
    const snapshot = await getDocs(q);
    
    const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ requests });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Admin: Approve Deletion
accountRouter.post('/api/admin/account-deletion-requests/:id/approve', checkAuth, checkAdmin, async (req: any, res: any) => {
  try {
    const db = getDb();
    const requestId = req.params.id;
    const { adminNotes } = req.body;
    const adminId = req.user.uid;

    const requestRef = doc(db, 'accountDeletionRequests', requestId);
    const requestSnap = await getDoc(requestRef);
    if (!requestSnap.exists()) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const requestData = requestSnap.data();

    // 1. Mark request as approved
    await updateDoc(requestRef, {
      status: 'approved',
      reviewedBy: adminId,
      reviewedAt: serverTimestamp(),
      adminNotes: adminNotes || ''
    });

    // 2. Anonymize user records/disable access (Mocking this due to client-sdk limitations)
    // In a real app we'd use admin.auth().deleteUser()
    const targetUserId = requestData.userId;
    
    await updateDoc(doc(db, 'users', targetUserId), {
      hasAccess: false,
      accountDeletionStatus: 'approved',
      email: `deleted_${targetUserId}@anonymized.app`,
      displayName: 'Deleted User'
    });

    await addDoc(collection(db, 'auditLogs'), {
      action: 'deletion_approved',
      actorUserId: adminId,
      targetUserId,
      tenantId: requestData.tenantId || 'default',
      timestamp: serverTimestamp(),
      metadata: { requestId, adminNotes }
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Admin: Reject Deletion
accountRouter.post('/api/admin/account-deletion-requests/:id/reject', checkAuth, checkAdmin, async (req: any, res: any) => {
  try {
    const db = getDb();
    const requestId = req.params.id;
    const { adminNotes } = req.body;
    const adminId = req.user.uid;

    const requestRef = doc(db, 'accountDeletionRequests', requestId);
    const requestSnap = await getDoc(requestRef);
    
    if (!requestSnap.exists()) {
      return res.status(404).json({ error: 'Request not found' });
    }

    await updateDoc(requestRef, {
      status: 'rejected',
      reviewedBy: adminId,
      reviewedAt: serverTimestamp(),
      adminNotes: adminNotes || ''
    });

    const targetUserId = requestSnap.data().userId;

    await addDoc(collection(db, 'auditLogs'), {
      action: 'deletion_rejected',
      actorUserId: adminId,
      targetUserId,
      tenantId: 'default',
      timestamp: serverTimestamp(),
      metadata: { requestId, adminNotes }
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
