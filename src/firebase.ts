import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, initializeFirestore, persistentLocalCache, setLogLevel } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';

setLogLevel('silent');

const app = initializeApp(firebaseConfig);
function initializeRepairSyncFirestore() {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache(),
      experimentalAutoDetectLongPolling: true,
    }, firebaseConfig.firestoreDatabaseId);
  } catch (error) {
    console.warn("RepairSync persistent Firestore cache unavailable; falling back to memory cache.", error);
    try {
      return initializeFirestore(app, {
        experimentalAutoDetectLongPolling: true,
      }, firebaseConfig.firestoreDatabaseId);
    } catch {
      return getFirestore(app, firebaseConfig.firestoreDatabaseId);
    }
  }
}

export const db = initializeRepairSyncFirestore();

export const auth = getAuth(app);
export const storage = getStorage(app);



