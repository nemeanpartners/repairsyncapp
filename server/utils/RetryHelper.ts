/**
 * Generic retry wrapper with exponential backoff.
 */
export class RetryHelper {
  static async withRetries<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelayMs: number = 1000
  ): Promise<T> {
    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        return await operation();
      } catch (error: any) {
        attempt++;
        if (attempt >= maxRetries) {
          throw error;
        }
        
        // Exponential backoff with a bit of jitter
        const delay = (baseDelayMs * Math.pow(2, attempt - 1)) + (Math.random() * 500);
        console.warn(`[RetryHelper] Operation failed. Retrying in ${Math.round(delay)}ms... (Attempt ${attempt}/${maxRetries})`);
        await new Promise(res => setTimeout(res, delay));
      }
    }
    throw new Error("Retry logic failed entirely");
  }
}
