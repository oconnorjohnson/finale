import { describe, expect, it } from 'vitest';
import {
  createFinale,
  defineFields,
  type FieldDefinition,
  type SchemaType,
} from '@finalejs/core/portable';
import { assertFields, createTestSink } from '@finalejs/test';
import { convexFields } from './fields.js';
import { mergeFieldRegistries } from './merge-field-registries.js';
import { withFinaleAction } from './action-wrapper.js';
import { withFinaleHttpAction } from './http-wrapper.js';
import { withFinaleMutation } from './mutation-wrapper.js';
import { withFinaleQuery } from './query-wrapper.js';

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

function numberSchema(): SchemaType<number> {
  return {
    parse(value: unknown): number {
      if (typeof value !== 'number') {
        throw new Error('invalid');
      }
      return value;
    },
    safeParse(value: unknown) {
      if (typeof value !== 'number') {
        return { success: false as const, error: new Error('invalid') };
      }
      return { success: true as const, data: value };
    },
    isOptional(): boolean {
      return false;
    },
  };
}

function makeField(type: SchemaType<unknown>, overrides: Partial<FieldDefinition> = {}): FieldDefinition {
  return {
    type,
    group: 'core',
    sensitivity: 'safe',
    cardinality: 'low',
    priority: 'must-keep',
    ...overrides,
  };
}

describe('@finalejs/convex integration', () => {
  it('captures events across query, mutation, action, and http wrappers', async () => {
    const sink = createTestSink();
    const finale = createFinale({
      fields: defineFields(
        mergeFieldRegistries(convexFields, {
          'request.id': makeField(stringSchema()),
          'mutation.count': makeField(numberSchema()),
          'action.result': makeField(stringSchema()),
          'webhook.id': makeField(stringSchema()),
        })
      ),
      sink,
    });

    const query = withFinaleQuery(
      finale,
      {
        args: { requestId: 'validator' },
        handler: async (_ctx: object, args: { requestId: string }, scope) => {
          scope.event.add({ 'request.id': args.requestId });
          return { ok: true };
        },
      },
      { name: 'requests:get' }
    );
    const mutation = withFinaleMutation(
      finale,
      {
        args: { count: 'validator' },
        handler: async (_ctx: object, args: { count: number }, scope) => {
          scope.event.add({ 'mutation.count': args.count });
          return null;
        },
      },
      { name: 'requests:update' }
    );
    const action = withFinaleAction(
      finale,
      {
        args: { requestId: 'validator' },
        handler: async (_ctx: object, args: { requestId: string }, scope) => {
          scope.event.add({ 'action.result': `sent:${args.requestId}` });
          return { sent: true };
        },
      },
      { name: 'requests:notify' }
    );
    const http = withFinaleHttpAction(finale, {
      route: { path: '/webhooks/stripe', method: 'POST' },
      name: 'stripe:webhook',
      handler: async (_ctx, _request, scope) => {
        scope.event.add({ 'webhook.id': 'wh_123' });
        return new Response('ok', { status: 200 });
      },
    });

    await query.handler({}, { requestId: 'req_1' });
    await mutation.handler({}, { count: 2 });
    await action.handler({}, { requestId: 'req_1' });
    await http({}, new Request('https://example.com/webhooks/stripe', { method: 'POST' }));
    await finale.drain();

    expect(sink.allEvents()).toHaveLength(4);
    assertFields(sink.allEvents()[0], {
      'convex.function.kind': 'query',
      'request.id': 'req_1',
    });
    assertFields(sink.allEvents()[1], {
      'convex.function.kind': 'mutation',
      'mutation.count': 2,
    });
    assertFields(sink.allEvents()[2], {
      'convex.function.kind': 'action',
      'action.result': 'sent:req_1',
    });
    assertFields(sink.allEvents()[3], {
      'convex.function.kind': 'httpAction',
      'http.route': '/webhooks/stripe',
      'http.status_code': 200,
      'webhook.id': 'wh_123',
    });
  });

  it('preserves errors while recording error outcomes for wrapped handlers', async () => {
    const sink = createTestSink();
    const finale = createFinale({
      fields: defineFields(
        mergeFieldRegistries(convexFields, {
          'request.id': makeField(stringSchema()),
        })
      ),
      sink,
    });

    const action = withFinaleAction(
      finale,
      {
        args: { requestId: 'validator' },
        handler: async (_ctx: object, args: { requestId: string }, scope) => {
          scope.event.add({ 'request.id': args.requestId });
          throw new Error('notify failed');
        },
      },
      { name: 'requests:notify' }
    );
    const http = withFinaleHttpAction(finale, {
      route: { path: '/webhooks/stripe', method: 'POST' },
      name: 'stripe:webhook',
      handler: async () => {
        throw new Error('bad signature');
      },
      onError: async () => new Response('invalid signature', { status: 401 }),
    });

    await expect(action.handler({}, { requestId: 'req_2' })).rejects.toThrow('notify failed');
    await expect(
      http({}, new Request('https://example.com/webhooks/stripe', { method: 'POST' }))
    ).resolves.toMatchObject({ status: 401 });
    await finale.drain();

    expect(sink.allEvents()).toHaveLength(2);
    assertFields(sink.allEvents()[0], {
      'convex.function.kind': 'action',
      'convex.function.name': 'requests:notify',
      'convex.function.outcome': 'error',
      'request.id': 'req_2',
      'error.message': 'notify failed',
    });
    assertFields(sink.allEvents()[1], {
      'convex.function.kind': 'httpAction',
      'convex.function.name': 'stripe:webhook',
      'convex.function.outcome': 'error',
      'http.route': '/webhooks/stripe',
      'http.status_code': 401,
      'error.message': 'bad signature',
    });
  });
});
