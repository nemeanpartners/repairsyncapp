export type EventCallback = (payload: any) => void | Promise<void>;

export class EventBus {
  private static listeners: Map<string, Set<EventCallback>> = new Map();

  /**
   * Subscribe to a system-wide event topic.
   * Returns an unsubscribe function.
   */
  static subscribe(topic: string, callback: EventCallback): () => void {
    if (!this.listeners.has(topic)) {
      this.listeners.set(topic, new Set());
    }
    this.listeners.get(topic)!.add(callback);

    return () => {
      const topicListeners = this.listeners.get(topic);
      if (topicListeners) {
        topicListeners.delete(callback);
        if (topicListeners.size === 0) {
          this.listeners.delete(topic);
        }
      }
    };
  }

  /**
   * Broadcast an event to all subscribers asynchronously.
   */
  static publish(topic: string, payload: any) {
    const topicListeners = this.listeners.get(topic);
    if (!topicListeners) return;

    // Execute all listeners asynchronously to avoid blocking
    Array.from(topicListeners).forEach(callback => {
      try {
        const result = callback(payload);
        if (result instanceof Promise) {
          result.catch(err => console.error(`[EventBus] Async Error in topic ${topic}:`, err));
        }
      } catch (err) {
        console.error(`[EventBus] Sync Error in topic ${topic}:`, err);
      }
    });
  }
}
