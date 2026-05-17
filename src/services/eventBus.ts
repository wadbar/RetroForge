/**
 * EventBus - Central nervous system for architectural decoupling.
 * Facilitates communication between UI components and background services.
 */
type EventCallback = (data: any) => void;

class EventBus {
  private events: Map<string, EventCallback[]> = new Map();
  private webhooks: string[] = [];

  /**
   * Subscribe to a specific event
   */
  public on(event: string, callback: EventCallback) {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event)?.push(callback);
  }

  /**
   * Unsubscribe from a specific event
   */
  public off(event: string, callback: EventCallback) {
    if (!this.events.has(event)) return;
    const callbacks = this.events.get(event)?.filter(cb => cb !== callback) || [];
    this.events.set(event, callbacks);
  }

  /**
   * Emit an event locally and to configured webhooks
   */
  public async emit(event: string, data: any) {
    // Local Subscribers
    this.events.get(event)?.forEach(cb => cb(data));

    // External Hooks (Discord, Custom APIs, etc.)
    if (this.webhooks.length > 0) {
      this.broadcastToWebhooks(event, data);
    }

    // AI Context Feed (Internal log for AI awareness)
    this.logToMonitor(event, data);
  }

  public registerWebhook(url: string) {
    if (!this.webhooks.includes(url)) {
      this.webhooks.push(url);
    }
  }

  private async broadcastToWebhooks(event: string, data: any) {
    for (const url of this.webhooks) {
      try {
        await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event, data, timestamp: new Date().toISOString() })
        });
      } catch (e) {
        console.error(`[EventBus] Webhook failure: ${url}`, e);
      }
    }
  }

  private logToMonitor(event: string, data: any) {
    // This feeds the "Infinite Evolution" monitor
    console.log(`[EVENT_MONITOR][${new Date().toISOString()}] ${event}`, data);
  }
}

export const eventBus = new EventBus();
