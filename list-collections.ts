
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getFirestore, collection, getDocs, limit, query } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = getApps().length === 0 ? initializeApp(config) : getApp();
const db = getFirestore(app, config.firestoreDatabaseId);

const collections = [
  'messages', 'conversations', 'crm_customers', 'crm_tickets', 
  'sms', 'sms_messages', 'sms_log', 'inbox', 'comms', 
  'communications', 'logs', 'entries', 'chats', 'team_chat',
  'users', 'tasks', 'shifts', 'leads', 'calls', 'call_logs'
];

async function run() {
  console.log("Checking collections in:", config.firestoreDatabaseId);
  for (const c of collections) {
    try {
      const s = await getDocs(query(collection(db, c), limit(1)));
      if (!s.empty) {
        console.log(`[FOUND] ${c}`);
      }
    } catch (e: any) {
      // Ignored
    }
  }
}
run();
