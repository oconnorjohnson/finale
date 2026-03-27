import { describe, expect, it, vi } from 'vitest';
import {
  createFinale,
  defineFields,
  type FieldDefinition,
  type SchemaType,
} from '@finalejs/core/portable';
import { createTestSink } from '@finalejs/test';
import { convexFields } from './fields.js';
import { withFinaleHttpAction } from './http-wrapper.js';
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
        'webhook.id': makeField(),
      })
    ),
    sink,
  });

  return { sink, finale };
}

describe('withFinaleHttpAction', () => {
  it('captures method, route, status, duration, and preserves the response', async () => {
    const { sink, finale } = createFixture();
    const onResponse = vi.fn();
    const handler = withFinaleHttpAction(finale, {
      route: { path: '/webhooks/stripe', method: 'POST' },
      name: 'stripe:webhook',
      onResponse,
      handler: async (_ctx, _request, scope) => {
        scope.event.add({ 'webhook.id': 'wh_123' });
        return new Response('accepted', { status: 202 });
      },
    });

    const response = await handler({}, new Request('https://example.com/webhooks/stripe', { method: 'POST' }));
    await finale.drain();

    expect(response.status).toBe(202);
    expect(await response.text()).toBe('accepted');
    expect(onResponse).toHaveBeenCalledTimes(1);
    expect(sink.lastEvent()?.fields).toEqual(
      expect.objectContaining({
        'convex.function.kind': 'httpAction',
        'convex.function.name': 'stripe:webhook',
        'convex.function.outcome': 'success',
        'http.method': 'POST',
        'http.route': '/webhooks/stripe',
        'http.status_code': 202,
        'webhook.id': 'wh_123',
      })
    );
    expect(Number(sink.lastEvent()?.fields['http.duration_ms'])).toBeGreaterThanOrEqual(0);
  });

  it('supports pathPrefix routes and fallback responses from onError', async () => {
    const { sink, finale } = createFixture();
    const handler = withFinaleHttpAction(
      finale,
      async () => {
        throw new Error('denied');
      },
      {
        route: { pathPrefix: '/public/', method: 'GET' },
        onError: async () => new Response('forbidden', { status: 403 }),
      }
    );

    const response = await handler({}, new Request('https://example.com/public/test', { method: 'GET' }));
    await finale.drain();

    expect(response.status).toBe(403);
    expect(await response.text()).toBe('forbidden');
    expect(sink.lastEvent()?.fields).toEqual(
      expect.objectContaining({
        'http.method': 'GET',
        'http.route': '/public/*',
        'http.status_code': 403,
        'convex.function.outcome': 'error',
        'error.message': 'denied',
      })
    );
  });

  it('rethrows when no fallback response is provided', async () => {
    const { finale } = createFixture();
    const original = new Error('boom');
    const handler = withFinaleHttpAction(finale, {
      route: { path: '/boom', method: 'POST' },
      handler: async () => {
        throw original;
      },
    });

    await expect(handler({}, new Request('https://example.com/boom', { method: 'POST' }))).rejects.toBe(original);
  });

  it('throws immediately when route metadata is missing', () => {
    const { finale } = createFixture();

    expect(() =>
      withFinaleHttpAction(finale, {
        handler: async () => new Response(null, { status: 200 }),
      } as never)
    ).toThrowError('withFinaleHttpAction requires route metadata');
  });
});
