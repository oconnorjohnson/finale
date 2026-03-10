import { describe, expect, it, vi } from 'vitest';
import { AccumulationScope } from '../accumulation/scope.js';
import type { FieldDefinition, FinalizedEvent, SchemaType, Sink } from '../types/index.js';
import { attachSinkRuntime } from './attachment.js';
import { createScopeSinkRuntime } from './scope-runtime.js';

function stringSchema(): SchemaType<string> {
  return {
    parse(value: unknown): string {
      if (typeof value !== 'string') {
        throw new Error('invalid');
      }
      return value;
    },
    safeParse(value: unknown) {
      if (typeof value !== 'string') {
        return { success: false as const, error: new Error('invalid') };
      }
      return { success: true as const, data: value };
    },
    isOptional(): boolean {
      return false;
    },
  };
}

function makeField(overrides: Partial<FieldDefinition> = {}): FieldDefinition {
  return {
    type: stringSchema(),
    group: 'core',
    sensitivity: 'safe',
    cardinality: 'low',
    priority: 'must-keep',
    ...overrides,
  };
}

function createDeferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });

  return { promise, resolve, reject };
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function createControlledSink(): {
  sink: Sink;
  completedEvents: FinalizedEvent[];
  attemptedEvents: FinalizedEvent[];
  drainCalls: () => number;
  blockNextEmit: () => { started: Promise<void>; release: () => void };
  failNextEmit: (error?: Error) => { started: Promise<void> };
} {
  const completedEvents: FinalizedEvent[] = [];
  const attemptedEvents: FinalizedEvent[] = [];
  let emitIndex = 0;
  let sinkDrainCalls = 0;
  const controls: Array<{
    started: ReturnType<typeof createDeferred<void>>;
    gate?: ReturnType<typeof createDeferred<void>>;
    error?: Error;
  }> = [];

  function ensureControl(index: number) {
    if (!controls[index]) {
      controls[index] = { started: createDeferred<void>() };
    }

    return controls[index];
  }

  const sink: Sink = {
    async emit(record: FinalizedEvent): Promise<void> {
      const control = ensureControl(emitIndex);
      emitIndex += 1;

      attemptedEvents.push(record);
      control.started.resolve();

      if (control.error) {
        throw control.error;
      }

      if (control.gate) {
        await control.gate.promise;
      }

      completedEvents.push(record);
    },
    async drain(): Promise<void> {
      sinkDrainCalls += 1;
    },
  };

  return {
    sink,
    completedEvents,
    attemptedEvents,
    drainCalls: () => sinkDrainCalls,
    blockNextEmit() {
      const control = ensureControl(controls.length);
      control.gate = createDeferred<void>();

      return {
        started: control.started.promise,
        release: () => control.gate?.resolve(),
      };
    },
    failNextEmit(error = new Error('sink failure')) {
      const control = ensureControl(controls.length);
      control.error = error;

      return {
        started: control.started.promise,
      };
    },
  };
}

function createRuntimeBackedScope(options: {
  sinkControl?: ReturnType<typeof createControlledSink>;
  samplingDecision?: 'DROP' | 'KEEP_MINIMAL' | 'KEEP_NORMAL' | 'KEEP_DEBUG';
  queue?: { maxSize?: number; dropPolicy?: 'drop-newest' | 'drop-oldest' | 'drop-lowest-tier' };
  onSinkError?: (error: unknown, record: FinalizedEvent) => void;
}) {
  const sinkControl = options.sinkControl ?? createControlledSink();
  const runtime = createScopeSinkRuntime({
    sink: sinkControl.sink,
    queue: options.queue,
    onSinkError: options.onSinkError,
  });

  const scope = new AccumulationScope({
    fieldRegistry: {
      'request.id': makeField(),
      'user.id': makeField({ group: 'domain' }),
    },
    sampling: options.samplingDecision
      ? {
          policy: {
            decide: () => ({ decision: options.samplingDecision! }),
          },
        }
      : undefined,
  });

  attachSinkRuntime(scope, runtime);

  return { scope, runtime, sinkControl };
}

