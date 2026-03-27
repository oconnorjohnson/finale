import { describe, expect, it, vi } from 'vitest';
import type { FieldDefinition, SchemaType } from '../types/index.js';
import { AccumulationScope } from './scope.js';

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

function makeField(type: SchemaType<unknown>): FieldDefinition {
  return {
    type,
    group: 'core',
    sensitivity: 'safe',
    cardinality: 'low',
    priority: 'must-keep',
  };
}

describe('accumulation scope', () => {
  it('collects fields across add and child APIs', () => {
    const scope = new AccumulationScope();
    scope.event.add({ 'request.id': 'req_1' });
    scope.event.child('http').add({ route: '/checkout' });

    const receipt = scope.event.flush();
    const event = scope.getLastFinalizedEvent();

    expect(receipt.emitted).toBe(false);
    expect(event?.fields['request.id']).toBe('req_1');
    expect(event?.fields['http.route']).toBe('/checkout');
  });

  it('captures errors and annotations', () => {
    const scope = new AccumulationScope();
    scope.event.error(new Error('failed'));
    scope.event.annotate('checkpoint');
    scope.event.flush();

    const event = scope.getLastFinalizedEvent();
    expect(event?.fields['error.message']).toBe('failed');
    expect(event?.fields.annotations).toEqual(['checkpoint']);
  });

  it('applies engine-level canonical-plus error capture defaults', () => {
    const scope = new AccumulationScope({
      errorCapture: {
        projection: 'canonical-plus',
      },
    });

    scope.event.error({
      type: 'ValidationError',
      message: 'Invalid input',
      source: 'form.ts:9:1',
      timestamp: 42,
      context: { field: 'email' },
    });
    scope.event.flush();

    const event = scope.getLastFinalizedEvent();
    expect(event?.fields['error.class']).toBe('ValidationError');
    expect(event?.fields['error.kind']).toBe('try-error');
    expect(event?.fields['error.context']).toEqual({ field: 'email' });
  });

  it('allows per-call overrides from canonical to mirror', () => {
    const scope = new AccumulationScope({
      errorCapture: {
        projection: 'canonical',
      },
    });

    scope.event.error(
      {
        type: 'ValidationError',
        message: 'Invalid input',
        source: 'form.ts:9:1',
        timestamp: 42,
      },
      { projection: 'mirror' }
    );
    scope.event.flush();

    const event = scope.getLastFinalizedEvent();
    expect(event?.fields['error.payload']).toEqual({
      kind: 'try-error',
      error: {
        __tryError: true,
        type: 'ValidationError',
        message: 'Invalid input',
        source: 'form.ts:9:1',
        timestamp: 42,
      },
    });
  });

  it('unwraps convex-like wrappers passed through scope.event.error', () => {
    const scope = new AccumulationScope({
      errorCapture: {
        projection: 'canonical-plus',
      },
    });

    const wrapped = new Error('wrapper') as Error & { data: Record<string, unknown> };
    wrapped.name = 'ConvexError';
    wrapped.data = {
      code: 'AUTH_REQUIRED',
      message: 'Outer message',
      error: {
        kind: 'tryError',
        __tryError: true,
        type: 'AuthError',
        message: 'Please sign in',
        source: 'auth.ts:1:1',
        timestamp: 1,
      },
    };

    scope.event.error(wrapped);
    scope.event.flush();

    const event = scope.getLastFinalizedEvent();
    expect(event?.fields['error.class']).toBe('AuthError');
    expect(event?.fields['error.wrapper.class']).toBe('ConvexError');
    expect(event?.fields['error.boundary.code']).toBe('AUTH_REQUIRED');
  });

  it('records timers and sub-events', () => {
    vi.useFakeTimers();
    const scope = new AccumulationScope();

    scope.timers.start('db.query');
    vi.advanceTimersByTime(20);
    scope.timers.end('db.query');
    scope.event.subEvent('llm.step.completed', { 'llm.tokens_out': 120 });
    scope.event.flush();

    const event = scope.getLastFinalizedEvent();
    expect(event?.timings['db.query']).toBe(20);
    expect(event?.subEvents?.[0]?.name).toBe('llm.step.completed');
    vi.useRealTimers();
  });

  it('keeps backward-compatible behavior when no registry is configured', () => {
    const scope = new AccumulationScope();
    scope.event.add({ unknown: 'still-accepted' });
    scope.event.flush();

    expect(scope.getLastFinalizedEvent()?.fields.unknown).toBe('still-accepted');
  });

  it('applies soft-mode validation and drops invalid fields', () => {
    const issues = vi.fn();
    const scope = new AccumulationScope({
      fieldRegistry: {
        'http.route': makeField(stringSchema()),
      },
      validationMode: 'soft',
      onValidationIssue: issues,
    });

    scope.event.add({
      'http.route': 123,
      unknown: 'value',
    });
    const receipt = scope.event.flush();

    expect(scope.getLastFinalizedEvent()?.fields).toEqual({});
    expect(receipt.fieldsDropped).toEqual(['http.route', 'unknown']);
    expect(issues).toHaveBeenCalledTimes(2);
  });

  it('applies strict-mode validation and keeps fields while reporting issues', () => {
    const issues = vi.fn();
    const scope = new AccumulationScope({
      fieldRegistry: {
        'http.route': makeField(stringSchema()),
      },
      validationMode: 'strict',
      onValidationIssue: issues,
    });

    scope.event.add({
      'http.route': 123,
      unknown: 'value',
    });
    scope.event.flush();

    expect(scope.getLastFinalizedEvent()?.fields).toEqual({
      'http.route': 123,
      unknown: 'value',
    });
    expect(issues).toHaveBeenCalledTimes(2);
  });

  it('runs safety redaction pipeline and reports redacted fields', () => {
    const scope = new AccumulationScope({
      fieldRegistry: {
        token: {
          ...makeField(stringSchema()),
          transform: 'mask',
        },
      },
    });

    scope.event.add({ token: 'secret-token' });
    const receipt = scope.event.flush();

    expect(scope.getLastFinalizedEvent()?.fields.token).toBe('[REDACTED]');
    expect(receipt.fieldsRedacted).toContain('token');
  });

  it('enforces safety budget and reports dropped fields in receipt', () => {
    const scope = new AccumulationScope({
      fieldRegistry: {
        keep: {
          ...makeField(stringSchema()),
          priority: 'must-keep',
        },
        dropMe: {
          ...makeField(stringSchema()),
          priority: 'drop-first',
        },
      },
      limits: {
        maxTotalSize: 100,
      },
    });

    scope.event.add({
      keep: 'x'.repeat(60),
      dropMe: 'x'.repeat(60),
    });
    const receipt = scope.event.flush();

    expect(scope.getLastFinalizedEvent()?.fields.keep).toBeDefined();
    expect(scope.getLastFinalizedEvent()?.fields.dropMe).toBeUndefined();
    expect(receipt.fieldsDropped).toContain('dropMe');
  });

  it('drops oversized mirrored payloads when the event budget is exceeded', () => {
    const scope = new AccumulationScope({
      errorCapture: {
        projection: 'mirror',
      },
      limits: {
        maxTotalSize: 200,
      },
      fieldRegistry: {
        'error.payload': {
          ...makeField(stringSchema()),
          priority: 'drop-first',
        },
      },
    });

    scope.event.error({
      type: 'HugeError',
      message: 'Very large payload',
      source: 'huge.ts:1:1',
      timestamp: 1,
      context: {
        blob: 'x'.repeat(2000),
      },
    });
    const receipt = scope.event.flush();

    expect(scope.getLastFinalizedEvent()?.fields['error.payload']).toBeUndefined();
    expect(receipt.fieldsDropped).toContain('error.payload');
  });

  it('applies sampling decision and metadata from custom policy', () => {
    const scope = new AccumulationScope({
      sampling: {
        policy: {
          decide: () => ({ decision: 'KEEP_DEBUG', reason: 'forced' }),
        },
      },
    });

    scope.event.add({ 'request.id': 'req_1' });
    const receipt = scope.event.flush();
    const event = scope.getLastFinalizedEvent();

    expect(receipt.decision).toEqual({ decision: 'KEEP_DEBUG', reason: 'forced' });
    expect(event?.metadata.samplingDecision).toBe('KEEP_DEBUG');
    expect(event?.metadata.samplingReason).toBe('forced');
  });

  it('filters event payload for keep-minimal tier', () => {
    const scope = new AccumulationScope({
      fieldRegistry: {
        'request.id': makeField(stringSchema()),
        'user.id': {
          ...makeField(stringSchema()),
          group: 'domain',
        },
      },
      sampling: {
        policy: {
          decide: () => ({ decision: 'KEEP_MINIMAL', reason: 'sampled' }),
        },
      },
    });

    scope.event.add({
      'request.id': 'req_1',
      'user.id': 'usr_1',
      unknown: true,
    });
    const receipt = scope.event.flush();
    const event = scope.getLastFinalizedEvent();

    expect(receipt.decision.decision).toBe('KEEP_MINIMAL');
    expect(event?.fields).toEqual({ 'request.id': 'req_1' });
  });
});
