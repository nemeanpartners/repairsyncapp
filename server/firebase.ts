import { getApp, getApps, initializeApp } from "firebase/app";
import { getFirestore, initializeFirestore } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import fs from "fs";
import path from "path";

let _db: any = null;
let _authPromise: Promise<any> | null = null;

export function getServerAuthPromise() {
  getServerDb(); // Ensure initialization
  return _authPromise;
}

export function getServerDb() {
  if (_db) return _db;

  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (!fs.existsSync(configPath)) {
    throw new Error("Missing config");
  }
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const apps = getApps();
  const app = apps.length === 0 ? initializeApp(config) : getApp();

  if (!_authPromise) {
    const auth = getAuth(app);
    _authPromise = signInWithEmailAndPassword(auth, "server_admin@phonemedic.au", "ServerSecure123!")
      .then(() => console.log("[Firebase Server Auth] Logged in as server_admin"))
      .catch(e => console.error("[Firebase Server Auth] Failed to login:", e.message));
  }

  try {
    _db = initializeFirestore(app, {
      experimentalForceLongPolling: true
    }, config.firestoreDatabaseId || undefined);
  } catch (err: any) {
    if (err.message && err.message.includes('already been configured')) {
      _db = getFirestore(app, config.firestoreDatabaseId || undefined);
    } else {
      throw err;
    }
  }

  return _db;
}
