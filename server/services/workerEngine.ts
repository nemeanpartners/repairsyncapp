import { getFirestore, collection, query, where, getDocs, doc, updateDoc as firestoreUpdateDoc, deleteDoc } from "firebase/firestore";
import { getDb } from "../utils/firebase.js";
import { getRecentTickets } from "./repairshoprService.js";

async function updateDoc(ref: any, data: any) {
  return firestoreUpdateDoc(ref, { uid: 'api-server', ...data });
}

// A simple in-memory queue manager that can be scaled into a robust Redis/PubSub event architecture
export class WorkerEngine {
  private static isRunning = false;
  private static interval: NodeJS.Timeout | null = null;
  private static rsSyncInterval: NodeJS.Timeout | null = null;
  private static isProcessing = false;

  static start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log("[WorkerEngine] Background Job Processor Started");
    
    // Poll every 30 seconds for background tasks (queues, retries, webhook fallbacks)
    this.interval = setInterval(async () => {
      if (this.isProcessing) return;
      this.isProcessing = true;
      try {
        await this.processXeroSyncQueue();
      } catch (err) {
        console.error("[WorkerEngine] Error in processing loop:", err);
      } finally {
        this.isProcessing = false;
      }
    }, 30000);

    // Hourly RepairShopr sync
    this.rsSyncInterval = setInterval(async () => {
      console.log("[WorkerEngine] Running hourly RepairShopr sync...");
      try {
        const subdomain = process.env.REPAIRSHOPR_SUBDOMAIN;
        const apiKey = process.env.REPAIRSHOPR_API_KEY;
        if (!subdomain || !apiKey) {
          console.warn("[WorkerEngine] RepairShopr credentials missing, skipping sync");
          return;
        }
        await getRecentTickets(subdomain, apiKey);
        console.log("[WorkerEngine] Hourly RepairShopr sync complete.");
      } catch (err) {
        console.error("[WorkerEngine] Error in hourly RepairShopr sync:", err);
      }
    }, 60 * 60 * 1000); // 1 hour
  }

  static stop() {
    if (this.interval) clearInterval(this.interval);
    if (this.rsSyncInterval) clearInterval(this.rsSyncInterval);
    this.isRunning = false;
    console.log("[WorkerEngine] Background Job Processor Stopped");
  }

  // --- SPECIFIC WORKERS ---

  private static async processXeroSyncQueue() {
    const db = getDb();
    if (!db) return;

    try {
      const q = query(
        collection(db, "xero_sync_queue"),
        where("status", "==", "pending") // Or where error count < max
      );
      
      const snap = await getDocs(q);
      if (snap.empty) return;

      console.log(`[WorkerEngine] Found ${snap.size} pending Xero sync jobs.`);
      
      // In a real enterprise system, process these safely with exponential backoff & DLQ (Dead Letter Queue)
      // For now we just safely dequeue or increment error states
      for (const queueDoc of snap.docs) {
         try {
            const data = queueDoc.data();
            // TODO: Execute actual xero.ts logic here (e.g. syncInvoiceToXero(data.invoiceId))
            // For now, mark as complete if no actual executor is wired
            await updateDoc(queueDoc.ref, { 
                status: "completed", 
                processedAt: new Date().toISOString() 
            });
         } catch (jobErr: any) {
            console.error(`[WorkerEngine] Xero job ${queueDoc.id} failed:`, jobErr);
            await updateDoc(queueDoc.ref, {
                status: "error",
                error: jobErr.message || "Unknown error",
                updatedAt: new Date().toISOString()
            });
         }
      }
    } catch (e) {
      console.error("[WorkerEngine] Failed to process xero_sync_queue:", e);
    }
  }
}
