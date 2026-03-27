import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import * as core from '../index.js';
import type { ExpressMiddlewareOptions, ExpressTraceContext } from '../index.js';

function stringType() {
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

function makeField(overrides: Record<string, unknown> = {}) {
  return {
    type: stringType(),
    group: 'core',
    sensitivity: 'safe',
    cardinality: 'low',
    priority: 'must-keep',
    ...overrides,
  };
}

class MockRequest extends EventEmitter {
  public headers: Record<string, string | string[] | undefined>;
  public method?: string;
  public path?: string;

  constructor(options: {
    headers?: Record<string, string | string[] | undefined>;
    method?: string;
    path?: string;
  } = {}) {
    super();
    this.headers = options.headers ?? {};
    this.method = options.method;
    this.path = options.path;
  }
}

class MockResponse extends EventEmitter {
  public statusCode: number;

  constructor(statusCode = 200) {
    super();
    this.statusCode = statusCode;
  }
}

describe('public API examples', () => {
  it('supports the documented engine flow through the package root', async () => {
    const emitted: Array<{ fields: Record<string, unknown> }> = [];
    const finale = core.createFinale({
      fields: core.defineFields({
        'request.id': makeField(),
        'http.method': makeField(),
      }),
      sink: {
        emit(record) {
          emitted.push(record);
        },
      },
    });

    await core.withScope(finale, async (scope) => {
      scope.event.add({
        'request.id': 'req_example',
        'http.method': 'GET',
      });
    });

    await finale.drain();

    expect(emitted).toHaveLength(1);
    expect(emitted[0]?.fields).toEqual({
      'request.id': 'req_example',
      'http.method': 'GET',
    });
  });

  it('captures structurally valid try-error objects through the package root API', async () => {
    const emitted: Array<{ fields: Record<string, unknown> }> = [];
    const finale = core.createFinale({
      fields: core.defineFields({
        'request.id': makeField(),
      }),
      sink: {
        emit(record) {
          emitted.push(record);
        },
      },
    });

    await core.withScope(finale, async (scope) => {
      scope.event.add({ 'request.id': 'req_try_error' });
      scope.event.error({
        type: 'ValidationError',
        message: 'Invalid email',
        source: 'user.ts:10:2',
        timestamp: 100,
      });
    });

    await finale.drain();

    expect(emitted).toHaveLength(1);
    expect(emitted[0]?.fields['request.id']).toBe('req_try_error');
    expect(emitted[0]?.fields['error.class']).toBe('ValidationError');
    expect(emitted[0]?.fields['error.message']).toBe('Invalid email');
  });

  it('supports the documented express middleware flow through the package root', async () => {
    const emitted: Array<{ fields: Record<string, unknown> }> = [];
    const finale = core.createFinale({
      fields: core.defineFields({
        'trace.id': makeField(),
        'span.id': makeField(),
        'request.id': makeField(),
        'http.route': makeField(),
        'http.method': makeField(),
        'http.status_code': makeField(),
        'domain.step': makeField({ group: 'domain' }),
      }),
      sink: {
        emit(record) {
          emitted.push(record);
        },
      },
    });

    const middlewareOptions: ExpressMiddlewareOptions = {
      onRequest(scope, req) {
        scope.event.add({
          'request.id': req.headers['x-request-id'],
          'http.route': req.path,
          'http.method': req.method,
        });
      },
      onResponse(scope, _req, res) {
        scope.event.add({
          'http.status_code': String(res.statusCode),
        });
      },
      extractTraceContext(req): ExpressTraceContext {
        return {
          traceId: req.headers['x-trace-id'] as string,
          spanId: req.headers['x-span-id'] as string,
        };
      },
    };

    const middleware = core.expressMiddleware(finale, middlewareOptions);
    const req = new MockRequest({
      headers: {
        'x-request-id': 'req_http',
        'x-trace-id': 'trace_http',
        'x-span-id': 'span_http',
      },
      method: 'POST',
      path: '/checkout',
    });
    const res = new MockResponse(201);

    await new Promise<void>((resolve, reject) => {
      middleware(req as never, res as never, (error?: unknown) => {
        if (error) {
          reject(error);
          return;
        }

        try {
          core.getScope().event.add({ 'domain.step': 'handler' });
          res.emit('finish');
          resolve();
        } catch (caught) {
          reject(caught);
        }
      });
    });

    await finale.drain();

    expect(emitted).toHaveLength(1);
    expect(emitted[0]?.fields).toEqual({
      'trace.id': 'trace_http',
      'span.id': 'span_http',
      'request.id': 'req_http',
      'http.route': '/checkout',
      'http.method': 'POST',
      'http.status_code': '201',
      'domain.step': 'handler',
    });
  });
});
