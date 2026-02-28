import { describe, expect, it, vi } from 'vitest';
import { AccumulationScope } from '../accumulation/scope.js';
import type { Finale, FlushReceipt, Scope } from '../types/index.js';
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

describe('runtime lifecycle', () => {
  it('startScope creates an accumulation scope by default', () => {
    const finale = createFinaleStub();
    const context = startScope(finale);
    expect(context.scope).toBeInstanceOf(AccumulationScope);
  });

  it('startScope uses provided scope when supplied', () => {
    const finale = createFinaleStub();
    const tracked = createTrackedScope();
    const context = startScope(finale, { scope: tracked.scope });

    expect(context.scope).toBe(tracked.scope);
    expect(context.finalized).toBe(false);
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
