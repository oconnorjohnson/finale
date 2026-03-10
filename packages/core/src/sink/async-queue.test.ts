import { describe, expect, it, vi } from 'vitest';
import type { FinalizedEvent, Sink } from '../types/index.js';
import { AsyncQueue } from './async-queue.js';

function makeEvent(id: string): FinalizedEvent {
  return {
    fields: { 'request.id': id },
    timings: {},
    metadata: {},
  };
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T | PromiseLike<T>) => void } {
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

describe('async sink queue', () => {
  it('invokes the queue-drop hook exactly once for queue-full decisions', async () => {
    const onQueueDrop = vi.fn();
    const sink: Sink = {
      emit: vi.fn(() => undefined),
    };
    const queue = new AsyncQueue({
      sink,
      maxSize: 1,
      dropPolicy: 'drop-newest',
      hooks: { onQueueDrop },
    });

    const first = queue.enqueue(makeEvent('req_1'), 'KEEP_NORMAL');
    const second = queue.enqueue(makeEvent('req_2'), 'KEEP_NORMAL');

    expect(first.admitted).toBe(true);
    expect(second).toMatchObject({
      admitted: false,
      reason: 'queue_full_drop_newest',
    });
    expect(onQueueDrop).toHaveBeenCalledTimes(1);
    await queue.drain();
  });

  it('records sink failures and continues processing later events', async () => {
    const onSinkFailure = vi.fn();
    const onSinkSuccess = vi.fn();
    const sink: Sink = {
      emit: vi.fn(async (event: FinalizedEvent) => {
        if (event.fields['request.id'] === 'req_1') {
          throw new Error('boom');
        }
      }),
    };
    const queue = new AsyncQueue({
      sink,
      maxSize: 2,
      hooks: { onSinkFailure, onSinkSuccess },
    });

    queue.enqueue(makeEvent('req_1'), 'KEEP_NORMAL');
    queue.enqueue(makeEvent('req_2'), 'KEEP_NORMAL');
    await queue.drain();

    expect(sink.emit).toHaveBeenCalledTimes(2);
    expect(onSinkFailure).toHaveBeenCalledTimes(1);
    expect(onSinkSuccess).toHaveBeenCalledTimes(1);
    expect(onSinkSuccess.mock.calls[0]?.[0]?.event.fields['request.id']).toBe('req_2');
    expect(onSinkFailure.mock.calls[0]?.[0]?.event.fields['request.id']).toBe('req_1');
  });

  it('reports successful sink emits exactly once per completed event', async () => {
    const onSinkSuccess = vi.fn();
    const sink: Sink = {
      emit: vi.fn(async () => undefined),
    };
    const queue = new AsyncQueue({
      sink,
      maxSize: 2,
      hooks: { onSinkSuccess },
    });

    queue.enqueue(makeEvent('req_1'), 'KEEP_NORMAL');
    queue.enqueue(makeEvent('req_2'), 'KEEP_DEBUG');
    await queue.drain();

    expect(onSinkSuccess).toHaveBeenCalledTimes(2);
  });

  it('rejects enqueue attempts while draining', async () => {
    const firstEmit = deferred<void>();
    const onQueueDrop = vi.fn();
    const sink: Sink = {
      emit: vi.fn(() => firstEmit.promise),
    };
    const queue = new AsyncQueue({
      sink,
      maxSize: 2,
      hooks: { onQueueDrop },
    });

    queue.enqueue(makeEvent('req_1'), 'KEEP_NORMAL');
    await waitForTurn();

    const drainPromise = queue.drain();
    const rejected = queue.enqueue(makeEvent('req_2'), 'KEEP_NORMAL');

    expect(rejected).toMatchObject({
      admitted: false,
      reason: 'queue_draining',
    });
    expect(onQueueDrop).toHaveBeenCalledTimes(1);

    firstEmit.resolve(undefined);
    await drainPromise;
  });

  it('waits for async emits to settle before running sink drain', async () => {
    const firstEmit = deferred<void>();
    const sinkDrain = vi.fn(async () => undefined);
    const sink: Sink = {
      emit: vi.fn(() => firstEmit.promise),
      drain: sinkDrain,
    };
    const queue = new AsyncQueue({
      sink,
      maxSize: 1,
    });

    queue.enqueue(makeEvent('req_1'), 'KEEP_DEBUG');
    await waitForTurn();

    const drainPromise = queue.drain();
    await waitForTurn();
    expect(sinkDrain).not.toHaveBeenCalled();

    firstEmit.resolve(undefined);
    await drainPromise;

    expect(sinkDrain).toHaveBeenCalledTimes(1);
  });

  it('resolves drain best-effort on timeout and reports pending entries', async () => {
    vi.useFakeTimers();
    const firstEmit = deferred<void>();
    const onDrainTimeout = vi.fn();
    const sink: Sink = {
      emit: vi.fn(() => firstEmit.promise),
    };
    const queue = new AsyncQueue({
      sink,
      maxSize: 2,
      hooks: { onDrainTimeout },
    });

    queue.enqueue(makeEvent('req_1'), 'KEEP_NORMAL');
    queue.enqueue(makeEvent('req_2'), 'KEEP_DEBUG');
    await vi.runAllTicks();

    const drainPromise = queue.drain({ timeoutMs: 50 });
    await vi.advanceTimersByTimeAsync(50);
    await expect(drainPromise).resolves.toBeUndefined();

    expect(onDrainTimeout).toHaveBeenCalledWith(1);

    firstEmit.resolve(undefined);
    await vi.runAllTicks();
    vi.useRealTimers();
  });

  it('swallows sink drain failures and reports them through the drain-failure hook', async () => {
    const onSinkDrainFailure = vi.fn();
    const sink: Sink = {
      emit: vi.fn(() => undefined),
      drain: vi.fn(async () => {
        throw new Error('drain failed');
      }),
    };
    const queue = new AsyncQueue({
      sink,
      hooks: { onSinkDrainFailure },
    });

    queue.enqueue(makeEvent('req_1'), 'KEEP_NORMAL');
    await queue.drain();

    expect(onSinkDrainFailure).toHaveBeenCalledTimes(1);
  });
});
