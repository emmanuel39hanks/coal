// Shared in-memory event store for the demo webhook receiver.
// In production, persist to a database.

export type StoredEvent = {
  id: string;
  type: string;
  receivedAt: string;
  valid: boolean;
  payload: unknown;
};

// Module-level singleton — shared across routes in the same Node.js process.
const store: { events: StoredEvent[] } = (global as any).__coalDemoStore ??
  ((global as any).__coalDemoStore = { events: [] });

const MAX_EVENTS = 50;

export function addEvent(event: StoredEvent) {
  store.events.unshift(event);
  if (store.events.length > MAX_EVENTS) store.events.splice(MAX_EVENTS);
}

export function getEvents(): StoredEvent[] {
  return store.events.slice(0, 20);
}

export function clearEvents() {
  store.events.splice(0);
}
