import { describe, expect, it, vi } from 'vitest';
import { AccumulationScope } from '../accumulation/scope.js';
import { createSinkRuntime } from '../sink/runtime.js';
import type { FinalizedEvent, Finale, FlushReceipt, Scope, Sink } from '../types/index.js';
import {
  registerFinaleScopeOptions,
  registerFinaleSinkRuntime,
  unregisterFinaleScopeOptions,
  unregisterFinaleSinkRuntime,
} from './finale-internals.js';
import { endScope, startScope } from './lifecycle.js';

function createFinaleStub(): Finale {
  const snapshot = {
    eventsEmitted: 0,
    eventsDropped: 0,
    eventsSampledOut: 0,
    fieldsDropped: 0,
    redactionsApplied: 0,
    schemaViolations: 0,
    sinkFailures: 0,
    queueDrops: 0,
  };

  return {
    metrics: {
      ...snapshot,
      snapshot() {
        return snapshot;
      },
    },
    async drain(): Promise<void> {},
  };
}

function createTrackedScope(flushImpl?: () => FlushReceipt): { scope: Scope; flush: ReturnType<typeof vi.fn> } {
  const fallbackReceipt: FlushReceipt = {
    emitted: true,
    decision: { decision: 'KEEP_NORMAL' },
    fieldsDropped: [],
    fieldsRedacted: [],
    finalSize: 10,
  };
  const flush = vi.fn(flushImpl ?? (() => fallbackReceipt));

  return {
    scope: {
      event: {
        add(): void {},
        child() {
          return { add(): void {} };
        },
        error(): void {},
        annotate(): void {},
        subEvent(): void {},
        flush,
      },
      timers: {
        start(): void {},
        end(): void {},
        measure<T>(_name: string, fn: () => T | Promise<T>): T | Promise<T> {
          return fn();
        },
      },
    },
    flush,
  };
}

function createRecordingRuntime(): {
  emitted: FinalizedEvent[];
  runtime: ReturnType<typeof createSinkRuntime>;
} {
  const emitted: FinalizedEvent[] = [];
  const sink: Sink = {
    emit: vi.fn(async (record: FinalizedEvent) => {
      emitted.push(record);
    }),
  };

  return {
    emitted,
    runtime: createSinkRuntime({ sink }),
  };
}

describe('runtime lifecycle', () => {
  it('startScope creates an accumulation scope by default', () => {
    const finale = createFinaleStub();
    const context = startScope(finale);
    expect(context.scope).toBeInstanceOf(AccumulationScope);
  });

  it('attaches a registered sink runtime to default-created scopes', async () => {
    const finale = createFinaleStub();
    const { emitted, runtime } = createRecordingRuntime();
    registerFinaleSinkRuntime(finale, runtime);

    try {
      const context = startScope(finale);
      expect(context.scope).toBeInstanceOf(AccumulationScope);

      context.scope.event.add({ 'request.id': 'req_1' });
      const receipt = endScope(context);

      expect(receipt.emitted).toBe(true);

      await runtime.drain();
      expect(emitted).toHaveLength(1);
      expect(emitted[0]?.fields['request.id']).toBe('req_1');
    } finally {
      unregisterFinaleSinkRuntime(finale);
    }
  });

  it('startScope uses provided scope when supplied', () => {
    const finale = createFinaleStub();
    const tracked = createTrackedScope();
    const context = startScope(finale, { scope: tracked.scope });

    expect(context.scope).toBe(tracked.scope);
    expect(context.finalized).toBe(false);
  });

  it('preserves local-only behavior when no sink runtime is registered', () => {
    const finale = createFinaleStub();
    const context = startScope(finale);

    context.scope.event.add({ 'request.id': 'req_1' });
    const receipt = endScope(context);

    expect(receipt.emitted).toBe(false);
  });

  it('uses registered scope options when creating default scopes', () => {
    const finale = createFinaleStub();
    registerFinaleScopeOptions(finale, {
      defaults: {
        'service.name': 'checkout-api',
      },
    });

    try {
      const context = startScope(finale);

      context.scope.event.add({ 'request.id': 'req_1' });
      endScope(context);

      const event = (context.scope as AccumulationScope).getLastFinalizedEvent();
      expect(event?.fields['service.name']).toBe('checkout-api');
      expect(event?.fields['request.id']).toBe('req_1');
    } finally {
      unregisterFinaleScopeOptions(finale);
    }
  });

  it('applies registered scope options and sink runtime to the same default-created scope', async () => {
    const finale = createFinaleStub();
    const { emitted, runtime } = createRecordingRuntime();
    registerFinaleScopeOptions(finale, {
      defaults: {
        'service.name': 'checkout-api',
      },
    });
    registerFinaleSinkRuntime(finale, runtime);

    try {
      const context = startScope(finale);

      context.scope.event.add({ 'request.id': 'req_1' });
      const receipt = endScope(context);

      expect(receipt.emitted).toBe(true);

      await runtime.drain();
      expect(emitted[0]?.fields['service.name']).toBe('checkout-api');
      expect(emitted[0]?.fields['request.id']).toBe('req_1');
    } finally {
      unregisterFinaleSinkRuntime(finale);
      unregisterFinaleScopeOptions(finale);
    }
  });

  it('endScope flushes once and is idempotent', () => {
    const finale = createFinaleStub();
    const tracked = createTrackedScope();
    const context = startScope(finale, { scope: tracked.scope });

    const first = endScope(context);
    const second = endScope(context);

    expect(tracked.flush).toHaveBeenCalledTimes(1);
    expect(first).toBe(second);
  });

  it('endScope returns fallback receipt when flush throws', () => {
    const finale = createFinaleStub();
    const tracked = createTrackedScope(() => {
      throw new Error('flush failed');
    });
    const context = startScope(finale, { scope: tracked.scope });

    const receipt = endScope(context);

    expect(receipt.emitted).toBe(false);
    expect(receipt.decision.decision).toBe('DROP');
    expect(receipt.decision.reason).toBe('flush_error');
  });
});
