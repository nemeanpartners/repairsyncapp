export interface CostReport {
  firestoreReads: number;
  firestoreWrites: number;
  activeListenersCount: number;
  simulatedSmsSent: number;
  simulatedAiTokens: number;
  totalCostUsd: number;
  timestamp: string;
}

export class CostAnalyticsEngine {
  private static STORAGE_KEY = "repairsync_cost_telemetry";

  // Raw rate constants ($ USD)
  private static READ_RATE = 0.00000006;       // $0.06 per 100k reads
  private static WRITE_RATE = 0.00000018;      // $0.18 per 100k writes
  private static SMS_RATE = 0.04;              // $0.04 per SMS
  private static AI_TOKEN_RATE = 0.000015;     // $15 per million input tokens

  private static currentMetrics = {
    firestoreReads: 0,
    firestoreWrites: 0,
    activeListeners: new Set<string>(),
    simulatedSmsSent: 0,
    simulatedAiTokens: 0,
  };

  static {
    // Attempt loading historical metrics from LocalStorage for persistence across reloads
    try {
      const persisted = localStorage.getItem(this.STORAGE_KEY);
      if (persisted) {
        const parsed = JSON.parse(persisted);
        this.currentMetrics.firestoreReads = parsed.firestoreReads || 0;
        this.currentMetrics.firestoreWrites = parsed.firestoreWrites || 0;
        this.currentMetrics.simulatedSmsSent = parsed.simulatedSmsSent || 0;
        this.currentMetrics.simulatedAiTokens = parsed.simulatedAiTokens || 0;
      }
    } catch (e) {
      console.warn("[CostAnalyticsEngine] Failed to restore cost telemetry:", e);
    }
  }

  private static save() {
    try {
      localStorage.setItem(
        this.STORAGE_KEY,
        JSON.stringify({
          firestoreReads: this.currentMetrics.firestoreReads,
          firestoreWrites: this.currentMetrics.firestoreWrites,
          simulatedSmsSent: this.currentMetrics.simulatedSmsSent,
          simulatedAiTokens: this.currentMetrics.simulatedAiTokens,
        })
      );
    } catch (e) {
      // Ignore write errors in sandbox modes
    }
  }

  static recordReads(key: string, count: number) {
    this.currentMetrics.firestoreReads += count;
    this.save();
  }

  static recordWrites(count: number) {
    this.currentMetrics.firestoreWrites += count;
    this.save();
  }

  static recordListenerSpawn(key: string) {
    this.currentMetrics.activeListeners.add(key);
  }

  static recordListenerTeardown(key: string) {
    this.currentMetrics.activeListeners.delete(key);
  }

  static recordSmsSent() {
    this.currentMetrics.simulatedSmsSent += 1;
    this.save();
  }

  static recordAiTokens(tokens: number) {
    this.currentMetrics.simulatedAiTokens += tokens;
    this.save();
  }

  static getReport(): CostReport {
    const readsCost = this.currentMetrics.firestoreReads * this.READ_RATE;
    const writesCost = this.currentMetrics.firestoreWrites * this.WRITE_RATE;
    const smsCost = this.currentMetrics.simulatedSmsSent * this.SMS_RATE;
    const aiCost = this.currentMetrics.simulatedAiTokens * this.AI_TOKEN_RATE;
    const total = readsCost + writesCost + smsCost + aiCost;

    return {
      firestoreReads: this.currentMetrics.firestoreReads,
      firestoreWrites: this.currentMetrics.firestoreWrites,
      activeListenersCount: this.currentMetrics.activeListeners.size,
      simulatedSmsSent: this.currentMetrics.simulatedSmsSent,
      simulatedAiTokens: this.currentMetrics.simulatedAiTokens,
      totalCostUsd: Number(total.toFixed(4)),
      timestamp: new Date().toISOString(),
    };
  }

  static reset() {
    this.currentMetrics = {
      firestoreReads: 0,
      firestoreWrites: 0,
      activeListeners: new Set<string>(),
      simulatedSmsSent: 0,
      simulatedAiTokens: 0,
    };
    this.save();
  }
}
