import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, initializeFirestore, doc, setDoc as firestoreSetDoc, getDoc, getDocs, updateDoc as firestoreUpdateDoc, collection, addDoc as firestoreAddDoc, where, query, serverTimestamp, arrayUnion, limit, startAfter, runTransaction, setLogLevel } from 'firebase/firestore';
import { getServerDb, getServerAuthPromise } from './server/firebase.js';
import { searchRouter } from './server/routes/search.js';
import { botRouter } from './server/routes/bot.js';
import { messagingRouter } from './server/routes/messaging.js';
import { xeroRouter } from './server/routes/xero.js';
import { mobileMessageRouter } from './server/routes/mobilemessage.js';
import { maxotelRouter } from './server/routes/maxotel.js';
import { zohoRouter } from './server/routes/zoho.js';
import { debugRouter } from './server/routes/debug.js';
import { repairshoprRouter } from './server/routes/repairshopr.js';
import { aiRouter } from './server/routes/ai.js';
import { accountRouter } from './server/routes/account.js';
import { scanRouter } from './server/routes/scan.js';
import { pushRouter } from './server/routes/push.js';
import { billingRouter } from './server/routes/billing.js';
import { initXeroEngine } from './server/services/xero.js';
import { WorkerEngine } from './server/services/workerEngine.js';


async function addDoc(colRef: any, data: any) { return firestoreAddDoc(colRef, { uid: 'api-server', ...data }); }
async function setDoc(docRef: any, data: any, options: any = {}) { return firestoreSetDoc(docRef, { uid: 'api-server', ...data }, options); }
async function updateDoc(docRef: any, data: any) { return firestoreUpdateDoc(docRef, { uid: 'api-server', ...data }); }

import { writeBatch as firestoreWriteBatch } from 'firebase/firestore';
function writeBatch(dbInstance: any) {
  const batch = firestoreWriteBatch(dbInstance);
  const originalSet = batch.set.bind(batch);
  batch.set = (ref: any, data: any, options?: any) => originalSet(ref, { uid: 'api-server', ...data }, options || {});
  const originalUpdate = batch.update.bind(batch);
  batch.update = (ref: any, data: any) => originalUpdate(ref, { uid: 'api-server', ...data });
  return batch;
}



// Initialize Firebase Admin
const firebaseConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
let db: any;

console.log(`[${new Date().toISOString()}] Environment Check: ZOHO_CLIENT_ID starts with ${process.env.ZOHO_CLIENT_ID?.substring(0, 15)}`);

if (fs.existsSync(firebaseConfigPath)) {
  const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
  
  // Suppress verbose gRPC errors
  setLogLevel('silent');

  // Use Client SDK with API Key to bypass IAM limitations, relying on open security rules
  db = getServerDb();
  
  // Initialize Xero Sync Engine
  const xeroSyncEngine = initXeroEngine(db);
  
  // Start the background polling for Xero sync operations (every 1 minute)
  setInterval(() => {
    xeroSyncEngine.processQueue().catch(console.error);
  }, 60 * 1000);
  
  // Start the CRON worker for evaluating hire contracts (every 1 hour)
  setInterval(() => {
    xeroSyncEngine.processHireContracts().catch(console.error);
  }, 60 * 60 * 1000);

  // Immediately run on boot
  setTimeout(() => {
    xeroSyncEngine.processHireContracts().catch(console.error);
  }, 5000);
  
  console.log(`Firebase Client SDK initialized for Server at ${new Date().toISOString()}. Project: ${firebaseConfig.projectId}. DB ID: ${firebaseConfig.firestoreDatabaseId || '(default)'}`);
} else {
  console.error("Firebase config missing");
  process.exit(1);
}

import { updateConversationMetadata } from './server/services/messaging.js';

