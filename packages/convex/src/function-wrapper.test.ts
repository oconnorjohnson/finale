import { describe, expect, it, vi } from 'vitest';
import {
  createFinale,
  defineFields,
  type FieldDefinition,
  type SchemaType,
} from '@finalejs/core/portable';
import { createTestSink } from '@finalejs/test';
import { convexFields } from './fields.js';
import { wrapConvexDefinition } from './function-wrapper.js';
import { mergeFieldRegistries } from './merge-field-registries.js';

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

function createFixture() {
  const sink = createTestSink();
  const finale = createFinale({
    fields: defineFields(
      mergeFieldRegistries(convexFields, {
        'request.id': makeField(),
        'convex.custom': makeField(),
      })
    ),
    sink,
  });

  return { sink, finale };
}

describe('wrapConvexDefinition', () => {
  it('emits one event on success and includes scope enrichment', async () => {
    const { sink, finale } = createFixture();
    const onStart = vi.fn();
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const wrapped = wrapConvexDefinition(
      {
        args: { requestId: 'validator' },
        handler: async (_ctx: object, args: { requestId: string }, scope) => {
          scope.event.add({
            'request.id': args.requestId,
            'convex.custom': 'enriched',
          });
          return { ok: true };
        },
      },
      {
        finale,
        kind: 'query',
        name: 'requests:get',
        onStart,
        onSuccess,
        onError,
      }
    );

    const result = await wrapped.handler({}, { requestId: 'req_1' });
    await finale.drain();

    expect(result).toEqual({ ok: true });
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
    expect(sink.allEvents()).toHaveLength(1);
    expect(sink.lastEvent()?.fields).toEqual(
      expect.objectContaining({
        'convex.function.kind': 'query',
        'convex.function.name': 'requests:get',
        'convex.function.outcome': 'success',
        'request.id': 'req_1',
        'convex.custom': 'enriched',
      })
    );
  });

  it('calls lifecycle hooks in the expected order', async () => {
    const { finale } = createFixture();
    const calls: string[] = [];
    const wrapped = wrapConvexDefinition(
      {
        handler: async (_ctx: object, _args: object, _scope) => {
          calls.push('handler');
          return { ok: true };
        },
      },
      {
        finale,
        kind: 'mutation',
        onStart: async () => {
          calls.push('onStart');
        },
        onSuccess: async () => {
          calls.push('onSuccess');
        },
      }
    );

    await wrapped.handler({}, {});
    await finale.drain();

    expect(calls).toEqual(['onStart', 'handler', 'onSuccess']);
  });

  it('emits one event on error and preserves the original thrown value', async () => {
    const { sink, finale } = createFixture();
    const original = new Error('boom');
    const onError = vi.fn();
    const wrapped = wrapConvexDefinition(
      {
        handler: async () => {
          throw original;
        },
      },
      {
        finale,
        kind: 'action',
        name: 'requests:notify',
        onError,
      }
    );

    await expect(wrapped.handler({}, {})).rejects.toBe(original);
    await finale.drain();

    expect(onError).toHaveBeenCalledTimes(1);
    expect(sink.allEvents()).toHaveLength(1);
    expect(sink.lastEvent()?.fields).toEqual(
      expect.objectContaining({
        'convex.function.kind': 'action',
        'convex.function.name': 'requests:notify',
        'convex.function.outcome': 'error',
        'error.class': 'Error',
        'error.message': 'boom',
      })
    );
  });

  it('preserves the original error if onError throws', async () => {
    const { sink, finale } = createFixture();
    const original = new Error('boom');
    const wrapped = wrapConvexDefinition(
      {
        handler: async () => {
          throw original;
        },
      },
      {
        finale,
        kind: 'action',
        onError: async () => {
          throw new Error('secondary');
        },
      }
    );

    await expect(wrapped.handler({}, {})).rejects.toBe(original);
    await finale.drain();

    expect(sink.allEvents()).toHaveLength(1);
    expect(sink.lastEvent()?.fields).toEqual(
      expect.objectContaining({
        'convex.function.kind': 'action',
        'convex.function.outcome': 'error',
        'error.message': 'boom',
      })
    );
  });

  it('does not emit convex.function.name when no name is provided', async () => {
    const { sink, finale } = createFixture();
    const wrapped = wrapConvexDefinition(
      {
        handler: async () => 'ok',
      },
      {
        finale,
        kind: 'query',
      }
    );

    await wrapped.handler({}, {});
    await finale.drain();

    expect(sink.lastEvent()?.fields).not.toHaveProperty('convex.function.name');
  });
});
