/**
 * Lightweight, type-safe Pub-Sub Event Bus for PawLoop
 * Decouples ecosystem cascading simulation, volunteer checklists, and analytics.
 */

type EventCallback<T = unknown> = (data: T) => void;

export type PawLoopEvents = {
  'MISSION_STARTED': { volunteerName: string; stationId: string; type: string };
  'MISSION_COMPLETED': { volunteerName: string; stationId: string; action: string };
  'EMERGENCY_REPORTED': { animalType: string; condition: string; lat: number; lng: number };
  'OFFLINE_ACTIONS_SYNCED': { count: number };
  'WEATHER_CHANGED': { state: string };
  'SCENARIO_TRIGGERED': { name: string; description: string };
};

export interface TracedEvent {
  id: string;
  timestamp: string;
  event: string;
  data: unknown;
  listenerCount: number;
}

class PawLoopEventBus {
  private listeners: Record<string, EventCallback<unknown>[]> = {};
  public traces: TracedEvent[] = [];
  public enableTracing = true;
  private throttledActions: Record<string, number> = {};
  
  // Anti-recursion profiling
  private emissionRates: Record<string, number[]> = {};

  /**
   * Throttles an action by a key and cooldown window
   */
  throttle(key: string, cooldownMs: number, action: () => void) {
    const now = Date.now();
    const last = this.throttledActions[key] || 0;
    if (now - last > cooldownMs) {
      this.throttledActions[key] = now;
      action();
    }
  }

  /**
   * Subscribe to a typed event. Returns an unsubscribe function.
   */
  on<K extends keyof PawLoopEvents>(event: K, callback: EventCallback<PawLoopEvents[K]>): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback as EventCallback<unknown>);
    return () => this.off(event, callback);
  }

  /**
   * Unsubscribe from an event.
   */
  off<K extends keyof PawLoopEvents>(event: K, callback: EventCallback<PawLoopEvents[K]>) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(cb => cb !== (callback as EventCallback<unknown>));
  }

  /**
   * Broadcast an event payload to all active subscribers.
   */
  emit<K extends keyof PawLoopEvents>(event: K, data: PawLoopEvents[K]) {
    const listenerCount = this.listeners[event] ? this.listeners[event].length : 0;
    const now = Date.now();

    // 1. Anti-Recursion Profiling (Max 10 per second)
    if (!this.emissionRates[event]) this.emissionRates[event] = [];
    // Clean up timestamps older than 1 second
    this.emissionRates[event] = this.emissionRates[event].filter(ts => now - ts < 1000);
    this.emissionRates[event].push(now);

    if (this.emissionRates[event].length > 10) {
      console.warn(`[EVENT BUS PROFILER] Recursive Loop Warning: Event "${event}" fired ${this.emissionRates[event].length} times in 1s. Throttling event.`);
      // Drop the event to prevent cascading browser crash
      return;
    }

    // 2. Tracing
    if (this.enableTracing) {
      const trace: TracedEvent = {
        id: `tr-${now}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date(now).toISOString(),
        event,
        data: data as unknown,
        listenerCount,
      };
      this.traces = [trace, ...this.traces.slice(0, 49)];
    }

    if (!this.listeners[event]) return;
    
    // Dispatch in next tick to prevent synchronous recursion side effects
    setTimeout(() => {
      this.listeners[event].forEach(cb => {
        try {
          const start = performance.now();
          cb(data);
          const duration = performance.now() - start;
          if (duration > 50) {
            console.warn(`[EVENT BUS PROFILER] Slow Listener on "${event}": took ${duration.toFixed(2)}ms`);
          }
        } catch (err) {
          console.error(`Error in event bus subscriber for event "${event}":`, err);
        }
      });
    }, 0);
  }
}

export const eventBus = new PawLoopEventBus();

