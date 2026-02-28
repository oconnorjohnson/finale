import type {
  EventAPI,
  FlushReceipt,
  NamespacedEventAPI,
  SamplingDecision,
  Scope,
  TimerAPI,
} from '../types/index.js';

const missingScopeDecision: SamplingDecision = {
  decision: 'DROP',
  reason: 'missing_scope',
};

function createNoopReceipt(reason: string): FlushReceipt {
  return {
    emitted: false,
    decision: {
      decision: missingScopeDecision.decision,
      reason,
    },
    fieldsDropped: [],
    fieldsRedacted: [],
    finalSize: 0,
  };
}

const noopNamespacedEventApi: NamespacedEventAPI = {
  add(): void {
    // Intentionally no-op. This is the safety fallback when scope propagation is unavailable.
  },
};

const noopEventApi: EventAPI = {
  add(): void {
    // Intentionally no-op. This avoids crashing app code when no scope is active.
  },
  child(): NamespacedEventAPI {
    return noopNamespacedEventApi;
  },
  error(): void {
    // Intentionally no-op.
  },
  annotate(): void {
    // Intentionally no-op.
  },
  subEvent(): void {
    // Intentionally no-op.
  },
  flush(): FlushReceipt {
    return createNoopReceipt('missing_scope');
  },
};

const noopTimerApi: TimerAPI = {
  start(): void {
    // Intentionally no-op.
  },
  end(): void {
    // Intentionally no-op.
  },
  measure<T>(_name: string, fn: () => T | Promise<T>): T | Promise<T> {
    // We still execute the callback so business logic runs as expected.
    return fn();
  },
};

const sharedNoopScope: Scope = {
  event: noopEventApi,
  timers: noopTimerApi,
};

export function getNoopScope(): Scope {
  return sharedNoopScope;
}

export function createNoopScope(): Scope {
  return {
    event: { ...noopEventApi },
    timers: { ...noopTimerApi },
  };
}
