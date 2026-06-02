export type RealtimeTopic =
  | "dashboard"
  | "inventory"
  | "sales"
  | "shift"
  | "sync"
  | "stockOpname"
  | "purchases"
  | "waste"
  | "customers"
  | "settings"
  | "promotions"
  | "masterData";

export type RealtimeEvent = {
  id: string;
  organizationId: string;
  outletId?: string | null;
  topics: RealtimeTopic[];
  type: string;
  payload?: Record<string, unknown>;
  createdAt: string;
};

type RealtimeListener = (event: RealtimeEvent) => void;
type RealtimeState = {
  listeners: Set<RealtimeListener>;
  sequence: number;
};

const state = getRealtimeState();

export function publishRealtimeEvent(input: {
  organizationId: string;
  outletId?: string | null;
  topics: RealtimeTopic[];
  type: string;
  payload?: Record<string, unknown>;
}) {
  const event: RealtimeEvent = {
    id: `${Date.now()}-${++state.sequence}`,
    organizationId: input.organizationId,
    outletId: input.outletId ?? null,
    topics: Array.from(new Set(input.topics)),
    type: input.type,
    payload: input.payload,
    createdAt: new Date().toISOString(),
  };

  for (const listener of state.listeners) {
    listener(event);
  }
}

export function subscribeRealtime(listener: RealtimeListener) {
  state.listeners.add(listener);
  return () => state.listeners.delete(listener);
}

function getRealtimeState() {
  const key = "__pos_cemilan_realtime_state__";
  const store = globalThis as typeof globalThis & {
    [key]?: RealtimeState;
  };
  store[key] ??= {
    listeners: new Set<RealtimeListener>(),
    sequence: 0,
  };
  return store[key];
}
