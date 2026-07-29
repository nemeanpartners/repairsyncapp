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
  const SUPPORT_EMAIL = 'nemeanpartnersptyltd@gmail.com';

  function legalPage(title: string, subtitle: string, body: string) {
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title} | RepairSync</title>
    <meta name="application-name" content="RepairSync" />
    <meta name="description" content="RepairSync is a repair business management app for repair tickets, customers, messaging, invoices, inventory, and technician workflows." />
    <style>
      body{margin:0;background:#f4f4f5;color:#09090b;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.6}
      main{max-width:760px;margin:0 auto;padding:32px 20px 56px}
      header{background:#09090b;color:white;border-radius:24px;padding:28px;margin-bottom:18px}
      h1{margin:8px 0 0;font-size:36px;line-height:1.05}
      h2{font-size:20px;margin:0 0 8px}
      p,li{font-size:15px}
      section{background:white;border:1px solid #e4e4e7;border-radius:18px;padding:22px;margin-top:14px;box-shadow:0 1px 2px rgba(0,0,0,.04)}
      a{color:#09090b;font-weight:800}
      .eyebrow{margin:0;color:#34d399;text-transform:uppercase;letter-spacing:.18em;font-size:12px;font-weight:900}
      .nav{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:18px}
      .nav a,.button{display:inline-flex;align-items:center;justify-content:center;border-radius:14px;border:1px solid #d4d4d8;background:white;padding:10px 14px;text-decoration:none;font-size:14px}
      .button{background:#09090b;color:white;border-color:#09090b;margin-top:10px}
    </style>
  </head>
  <body>
    <main>
      <nav class="nav">
        <a href="/">RepairSync Home</a>
        <a href="/privacy-policy">Privacy Policy</a>
        <a href="/terms">Terms</a>
        <a href="/support">Support</a>
      </nav>
      <header>
        <p class="eyebrow">RepairSync</p>
        <h1>${title}</h1>
        <p>${subtitle}</p>
      </header>
      ${body}
    </main>
    <script>
      document.querySelectorAll('a[href="/"]').forEach((link) => {
        link.addEventListener('click', (event) => {
          event.preventDefault();
          window.location.replace('/?refresh=' + Date.now());
        });
      });
    </script>
  </body>
</html>`;
  }

  app.get('/privacy-policy', (_req, res) => {
    res.type('html').send(legalPage(
      'Privacy Policy',
      'Effective date: 4 June 2026. RepairSync is a repair business management app.',
      `<section><h2>Who We Are</h2><p>RepairSync provides repair business management software for customer management, repair tickets, messaging, invoicing, quoting, inventory management, technician workflows, automation, and related repair shop operations.</p><p><strong>Support contact:</strong> <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></p></section>
      <section><h2>Information We Collect</h2><ul><li>Business details, account settings, and support email information.</li><li>User account details including name, email address, role, and permissions.</li><li>Customer records entered by repair businesses, including contact details, device details, tickets, repair history, invoices, quotes, and messages.</li><li>Operational records such as inventory, parts orders, tasks, workflow settings, and automation settings.</li></ul></section>
      <section><h2>How We Use Information</h2><ul><li>Provide, maintain, and secure RepairSync.</li><li>Authenticate users and manage account access.</li><li>Display customer, ticket, invoice, quote, inventory, and messaging records.</li><li>Provide reporting, workflow, automation, and integration features.</li><li>Respond to support requests and troubleshoot platform issues.</li></ul></section>
      <section><h2>Sharing and Security</h2><p>RepairSync does not sell personal information. Information may be processed by service providers that help operate cloud hosting, authentication, messaging, payments, backups, infrastructure, and integrations enabled by the business. We use reasonable technical and organisational safeguards to protect information.</p></section>
      <section><h2>Access, Correction, and Deletion</h2><p>Users may request access to, correction of, or deletion of personal information, subject to applicable legal, accounting, taxation, security, and compliance requirements.</p></section>
      <section><h2>Contact</h2><p>For privacy enquiries, access requests, correction requests, deletion requests, complaints, or support, contact <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.</p></section>`
    ));
  });

  app.get('/terms', (_req, res) => {
    res.type('html').send(legalPage(
      'Terms of Service',
      'Effective date: 4 June 2026. These terms govern access to and use of RepairSync.',
      `<section><h2>Use of RepairSync</h2><p>RepairSync is a repair business management app for customer management, ticket tracking, messaging, invoicing, quoting, inventory management, workflow automation, and related repair shop operations. You may use RepairSync only for lawful business purposes.</p></section>
      <section><h2>Accounts and Data</h2><p>You are responsible for account credentials and activity under your account. You retain ownership of business and customer data entered into RepairSync, and we process that data to provide, secure, maintain, and improve the service.</p></section>
      <section><h2>Subscriptions</h2><p>Paid features may require an active subscription. Subscription terms, pricing, billing intervals, renewals, cancellation options, and any Apple in-app purchase or Stripe checkout details are presented at purchase or in account settings.</p></section>
      <section><h2>Contact</h2><p>For questions about these terms, contact <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.</p></section>`
    ));
  });

  app.get(['/support', '/contact'], (_req, res) => {
    const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('RepairSync support request')}&body=${encodeURIComponent('Hi RepairSync Support,\\n\\nI need help with:\\n\\n')}`;
    res.type('html').send(legalPage(
      'Contact Us',
      'Contact RepairSync support for account, billing, privacy, or app support help.',
      `<section><h2>Support Contact</h2><p>Email Nemean Partners Pty Ltd for RepairSync support.</p><p><strong><a href="${mailto}">${SUPPORT_EMAIL}</a></strong></p><p><a class="button" href="${mailto}">Email RepairSync Support</a></p></section>`
    ));
  });

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
    const assetsPath = path.join(distPath, 'assets');
    app.use(
      '/assets',
      express.static(assetsPath, {
        fallthrough: false,
        immutable: true,
        maxAge: '1y',
      }),
    );
    app.use(
      express.static(distPath, {
        index: false,
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-store, max-age=0');
          }
        },
      }),
    );
    app.get('*', (req, res) => {
      res.setHeader('Cache-Control', 'no-store, max-age=0');
      res.sendFile(path.join(distPath, 'index.html'));
    });
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
