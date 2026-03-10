import { describe, expect, it } from 'vitest';
import { defineFields } from '../governance/field-registry.js';
import { endScope, startScope } from '../runtime/lifecycle.js';
import { withScope } from '../runtime/scope-manager.js';
import type {
  FieldDefinition,
  FinalizedEvent,
  FlushReceipt,
  SamplingPolicy,
  SchemaType,
  Sink,
} from '../types/index.js';
import { createFinale } from './create-finale.js';

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

function createDeferred<T = void>(): {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
} {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve;
  });

  return { promise, resolve };
}

function createControlledSink(): {
  sink: Sink;
  attemptedEvents: FinalizedEvent[];
  completedEvents: FinalizedEvent[];
  blockNextEmit: () => { started: Promise<void>; release: () => void };
} {
  const attemptedEvents: FinalizedEvent[] = [];
  const completedEvents: FinalizedEvent[] = [];
  const controls: Array<{
    started: ReturnType<typeof createDeferred<void>>;
    gate?: ReturnType<typeof createDeferred<void>>;
  }> = [];
  let emitIndex = 0;

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
      control.started.resolve(undefined);

      if (control.gate) {
        await control.gate.promise;
      }

      completedEvents.push(record);
    },
  };

  return {
    sink,
    attemptedEvents,
    completedEvents,
    blockNextEmit() {
      const control = ensureControl(controls.length);
      control.gate = createDeferred<void>();

      return {
        started: control.started.promise,
        release: () => control.gate?.resolve(undefined),
      };
    },
  };
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('createFinale', () => {
  it('returns an engine with zeroed metrics and drain', () => {
    const finale = createFinale({
      fields: defineFields({}),
      sink: { emit: () => undefined },
    });

    expect(finale.metrics.eventsEmitted).toBe(0);
    expect(finale.metrics.eventsDropped).toBe(0);
    expect(finale.metrics.eventsSampledOut).toBe(0);
    expect(finale.metrics.fieldsDropped).toBe(0);
    expect(finale.metrics.redactionsApplied).toBe(0);
    expect(finale.metrics.schemaViolations).toBe(0);
    expect(finale.metrics.sinkFailures).toBe(0);
    expect(finale.metrics.queueDrops).toBe(0);
    expect(finale.metrics.snapshot()).toEqual({
      eventsEmitted: 0,
      eventsDropped: 0,
      eventsSampledOut: 0,
      fieldsDropped: 0,
      redactionsApplied: 0,
      schemaViolations: 0,
      sinkFailures: 0,
      queueDrops: 0,
    });
    expect(typeof finale.drain).toBe('function');
  });

  it('emits through the engine-owned sink runtime when withScope finalizes', async () => {
    const sinkControl = createControlledSink();
    const finale = createFinale({
      fields: defineFields({
        'request.id': makeField(),
      }),
      sink: sinkControl.sink,
    });

    await withScope(finale, async (scope) => {
      scope.event.add({ 'request.id': 'req_1' });
    });

    await finale.drain();

    expect(sinkControl.completedEvents).toHaveLength(1);
    expect(sinkControl.completedEvents[0]?.fields['request.id']).toBe('req_1');
    expect(finale.metrics.eventsEmitted).toBe(1);
    expect(finale.metrics.eventsDropped).toBe(0);
  });

  it('waits for a blocked in-flight emit during finale.drain', async () => {
    const sinkControl = createControlledSink();
    const blocked = sinkControl.blockNextEmit();
    const finale = createFinale({
      fields: defineFields({
        'request.id': makeField(),
      }),
      sink: sinkControl.sink,
    });

    await withScope(finale, async (scope) => {
      scope.event.add({ 'request.id': 'req_1' });
    });

    await blocked.started;

    let drained = false;
    const drainPromise = finale.drain().then(() => {
      drained = true;
    });

    await flushMicrotasks();
    expect(drained).toBe(false);

    blocked.release();
    await drainPromise;

    expect(drained).toBe(true);
  });

  it('honors queue configuration through the engine-owned runtime', async () => {
    const sinkControl = createControlledSink();
    const blocked = sinkControl.blockNextEmit();
    const finale = createFinale({
      fields: defineFields({
        'request.id': makeField(),
      }),
      sink: sinkControl.sink,
      queue: {
        maxSize: 1,
        dropPolicy: 'drop-newest',
      },
    });

    const firstContext = startScope(finale);
    firstContext.scope.event.add({ 'request.id': 'req_1' });
    const firstReceipt: FlushReceipt = endScope(firstContext);
    await blocked.started;

    const secondContext = startScope(finale);
    secondContext.scope.event.add({ 'request.id': 'req_2' });
    const secondReceipt: FlushReceipt = endScope(secondContext);

    expect(firstReceipt.emitted).toBe(true);
    expect(secondReceipt.emitted).toBe(false);

    blocked.release();
    await finale.drain();

    expect(finale.metrics.eventsEmitted).toBe(1);
    expect(finale.metrics.eventsDropped).toBe(1);
    expect(finale.metrics.queueDrops).toBe(1);
  });

  it('applies defaults to default-created scopes', async () => {
    const sinkControl = createControlledSink();
    const finale = createFinale({
      fields: defineFields({
        'request.id': makeField(),
        'service.name': makeField(),
      }),
      sink: sinkControl.sink,
      defaults: {
        'service.name': 'checkout-api',
      },
    });

    await withScope(finale, async (scope) => {
      scope.event.add({ 'request.id': 'req_1' });
    });

    await finale.drain();

    expect(sinkControl.completedEvents[0]?.fields['service.name']).toBe('checkout-api');
  });

  it('applies soft validation to default-created scopes', async () => {
    const sinkControl = createControlledSink();
    const finale = createFinale({
      fields: defineFields({
        'http.route': makeField(),
      }),
      sink: sinkControl.sink,
      validation: 'soft',
    });

    await withScope(finale, async (scope) => {
      scope.event.add({
        'http.route': 123,
        unknown: 'value',
      });
    });

    await finale.drain();

    expect(sinkControl.completedEvents[0]?.fields).toEqual({});
    expect(sinkControl.completedEvents[0]?.metadata.droppedFields).toEqual(['http.route', 'unknown']);
    expect(finale.metrics.schemaViolations).toBe(2);
    expect(finale.metrics.fieldsDropped).toBe(2);
  });

  it('applies sampling policy to default-created scopes', async () => {
    const dropPolicy: SamplingPolicy = {
      decide: () => ({ decision: 'DROP', reason: 'forced' }),
    };
    const keepMinimalPolicy: SamplingPolicy = {
      decide: () => ({ decision: 'KEEP_MINIMAL', reason: 'forced' }),
    };

    const droppingSink = createControlledSink();
    const droppingFinale = createFinale({
      fields: defineFields({
        'request.id': makeField(),
      }),
      sink: droppingSink.sink,
      sampling: dropPolicy,
    });

    const droppingContext = startScope(droppingFinale);
    droppingContext.scope.event.add({ 'request.id': 'req_drop' });
    const dropReceipt: FlushReceipt = endScope(droppingContext);
    await droppingFinale.drain();

    expect(dropReceipt.emitted).toBe(false);
    expect(droppingSink.completedEvents).toHaveLength(0);
    expect(droppingFinale.metrics.eventsDropped).toBe(1);
    expect(droppingFinale.metrics.eventsSampledOut).toBe(1);
    expect(droppingFinale.metrics.eventsEmitted).toBe(0);

    const keepingSink = createControlledSink();
    const keepingFinale = createFinale({
      fields: defineFields({
        'request.id': makeField(),
        'user.id': makeField({ group: 'domain' }),
      }),
      sink: keepingSink.sink,
      sampling: keepMinimalPolicy,
    });

    await withScope(keepingFinale, async (scope) => {
      scope.event.add({
        'request.id': 'req_keep',
        'user.id': 'usr_1',
      });
    });
    await keepingFinale.drain();

    expect(keepingSink.completedEvents[0]?.fields).toEqual({ 'request.id': 'req_keep' });
    expect(keepingFinale.metrics.eventsEmitted).toBe(1);
    expect(keepingFinale.metrics.eventsDropped).toBe(0);
  });

  it('applies limits to default-created scopes', async () => {
    const sinkControl = createControlledSink();
    const finale = createFinale({
      fields: defineFields({
        keep: makeField(),
        dropMe: makeField({ priority: 'drop-first' }),
      }),
      sink: sinkControl.sink,
      limits: {
        maxTotalSize: 100,
      },
    });

    await withScope(finale, async (scope) => {
      scope.event.add({
        keep: 'x'.repeat(60),
        dropMe: 'x'.repeat(60),
      });
    });
    await finale.drain();

    expect(sinkControl.completedEvents[0]?.fields.keep).toBeDefined();
    expect(sinkControl.completedEvents[0]?.fields.dropMe).toBeUndefined();
    expect(finale.metrics.fieldsDropped).toBe(1);
  });

  it('counts sink emit failures in metrics without counting successful emission', async () => {
    const finale = createFinale({
      fields: defineFields({
        'request.id': makeField(),
      }),
      sink: {
        emit: async () => {
          throw new Error('boom');
        },
      },
    });

    await withScope(finale, async (scope) => {
      scope.event.add({ 'request.id': 'req_fail' });
    });
    await finale.drain();

    expect(finale.metrics.sinkFailures).toBe(1);
    expect(finale.metrics.eventsDropped).toBe(1);
    expect(finale.metrics.eventsEmitted).toBe(0);
  });

  it('counts redactions in metrics', async () => {
    const sinkControl = createControlledSink();
    const finale = createFinale({
      fields: defineFields({
        token: {
          ...makeField(),
          transform: 'mask',
        },
      }),
      sink: sinkControl.sink,
    });

    await withScope(finale, async (scope) => {
      scope.event.add({ token: 'secret-token' });
    });
    await finale.drain();

    expect(finale.metrics.redactionsApplied).toBe(1);
    expect(sinkControl.completedEvents[0]?.fields.token).toBe('[REDACTED]');
  });
});
