import admin from 'firebase-admin';

try {
  admin.initializeApp();
  const db = admin.firestore();
  console.log('Firebase Admin initialized successfully');
} catch (e: any) {
  console.error('Firebase Admin initialization failed:', e.message);
}
process.exit(0);
