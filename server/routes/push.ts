import { Router } from 'express';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getDb } from '../utils/firebase.js';

export const pushRouter = Router();

pushRouter.post('/api/push/register', async (req, res) => {
  try {
    const { token, platform, email, userId } = req.body ?? {};

    if (typeof token !== 'string' || token.trim().length < 16) {
      return res.status(400).json({ error: 'Missing or invalid push token.' });
    }

    const normalizedPlatform =
      platform === 'ios' || platform === 'android' || platform === 'web'
        ? platform
        : 'unknown';

    const db = getDb();
    const tokenId = Buffer.from(`${normalizedPlatform}:${token}`, 'utf8').toString('base64url');

    await setDoc(
      doc(db, 'push_tokens', tokenId),
      {
        token,
        platform: normalizedPlatform,
        email: typeof email === 'string' ? email : null,
        userId: typeof userId === 'string' ? userId : null,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      },
      { merge: true },
    );

    return res.json({ success: true, id: tokenId });
  } catch (error: any) {
    console.error('Push token registration failed:', error);
    return res.status(500).json({ error: error.message || 'Push token registration failed.' });
  }
});
