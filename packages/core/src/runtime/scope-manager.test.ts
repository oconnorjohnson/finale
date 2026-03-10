import { describe, expect, it, vi } from 'vitest';
import { createSinkRuntime } from '../sink/runtime.js';
import type { FinalizedEvent, Sink } from '../types/index.js';
import type { Finale, FlushReceipt, Scope } from '../types/index.js';
import { registerFinaleSinkRuntime, unregisterFinaleSinkRuntime } from './finale-internals.js';
import { getNoopScope } from './noop-scope.js';
import { getScope, hasScope, runWithScope, withScope } from './scope-manager.js';

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

describe('scope manager', () => {
  it('falls back to no-op scope outside active context', () => {
    expect(hasScope()).toBe(false);
    expect(getScope()).toBe(getNoopScope());
  });

  it('provides active scope within withScope callback', async () => {
    const finale = createFinaleStub();

    await withScope(finale, async (scope) => {
      expect(hasScope()).toBe(true);
      expect(getScope()).toBe(scope);
    });

    expect(hasScope()).toBe(false);
    expect(getScope()).toBe(getNoopScope());
  });

  it('emits through the registered sink runtime when withScope finalizes', async () => {
    const finale = createFinaleStub();
    const { emitted, runtime } = createRecordingRuntime();
    registerFinaleSinkRuntime(finale, runtime);

    try {
      await withScope(finale, async (scope) => {
        scope.event.add({ 'request.id': 'req_1' });
      });

      await runtime.drain();

      expect(emitted).toHaveLength(1);
      expect(emitted[0]?.fields['request.id']).toBe('req_1');
    } finally {
      unregisterFinaleSinkRuntime(finale);
    }
  });

  it('uses nested stack semantics with innermost scope on top', async () => {
    const finale = createFinaleStub();
    let outerScope: Scope | undefined;

    await withScope(finale, async (outer) => {
      outerScope = outer;
      await withScope(finale, async (inner) => {
        expect(inner).not.toBe(outer);
        expect(getScope()).toBe(inner);
      });
      expect(getScope()).toBe(outer);
    });

    expect(outerScope).toBeDefined();
    expect(hasScope()).toBe(false);
  });

  it('emits nested withScope finalizations through the registered runtime', async () => {
    const finale = createFinaleStub();
    const { emitted, runtime } = createRecordingRuntime();
    registerFinaleSinkRuntime(finale, runtime);

    try {
      await withScope(finale, async (outer) => {
        outer.event.add({ 'request.id': 'outer' });

        await withScope(finale, async (inner) => {
          inner.event.add({ 'request.id': 'inner' });
        });
      });

      await runtime.drain();

      expect(emitted.map((record) => record.fields['request.id'])).toEqual(['inner', 'outer']);
    } finally {
      unregisterFinaleSinkRuntime(finale);
    }
  });

  it('runWithScope activates provided scope without flushing it', async () => {
    const outer = createTrackedScope();
    const inner = createTrackedScope();

    await runWithScope(outer.scope, async () => {
      expect(hasScope()).toBe(true);
      expect(getScope()).toBe(outer.scope);

      await runWithScope(inner.scope, async () => {
        expect(hasScope()).toBe(true);
        expect(getScope()).toBe(inner.scope);
      });

      expect(getScope()).toBe(outer.scope);
    });

    expect(outer.flush).not.toHaveBeenCalled();
    expect(inner.flush).not.toHaveBeenCalled();
    expect(hasScope()).toBe(false);
    expect(getScope()).toBe(getNoopScope());
  });

  it('finalizes scope even when callback throws', async () => {
    const finale = createFinaleStub();
    const tracked = createTrackedScope();

    await expect(
      withScope(
        finale,
        async () => {
          throw new Error('boom');
        },
        { scope: tracked.scope }
      )
    ).rejects.toThrow('boom');

    expect(tracked.flush).toHaveBeenCalledTimes(1);
    expect(hasScope()).toBe(false);
  });

  it('finalizes scope after successful callback', async () => {
    const finale = createFinaleStub();
    const tracked = createTrackedScope();

    await withScope(finale, async () => undefined, { scope: tracked.scope });

    expect(tracked.flush).toHaveBeenCalledTimes(1);
  });
});
