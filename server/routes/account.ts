import { Router } from 'express';
import { collection, collectionGroup, addDoc, updateDoc, doc, serverTimestamp, getDocs, getDoc, query, orderBy, where, setDoc } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

export const accountRouter = Router();

import { getServerAuthPromise, getServerDb } from '../firebase.js';

const getDb = () => getServerDb();

function getFirebaseConfig() {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

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

function rankInviteCandidates(docs: any[], uid: string, email: string) {
  return docs
    .filter((candidate) => candidate.ref.path.startsWith("companies/"))
    .map((candidate) => {
      const [, companyId, , userDocId] = candidate.ref.path.split("/");
      const data = candidate.data();
      return { companyId, userDocId, data, ref: candidate.ref };
    })
    .filter((candidate) => candidate.companyId !== uid)
    .sort((a, b) => {
      const aScore =
        Number(a.userDocId === email) * 8 +
        Number(Boolean(a.data.invitedBy || a.data.invitedByEmail)) * 4 +
        Number(a.data.hasAccess !== false) * 2 +
        Number(Boolean(a.data.companyName));
      const bScore =
        Number(b.userDocId === email) * 8 +
        Number(Boolean(b.data.invitedBy || b.data.invitedByEmail)) * 4 +
        Number(b.data.hasAccess !== false) * 2 +
        Number(Boolean(b.data.companyName));
      return bScore - aScore;
    });
}

async function createEmailPasswordUser(email: string, password: string) {
  const firebaseConfig = getFirebaseConfig();
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseConfig.apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: false,
      }),
    },
  );
  const data = await response.json();
  if (!response.ok && data?.error?.message !== 'EMAIL_EXISTS') {
    throw new Error(data?.error?.message || 'Failed to create Firebase Auth user');
  }
  if (data?.error?.message === 'EMAIL_EXISTS') {
    return { uid: null, alreadyExists: true };
  }
  return { uid: data.localId as string, alreadyExists: false };
}

