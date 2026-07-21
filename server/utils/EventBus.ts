export type EventCallback = (payload: any) => void | Promise<void>;

export class EventBus {
  private static listeners: Map<string, Set<EventCallback>> = new Map();

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

  static publish(topic: string, payload: any) {
    const topicListeners = this.listeners.get(topic);
    if (!topicListeners) return;

    Array.from(topicListeners).forEach(callback => {
      try {
        const result = callback(payload);
        if (result instanceof Promise) {
          result.catch(err => console.error(`[Backend EventBus] Async Error in topic ${topic}:`, err));
        }
      } catch (err) {
        console.error(`[Backend EventBus] Sync Error in topic ${topic}:`, err);
      }
    });
  }
}
