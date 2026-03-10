import { describe, expect, it, vi } from 'vitest';
import type { FinalizedEvent, Sink } from '../types/index.js';
import { createSinkRuntime } from './runtime.js';

function makeEvent(id: string, samplingDecision: FinalizedEvent['metadata']['samplingDecision'] = 'KEEP_NORMAL'): FinalizedEvent {
  return {
    fields: { id },
    timings: {},
    metadata: { samplingDecision },
  };
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
} {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve;
  });

  return { promise, resolve };
}

function waitForTurn(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

describe('sink runtime', () => {
  it('admits records and emits them asynchronously', async () => {
    const emitted: string[] = [];
    const onSinkSuccess = vi.fn();
    const sink: Sink = {
      emit: vi.fn(async (record: FinalizedEvent) => {
        emitted.push(String(record.fields.id));
      }),
    };
    const runtime = createSinkRuntime({ sink, onSinkSuccess });

    expect(runtime.enqueue(makeEvent('evt_1'))).toBe(true);
    expect(runtime.enqueue(makeEvent('evt_2'))).toBe(true);

    expect(emitted).toEqual([]);
    await runtime.drain();

    expect(emitted).toEqual(['evt_1', 'evt_2']);
    expect(onSinkSuccess).toHaveBeenCalledTimes(2);
  });

  it('rejects the newest record when capacity is reached with drop-newest', async () => {
    const firstEmit = deferred<void>();
    const emitted: string[] = [];
    const sink: Sink = {
      emit: vi.fn(async (record: FinalizedEvent) => {
        emitted.push(String(record.fields.id));
        await firstEmit.promise;
      }),
    };
    const runtime = createSinkRuntime({
      sink,
      queue: { maxSize: 1, dropPolicy: 'drop-newest' },
    });

    expect(runtime.enqueue(makeEvent('evt_1'))).toBe(true);
    await waitForTurn();
    expect(runtime.enqueue(makeEvent('evt_2'))).toBe(false);

    firstEmit.resolve(undefined);
    await runtime.drain();

    expect(emitted).toEqual(['evt_1']);
  });

  it('drops the oldest queued record when configured for drop-oldest', async () => {
    const firstEmit = deferred<void>();
    const emitted: string[] = [];
    const sink: Sink = {
      emit: vi.fn(async (record: FinalizedEvent) => {
        emitted.push(String(record.fields.id));
        if (record.fields.id === 'evt_1') {
          await firstEmit.promise;
        }
      }),
    };
    const runtime = createSinkRuntime({
      sink,
      queue: { maxSize: 2, dropPolicy: 'drop-oldest' },
    });

    expect(runtime.enqueue(makeEvent('evt_1'))).toBe(true);
    await waitForTurn();
    expect(runtime.enqueue(makeEvent('evt_2'))).toBe(true);
    expect(runtime.enqueue(makeEvent('evt_3'))).toBe(true);

    firstEmit.resolve(undefined);
    await runtime.drain();

    expect(emitted).toEqual(['evt_1', 'evt_3']);
  });

  it('reports sink emit failures and continues processing later records', async () => {
    const onSinkError = vi.fn();
    const onSinkSuccess = vi.fn();
    const emitted: string[] = [];
    const sink: Sink = {
      emit: vi.fn(async (record: FinalizedEvent) => {
        if (record.fields.id === 'evt_1') {
          throw new Error('boom');
        }

        emitted.push(String(record.fields.id));
      }),
    };
    const runtime = createSinkRuntime({ sink, onSinkError, onSinkSuccess });

    runtime.enqueue(makeEvent('evt_1'));
    runtime.enqueue(makeEvent('evt_2'));
    await runtime.drain();

    expect(onSinkError).toHaveBeenCalledTimes(1);
    expect(onSinkSuccess).toHaveBeenCalledTimes(1);
    expect(emitted).toEqual(['evt_2']);
  });

  it('resolves drain best-effort on timeout', async () => {
    vi.useFakeTimers();
    const firstEmit = deferred<void>();
    const sink: Sink = {
      emit: vi.fn(() => firstEmit.promise),
    };
    const runtime = createSinkRuntime({
      sink,
      queue: { maxSize: 1 },
    });

    runtime.enqueue(makeEvent('evt_1'));
    await vi.runAllTicks();

    const drainPromise = runtime.drain({ timeoutMs: 25 });
    await vi.advanceTimersByTimeAsync(25);

    await expect(drainPromise).resolves.toBeUndefined();

    firstEmit.resolve(undefined);
    await vi.runAllTicks();
    vi.useRealTimers();
  });
});