accountRouter.post('/api/team/invite', checkAuth, checkAdmin, async (req: any, res: any) => {
  try {
    const db = getDb();
    const adminId = req.user.uid;
    const email = String(req.body.email || '').trim().toLowerCase();
    const displayName = String(req.body.displayName || '').trim();
    const authMethod = req.body.authMethod === 'email_password'
      ? 'email_password'
      : req.body.authMethod === 'apple'
        ? 'apple'
        : 'google';
    const password = String(req.body.password || '');
    const companyId = String(req.body.companyId || req.headers['x-company-id'] || '').trim();
    const companyName = String(req.body.companyName || '').trim() || null;

    if (!companyId) return res.status(400).json({ error: 'Missing company ID' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }
    if (authMethod === 'email_password' && password.length < 8) {
      return res.status(400).json({ error: 'Temporary password must be at least 8 characters' });
    }

    let authUid: string | null = null;
    let alreadyExists = false;
    if (authMethod === 'email_password') {
      const created = await createEmailPasswordUser(email, password);
      authUid = created.uid;
      alreadyExists = created.alreadyExists;
    }

    const memberData = {
      uid: authUid,
      email,
      displayName: displayName || null,
      role: 'tech',
      permissions: ['tickets', 'customers', 'messages', 'tasks', 'invoices', 'inventory'],
      hasAccess: true,
      authMethod,
      companyId,
      companyName,
      invitedBy: adminId,
      invitedByEmail: req.headers['x-user-email'] || null,
      addedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(doc(db, 'companies', companyId, 'users', email), memberData, { merge: true });
    await setDoc(doc(db, 'team_invites', email), memberData, { merge: true });

    if (authUid) {
      await setDoc(doc(db, 'companies', companyId, 'users', authUid), {
        ...memberData,
        uid: authUid,
        linkedAt: serverTimestamp(),
      }, { merge: true });
      await setDoc(doc(db, 'users', authUid), {
        uid: authUid,
        email,
        displayName: displayName || null,
        companyId,
        companyName,
        role: 'tech',
        permissions: memberData.permissions,
        hasAccess: true,
        billingRequired: false,
        subscriptionActive: true,
        subscriptionStatus: 'active',
        subscriptionSource: 'company_invite',
        invitedBy: adminId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
    }

    await addDoc(collection(db, 'companies', companyId, 'audit_logs'), {
      action: 'TEAM_MEMBER_INVITED',
      actorUserId: adminId,
      targetEmail: email,
      authMethod,
      timestamp: serverTimestamp(),
    }).catch(() => {});

    res.json({ success: true, uid: authUid, alreadyExists, authMethod });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

accountRouter.post('/api/team/resolve-invite', checkAuth, async (req: any, res: any) => {
  try {
    await getServerAuthPromise();
    const db = getDb();
    const uid = String(req.user.uid || '').trim();
    const email = String(req.body.email || req.headers['x-user-email'] || '').trim().toLowerCase();
    const displayName = String(req.body.displayName || '').trim() || null;
    const photoURL = String(req.body.photoURL || '').trim() || null;

    if (!uid) return res.status(400).json({ error: 'Missing user ID' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    const snapshot = await getDocs(query(collectionGroup(db, 'users'), where('email', '==', email)));
    const invite = rankInviteCandidates(snapshot.docs, uid, email)[0];
    if (!invite) {
      return res.json({ found: false });
    }

    const companyId = invite.companyId;
    const inviteData = invite.data || {};
    const role = inviteData.role === 'admin' ? 'admin' : 'tech';
    const permissions = Array.isArray(inviteData.permissions)
      ? inviteData.permissions
      : ['tickets', 'customers', 'messages', 'tasks', 'invoices', 'inventory'];
    const companyName = inviteData.companyName || null;
    const hasAccess = inviteData.hasAccess !== false;

    const profile = {
      uid,
      email,
      displayName: displayName || inviteData.displayName || null,
      photoURL,
      companyId,
      companyName,
      role,
      permissions,
      hasAccess,
      billingRequired: false,
      subscriptionActive: true,
      subscriptionStatus: 'active',
      subscriptionSource: 'company_invite',
      invitedBy: inviteData.invitedBy || null,
      updatedAt: serverTimestamp(),
    };

    await Promise.all([
      setDoc(doc(db, 'users', uid), {
        ...profile,
        createdAt: serverTimestamp(),
      }, { merge: true }),
      setDoc(doc(db, 'companies', companyId, 'users', uid), {
        ...profile,
        linkedAt: serverTimestamp(),
      }, { merge: true }),
      setDoc(doc(db, 'companies', companyId, 'users', email), {
        uid,
        email,
        displayName: profile.displayName,
        photoURL,
        companyId,
        companyName,
        role,
        permissions,
        hasAccess,
        authMethod: inviteData.authMethod || 'google',
        linkedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true }),
      setDoc(doc(db, 'team_invites', email), {
        uid,
        email,
        displayName: profile.displayName,
        photoURL,
        companyId,
        companyName,
        role,
        permissions,
        hasAccess,
        authMethod: inviteData.authMethod || 'google',
        invitedBy: inviteData.invitedBy || null,
        linkedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true }),
    ]);

    res.json({
      found: true,
      profile: {
        companyId,
        companyName,
        role,
        permissions,
        hasAccess,
        billingRequired: false,
        subscriptionActive: true,
        subscriptionStatus: 'active',
        subscriptionSource: 'company_invite',
      },
    });
  } catch (error: any) {
    console.error('[team/resolve-invite] failed', error);
    res.status(500).json({ error: error.message || 'Failed to resolve invite' });
  }
});

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
    if (req.headers['x-user-role'] !== 'admin') {
      return res.status(403).json({ error: 'Team member accounts must be removed by their company admin' });
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
