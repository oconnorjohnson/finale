import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FlushReceipt, Scope } from '../../types/index.js';
import { getNoopScope } from '../../runtime/noop-scope.js';
import { getScope, hasScope } from '../../runtime/scope-manager.js';

const lifecycleMocks = vi.hoisted(() => ({
  startScope: vi.fn(),
  endScope: vi.fn(),
}));

vi.mock('../../runtime/lifecycle.js', () => lifecycleMocks);

import { expressMiddleware } from './express.js';

type AddCall = Record<string, unknown>;

interface TrackedScope {
  scope: Scope;
  addCalls: AddCall[];
  errorCalls: unknown[];
  annotations: string[];
  subEvents: Array<{ name: string; fields?: Record<string, unknown> }>;
  startedTimers: string[];
  endedTimers: string[];
  flush: ReturnType<typeof vi.fn>;
}

class MockRequest extends EventEmitter {
  public headers: Record<string, string | string[] | undefined>;
  public method?: string;
  public path?: string;

  constructor(options: { headers?: Record<string, string | string[] | undefined>; method?: string; path?: string } = {}) {
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

function createReceipt(): FlushReceipt {
  return {
    emitted: true,
    decision: { decision: 'KEEP_NORMAL' },
    fieldsDropped: [],
    fieldsRedacted: [],
    finalSize: 128,
  };
}

function createTrackedScope(): TrackedScope {
  const addCalls: AddCall[] = [];
  const errorCalls: unknown[] = [];
  const annotations: string[] = [];
  const subEvents: Array<{ name: string; fields?: Record<string, unknown> }> = [];
  const startedTimers: string[] = [];
  const endedTimers: string[] = [];
  const flush = vi.fn(() => createReceipt());

  const scope: Scope = {
    event: {
      add(fields): void {
        addCalls.push(fields);
      },
      child(namespace) {
        return {
          add(fields): void {
            addCalls.push(
              Object.fromEntries(
                Object.entries(fields).map(([key, value]) => [`${namespace}.${key}`, value])
              )
            );
          },
        };
      },
      error(error): void {
        errorCalls.push(error);
      },
      annotate(tag): void {
        annotations.push(tag);
      },
      subEvent(name, fields): void {
        subEvents.push(fields ? { name, fields } : { name });
      },
      flush,
    },
    timers: {
      start(name): void {
        startedTimers.push(name);
      },
      end(name): void {
        endedTimers.push(name);
      },
      measure<T>(_name: string, fn: () => T | Promise<T>): T | Promise<T> {
        return fn();
      },
    },
  };

  return { scope, addCalls, errorCalls, annotations, subEvents, startedTimers, endedTimers, flush };
}

async function invokeMiddleware(options: {
  tracked: TrackedScope;
  req?: MockRequest;
  res?: MockResponse;
  handler?: (req: MockRequest, res: MockResponse) => void | Promise<void>;
  middlewareOptions?: Parameters<typeof expressMiddleware>[1];
}): Promise<{ req: MockRequest; res: MockResponse; nextError?: unknown }> {
  const tracked = options.tracked;
  const req = options.req ?? new MockRequest();
  const res = options.res ?? new MockResponse();
  const runtimeScope = { scope: tracked.scope, startedAt: Date.now(), finalized: false };

  lifecycleMocks.startScope.mockReturnValue(runtimeScope);
  lifecycleMocks.endScope.mockImplementation((context) => {
    context.finalized = true;
    context.lastReceipt = tracked.flush();
    return context.lastReceipt;
  });

  const middleware = expressMiddleware(
    {
      metrics: {
        eventsEmitted: 0,
        eventsDropped: 0,
        eventsSampledOut: 0,
        fieldsDropped: 0,
        redactionsApplied: 0,
        schemaViolations: 0,
        sinkFailures: 0,
        queueDrops: 0,
        snapshot() {
          return {
            eventsEmitted: 0,
            eventsDropped: 0,
            eventsSampledOut: 0,
            fieldsDropped: 0,
            redactionsApplied: 0,
            schemaViolations: 0,
            sinkFailures: 0,
            queueDrops: 0,
          };
        },
      },
      async drain(): Promise<void> {},
    },
    options.middlewareOptions
  );

  let nextError: unknown;

  await new Promise<void>((resolve, reject) => {
    middleware(req, res, (error) => {
      nextError = error;
      if (error !== undefined || !options.handler) {
        resolve();
        return;
      }

      void Promise.resolve(options.handler(req, res)).then(() => resolve(), reject);
    });
  });

  return { req, res, ...(nextError !== undefined ? { nextError } : {}) };
}

beforeEach(() => {
  lifecycleMocks.startScope.mockReset();
  lifecycleMocks.endScope.mockReset();
});

afterEach(() => {
  expect(hasScope()).toBe(false);
  expect(getScope()).toBe(getNoopScope());
});

describe('express middleware', () => {
  it('creates a request scope, propagates async context, and flushes once on finish', async () => {
    const tracked = createTrackedScope();
    const req = new MockRequest({
      headers: { 'x-trace-id': 'trace-123', 'x-span-id': 'span-456' },
      method: 'POST',
      path: '/checkout',
    });
    const res = new MockResponse(201);

    await invokeMiddleware({
      tracked,
      req,
      res,
      middlewareOptions: {
        extractTraceContext(request) {
          return {
            traceId: request.headers['x-trace-id'] as string,
            spanId: request.headers['x-span-id'] as string,
          };
        },
        onRequest(scope, request) {
          scope.event.add({
            'http.route': request.path,
            'http.method': request.method,
          });
        },
        onResponse(scope, _request, response) {
          scope.event.add({ 'http.status_code': response.statusCode });
        },
      },
      handler: async () => {
        getScope().event.add({ 'domain.step': 'handler-start' });
        await Promise.resolve();
        getScope().event.child('domain').add({ async: true });
        res.emit('finish');
        res.emit('close');
      },
    });

    expect(tracked.flush).toHaveBeenCalledTimes(1);
    expect(lifecycleMocks.endScope).toHaveBeenCalledTimes(1);
    expect(tracked.addCalls).toEqual([
      { 'trace.id': 'trace-123', 'span.id': 'span-456' },
      { 'http.route': '/checkout', 'http.method': 'POST' },
      { 'domain.step': 'handler-start' },
      { 'domain.async': true },
      expect.objectContaining({ 'http.duration_ms': expect.any(Number) }),
      { 'http.status_code': 201 },
    ]);
  });

  it('shares manual flush and terminal flush through a single finalize path', async () => {
    const tracked = createTrackedScope();
    const res = new MockResponse(204);

    await invokeMiddleware({
      tracked,
      res,
      handler: () => {
        const scope = getScope();
        const receipt = scope.event.flush();
        expect(receipt.emitted).toBe(true);

        scope.event.add({ 'post.flush': true });
        scope.event.annotate('after-flush');
        scope.timers.start('ignored');
        scope.timers.end('ignored');

        res.emit('finish');
      },
    });

    expect(tracked.flush).toHaveBeenCalledTimes(1);
    expect(lifecycleMocks.endScope).toHaveBeenCalledTimes(1);
    expect(tracked.addCalls).toEqual([
      expect.objectContaining({ 'http.duration_ms': expect.any(Number) }),
    ]);
    expect(tracked.annotations).toEqual([]);
    expect(tracked.startedTimers).toEqual([]);
    expect(tracked.endedTimers).toEqual([]);
  });

  it('forwards onRequest errors to next and still finalizes on finish', async () => {
    const tracked = createTrackedScope();
    const res = new MockResponse();
    const requestError = new Error('request hook failed');

    const result = await invokeMiddleware({
      tracked,
      res,
      middlewareOptions: {
        onRequest() {
          throw requestError;
        },
      },
    });

    expect(result.nextError).toBe(requestError);
    res.emit('finish');

    expect(tracked.errorCalls).toEqual([requestError]);
    expect(tracked.flush).toHaveBeenCalledTimes(1);
  });

  it('captures onResponse errors and continues flushing', async () => {
    const tracked = createTrackedScope();
    const res = new MockResponse();
    const responseError = new Error('response hook failed');

    await invokeMiddleware({
      tracked,
      res,
      middlewareOptions: {
        onResponse() {
          throw responseError;
        },
      },
      handler: () => {
        res.emit('finish');
      },
    });

    expect(tracked.errorCalls).toEqual([responseError]);
    expect(tracked.flush).toHaveBeenCalledTimes(1);
  });

  it('finalizes once on aborted and response error terminal paths', async () => {
    const abortedTracked = createTrackedScope();
    const abortedReq = new MockRequest();

    await invokeMiddleware({
      tracked: abortedTracked,
      req: abortedReq,
      handler: () => {
        abortedReq.emit('aborted');
      },
    });

    expect(abortedTracked.flush).toHaveBeenCalledTimes(1);

    const errorTracked = createTrackedScope();
    const errorRes = new MockResponse();
    const transportError = new Error('socket failed');

    await invokeMiddleware({
      tracked: errorTracked,
      res: errorRes,
      handler: () => {
        errorRes.emit('error', transportError);
      },
    });

    expect(errorTracked.errorCalls).toEqual([transportError]);
    expect(errorTracked.flush).toHaveBeenCalledTimes(1);
  });
});