describe('sink integration', () => {
  it('delivers keep-path events through the runtime queue', async () => {
    const sinkControl = createControlledSink();
    const blockedEmit = sinkControl.blockNextEmit();
    const { scope, runtime } = createRuntimeBackedScope({
      sinkControl,
      samplingDecision: 'KEEP_MINIMAL',
      queue: { maxSize: 2 },
    });

    scope.event.add({
      'request.id': 'req_1',
      'user.id': 'usr_1',
    });

    const receipt = scope.event.flush();

    expect(receipt.decision.decision).toBe('KEEP_MINIMAL');
    expect(receipt.emitted).toBe(true);

    await blockedEmit.started;
    expect(sinkControl.completedEvents).toHaveLength(0);

    blockedEmit.release();
    await runtime.drain();

    expect(sinkControl.completedEvents).toHaveLength(1);
    expect(sinkControl.completedEvents[0]?.fields).toEqual({
      'request.id': 'req_1',
    });
  });

  it('bypasses the sink path when sampling drops the event', async () => {
    const { scope, runtime, sinkControl } = createRuntimeBackedScope({
      samplingDecision: 'DROP',
      queue: { maxSize: 2 },
    });

    scope.event.add({ 'request.id': 'req_drop' });
    const receipt = scope.event.flush();

    expect(receipt.decision.decision).toBe('DROP');
    expect(receipt.emitted).toBe(false);

    await runtime.drain();

    expect(sinkControl.completedEvents).toHaveLength(0);
    expect(sinkControl.attemptedEvents).toHaveLength(0);
    expect(sinkControl.drainCalls()).toBe(1);
  });

  it('rejects the newest event when the queue is full with drop-newest', async () => {
    const sinkControl = createControlledSink();
    const blockedEmit = sinkControl.blockNextEmit();
    const runtime = createScopeSinkRuntime({
      sink: sinkControl.sink,
      queue: { maxSize: 2, dropPolicy: 'drop-newest' },
    });

    const scope1 = new AccumulationScope();
    const scope2 = new AccumulationScope();
    const scope3 = new AccumulationScope();
    attachSinkRuntime(scope1, runtime);
    attachSinkRuntime(scope2, runtime);
    attachSinkRuntime(scope3, runtime);

    scope1.event.add({ 'request.id': 'req_1' });
    scope2.event.add({ 'request.id': 'req_2' });
    scope3.event.add({ 'request.id': 'req_3' });

    const receipt1 = scope1.event.flush();
    const receipt2 = scope2.event.flush();
    const receipt3 = scope3.event.flush();

    expect(receipt1.emitted).toBe(true);
    expect(receipt2.emitted).toBe(true);
    expect(receipt3.emitted).toBe(false);

    await blockedEmit.started;
    blockedEmit.release();
    await runtime.drain();

    expect(sinkControl.completedEvents.map((event) => event.fields['request.id'])).toEqual(['req_1', 'req_2']);
  });

  it('evicts the oldest queued event when the queue is full with drop-oldest', async () => {
    const sinkControl = createControlledSink();
    const blockedEmit = sinkControl.blockNextEmit();
    const runtime = createScopeSinkRuntime({
      sink: sinkControl.sink,
      queue: { maxSize: 2, dropPolicy: 'drop-oldest' },
    });

    const scope1 = new AccumulationScope();
    const scope2 = new AccumulationScope();
    const scope3 = new AccumulationScope();
    attachSinkRuntime(scope1, runtime);
    attachSinkRuntime(scope2, runtime);
    attachSinkRuntime(scope3, runtime);

    scope1.event.add({ 'request.id': 'req_1' });
    scope2.event.add({ 'request.id': 'req_2' });
    scope3.event.add({ 'request.id': 'req_3' });

    const receipt1 = scope1.event.flush();
    const receipt2 = scope2.event.flush();
    const receipt3 = scope3.event.flush();

    expect(receipt1.emitted).toBe(true);
    expect(receipt2.emitted).toBe(true);
    expect(receipt3.emitted).toBe(true);

    await blockedEmit.started;
    blockedEmit.release();
    await runtime.drain();

    expect(sinkControl.completedEvents.map((event) => event.fields['request.id'])).toEqual(['req_2', 'req_3']);
  });

  it('continues delivering later events after an async sink failure', async () => {
    const sinkControl = createControlledSink();
    const failedEmit = sinkControl.failNextEmit(new Error('boom'));
    const onSinkError = vi.fn();
    const runtime = createScopeSinkRuntime({
      sink: sinkControl.sink,
      queue: { maxSize: 2 },
      onSinkError,
    });

    const scope1 = new AccumulationScope();
    const scope2 = new AccumulationScope();
    attachSinkRuntime(scope1, runtime);
    attachSinkRuntime(scope2, runtime);

    scope1.event.add({ 'request.id': 'req_1' });
    scope2.event.add({ 'request.id': 'req_2' });

    expect(() => scope1.event.flush()).not.toThrow();
    await failedEmit.started;
    await flushMicrotasks();
    expect(() => scope2.event.flush()).not.toThrow();

    await runtime.drain();

    expect(onSinkError).toHaveBeenCalledTimes(1);
    expect(sinkControl.attemptedEvents.map((event) => event.fields['request.id'])).toEqual(['req_1', 'req_2']);
    expect(sinkControl.completedEvents.map((event) => event.fields['request.id'])).toEqual(['req_2']);
  });

  it('waits for in-flight work during drain', async () => {
    const sinkControl = createControlledSink();
    const blockedEmit = sinkControl.blockNextEmit();
    const runtime = createScopeSinkRuntime({
      sink: sinkControl.sink,
      queue: { maxSize: 2 },
    });
    const scope = new AccumulationScope();
    attachSinkRuntime(scope, runtime);

    scope.event.add({ 'request.id': 'req_1' });
    const receipt = scope.event.flush();

    expect(receipt.emitted).toBe(true);

    await blockedEmit.started;

    let resolved = false;
    const drainPromise = runtime.drain().then(() => {
      resolved = true;
    });

    await flushMicrotasks();
    expect(resolved).toBe(false);

    blockedEmit.release();
    await drainPromise;

    expect(resolved).toBe(true);
  });

  it('resolves drain best-effort when the timeout elapses before in-flight work finishes', async () => {
    vi.useFakeTimers();

    const sinkControl = createControlledSink();
    const blockedEmit = sinkControl.blockNextEmit();
    const onDrainTimeout = vi.fn();
    const runtime = createScopeSinkRuntime({
      sink: sinkControl.sink,
      queue: { maxSize: 2 },
      onDrainTimeout,
    });
    const scope = new AccumulationScope();
    attachSinkRuntime(scope, runtime);

    scope.event.add({ 'request.id': 'req_1' });
    scope.event.flush();
    await blockedEmit.started;

    const drainPromise = runtime.drain({ timeoutMs: 25 });
    await vi.advanceTimersByTimeAsync(25);

    await expect(drainPromise).resolves.toBeUndefined();
    expect(onDrainTimeout).toHaveBeenCalledWith(0);

    blockedEmit.release();
    await flushMicrotasks();
    vi.useRealTimers();
  });
});