// Helper to add private note to RepairShopr ticket
async function addRepairShoprTicketNote(ticketId: string, message: string, type: 'Inbound' | 'Outbound') {
  try {
    const subdomain = process.env.REPAIRSHOPR_SUBDOMAIN;
    const apiKey = process.env.REPAIRSHOPR_API_KEY;
    if (!subdomain || !apiKey) return;

    await axios.post(`https://${subdomain}.repairshopr.com/api/v1/tickets/${ticketId}/comments`, {
      subject: `SMS ${type}`,
      body: `[SMS ${type}] ${message}`,
      hidden: true // This makes it a private note
    }, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    console.log(`Private note added to RepairShopr ticket ${ticketId}`);
  } catch (error: any) {
    console.error('Error adding Private Note to RepairShopr:', error.response?.data || error.message);
  }
}



// Add Axios interceptor for exponential backoff on 429 errors
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    if (!config) return Promise.reject(error);

    config.retryCount = config.retryCount || 0;
    
    // Check if error is a 429
    if (error.response?.status === 429 && config.retryCount < 4) {
      config.retryCount += 1;
      
      const delay = Math.pow(2, config.retryCount - 1) * 1000 + Math.random() * 500;
      console.log(`[Rate Limit] Hit 429. Retrying in ${Math.round(delay)}ms (Attempt ${config.retryCount}/4) for ${config.url}`);
      
      await new Promise((resolve) => setTimeout(resolve, delay));
      return axios(config);
    }
    
    return Promise.reject(error);
  }
);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Immediate health check for platform readiness
  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

  app.use((req, res, next) => {
    if (req.path.includes('webhook')) {
      const log = `[${new Date().toISOString()}] ${req.method} ${req.path} ${JSON.stringify(req.query)} ${JSON.stringify(req.body)}\n`;
      fs.appendFileSync('webhook_traffic.log', log);
    }
    next();
  });

  // Global Guest interceptor
  app.use('/api', (req, res, next) => {
    if (req.headers['x-is-guest'] === 'true') {
      const allowedMockRoutes = ['/api/ai/triage', '/api/ai/notes', '/api/ai/draft-message'];
      if (allowedMockRoutes.includes(req.path)) {
         // Proceed to the AI route but attach a mock flag so it doesn't use the API key
         (req as any).isGuestMock = true;
      }
      
      const dangerousRoutes = [
         '/api/mobilemessage/send',
         '/api/messaging/send',
         '/api/repairshopr/customers',
         '/api/repairshopr/sync/tickets/recent',
         '/api/repairshopr/sms',
         '/api/repairshopr/migrate',
         '/api/xero/sync',
         '/api/admin'
      ];
      if (dangerousRoutes.some(route => req.path.startsWith(route))) {
         return res.status(200).json({ success: true, message: "Action disabled in demo mode.", mock: true });
      }
    }
    next();
  });

  app.use(searchRouter);
  app.use(botRouter);
  app.use(messagingRouter);
  app.use(xeroRouter);
  app.use(repairshoprRouter);
  app.use(debugRouter);
  app.use(zohoRouter);
  app.use(maxotelRouter);
  app.use(mobileMessageRouter);
  app.use(aiRouter);
  app.use(accountRouter);
  app.use(scanRouter);
  app.use(pushRouter);
  app.use(billingRouter);

  // --- RepairShopr Proxy ---
  const SERVER_START_TIME = new Date().toISOString();

  // --- Vite ---
  const isBuiltApp = typeof __filename !== 'undefined' && __filename.endsWith('server.cjs');
  const isProduction = process.env.NODE_ENV === 'production' || isBuiltApp;

  if (!isProduction) {
    const vite = await createViteServer({ 
      server: { 
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : undefined 
      }, 
      appType: 'spa' 
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  const server = app.listen(PORT, '0.0.0.0', async () => {
    console.log(`[${new Date().toISOString()}] Server running on http://0.0.0.0:${PORT} (Prod: ${isProduction})`);
    
    // Start background orchestration queue workers
    try {
      await getServerAuthPromise();
    } catch (e) {
      console.error("Auth promise failed on startup", e);
    }
    WorkerEngine.start();
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log(`[${new Date().toISOString()}] Shutting down DEV server cleanly...`);
    WorkerEngine.stop();
    server.close(() => {
      process.exit(0);
    });
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

if (!global.__SERVER_STARTED__) {
  global.__SERVER_STARTED__ = true;
  console.log(`[${new Date().toISOString()}] Starting server process...`);
  startServer().catch(err => {
    console.error('FATAL STARTUP ERROR:', err);
    fs.appendFileSync('startup_error.log', `[${new Date().toISOString()}] ${err.stack || err}\n`);
  });
}
