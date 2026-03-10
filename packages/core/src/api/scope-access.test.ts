import { describe, expect, it, vi } from 'vitest';
import { defineFields } from '../governance/field-registry.js';
import { getNoopScope } from '../runtime/noop-scope.js';
import type {
  FieldDefinition,
  FinalizedEvent,
  FlushReceipt,
  SchemaType,
  Scope,
  Sink,
} from '../types/index.js';
import { createFinale } from './create-finale.js';
import { getScope, hasScope, withScope } from './scope-access.js';

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

function createRecordingSink(): { sink: Sink; emitted: FinalizedEvent[] } {
  const emitted: FinalizedEvent[] = [];

  return {
    emitted,
    sink: {
      emit: vi.fn(async (record: FinalizedEvent) => {
        emitted.push(record);
      }),
    },
  };
}

describe('public scope access', () => {
  it('falls back to the no-op scope outside active context', () => {
    expect(hasScope()).toBe(false);
    expect(getScope()).toBe(getNoopScope());
  });

  it('exposes the active scope inside withScope', async () => {
    const finale = createFinale({
      fields: defineFields({}),
      sink: { emit: () => undefined },
    });

    await withScope(finale, async (scope) => {
      expect(hasScope()).toBe(true);
      expect(getScope()).toBe(scope);
    });

    expect(hasScope()).toBe(false);
    expect(getScope()).toBe(getNoopScope());
  });

  it('preserves nested scope stack semantics', async () => {
    const finale = createFinale({
      fields: defineFields({}),
      sink: { emit: () => undefined },
    });

    await withScope(finale, async (outer) => {
      expect(getScope()).toBe(outer);

      await withScope(finale, async (inner) => {
        expect(inner).not.toBe(outer);
        expect(getScope()).toBe(inner);
      });

      expect(getScope()).toBe(outer);
    });

    expect(hasScope()).toBe(false);
  });

  it('finalizes a provided custom scope after success', async () => {
    const finale = createFinale({
      fields: defineFields({}),
      sink: { emit: () => undefined },
    });
    const tracked = createTrackedScope();

    await withScope(finale, async () => undefined, { scope: tracked.scope });

    expect(tracked.flush).toHaveBeenCalledTimes(1);
  });

  it('finalizes a provided custom scope when the callback throws', async () => {
    const finale = createFinale({
      fields: defineFields({}),
      sink: { emit: () => undefined },
    });
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

  it('emits through an engine created by createFinale', async () => {
    const { emitted, sink } = createRecordingSink();
    const finale = createFinale({
      fields: defineFields({
        'request.id': makeField(),
      }),
      sink,
    });

    await withScope(finale, async (scope) => {
      scope.event.add({ 'request.id': 'req_public' });
    });

    await finale.drain();

    expect(emitted).toHaveLength(1);
    expect(emitted[0]?.fields['request.id']).toBe('req_public');
  });
});
