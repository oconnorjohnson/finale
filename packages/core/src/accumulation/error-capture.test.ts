import { describe, expect, it } from 'vitest';
import { captureErrorFields } from './error-capture.js';

function createTryError(overrides: Record<string, unknown> = {}) {
  return {
    type: 'ValidationError',
    message: 'Invalid email',
    source: 'user.ts:12:4',
    timestamp: 123,
    context: {
      field: 'email',
    },
    cause: new Error('root cause'),
    ...overrides,
  };
}

describe('error capture', () => {
  it('normalizes standard Error values', () => {
    const err = new TypeError('bad input');
    const fields = captureErrorFields(err);

    expect(fields['error.class']).toBe('TypeError');
    expect(fields['error.message']).toBe('bad input');
    expect(fields['error.stack']).toBeUndefined();
  });

  it('includes stack traces for native errors when requested', () => {
    const err = new Error('boom');
    const fields = captureErrorFields(err, { includeStack: true });

    expect(typeof fields['error.stack']).toBe('string');
  });

  it('normalizes live try-error objects into canonical fields', () => {
    const fields = captureErrorFields(createTryError());

    expect(fields['error.class']).toBe('ValidationError');
    expect(fields['error.message']).toBe('Invalid email');
    expect(fields['error.kind']).toBeUndefined();
  });

  it('projects extra try-error fields in canonical-plus mode', () => {
    const fields = captureErrorFields(createTryError(), { projection: 'canonical-plus' });

    expect(fields['error.class']).toBe('ValidationError');
    expect(fields['error.source']).toBe('user.ts:12:4');
    expect(fields['error.timestamp']).toBe(123);
    expect(fields['error.context']).toEqual({ field: 'email' });
    expect(fields['error.kind']).toBe('try-error');
    expect(fields['error.cause']).toEqual({
      name: 'Error',
      message: 'root cause',
      stack: expect.any(String),
    });
  });

  it('mirrors a transport-safe payload when configured', () => {
    const fields = captureErrorFields(createTryError(), { projection: 'mirror' });

    expect(fields['error.payload']).toEqual({
      kind: 'try-error',
      error: {
        __tryError: true,
        type: 'ValidationError',
        message: 'Invalid email',
        source: 'user.ts:12:4',
        timestamp: 123,
        context: { field: 'email' },
        cause: {
          name: 'Error',
          message: 'root cause',
          stack: expect.any(String),
        },
      },
    });
  });

  it('recognizes serialized try-error data', () => {
    const fields = captureErrorFields({
      __tryError: true,
      type: 'NetworkError',
      message: 'Timed out',
      source: 'api.ts:8:2',
      timestamp: 55,
    });

    expect(fields['error.class']).toBe('NetworkError');
    expect(fields['error.message']).toBe('Timed out');
  });

  it('recognizes convex try-error payloads', () => {
    const fields = captureErrorFields({
      kind: 'tryError',
      __tryError: true,
      type: 'AuthError',
      message: 'Forbidden',
      source: 'auth.ts:1:1',
      timestamp: 77,
    });

    expect(fields['error.class']).toBe('AuthError');
    expect(fields['error.message']).toBe('Forbidden');
  });

  it('unwraps boundary-safe convex wrappers', () => {
    const error = new Error(
      JSON.stringify({
        code: 'AUTH_REQUIRED',
        message: 'Outer message',
      })
    ) as Error & {
      data: Record<string, unknown>;
    };

    error.name = 'ConvexError';
    error.data = {
      code: 'AUTH_REQUIRED',
      message: 'Outer message',
      data: { route: '/dashboard' },
      error: {
        kind: 'tryError',
        __tryError: true,
        type: 'AuthError',
        message: 'Please sign in',
        source: 'auth.ts:10:2',
        timestamp: 90,
      },
    };

    const fields = captureErrorFields(error, { projection: 'canonical-plus' });

    expect(fields['error.class']).toBe('AuthError');
    expect(fields['error.message']).toBe('Please sign in');
    expect(fields['error.kind']).toBe('convex-wrapper');
    expect(fields['error.wrapper.class']).toBe('ConvexError');
    expect(fields['error.wrapper.message']).toContain('AUTH_REQUIRED');
    expect(fields['error.boundary.code']).toBe('AUTH_REQUIRED');
    expect(fields['error.boundary.message']).toBe('Outer message');
    expect(fields['error.boundary.data']).toEqual({ route: '/dashboard' });
  });

  it('captures bounded cause chains for native errors', () => {
    const cause = new Error('root cause');
    const err = new Error('top level', { cause });

    const fields = captureErrorFields(err);

    expect(fields['error.causes']).toEqual([{ class: 'Error', message: 'root cause' }]);
  });

  it('handles circular cause graphs for try-error payloads', () => {
    const circular = createTryError({
      type: 'CircularError',
      message: 'loop',
    }) as Record<string, unknown>;
    circular.cause = circular;

    const fields = captureErrorFields(circular, { projection: 'canonical-plus' });

    expect(fields['error.causes']).toEqual([
      { class: 'CircularError', message: 'loop' },
      { class: 'CircularCause', message: '[Circular]' },
    ]);
    expect(fields['error.cause']).toEqual({
      type: 'CircularError',
      message: 'loop',
      source: 'user.ts:12:4',
      timestamp: 123,
      context: { field: 'email' },
      cause: '[Circular]',
    });
  });

  it('honors max cause depth for try-error cause traversal', () => {
    const third = createTryError({ type: 'ThirdError', message: 'third', cause: undefined });
    const second = createTryError({ type: 'SecondError', message: 'second', cause: third });
    const first = createTryError({ type: 'FirstError', message: 'first', cause: second });

    const fields = captureErrorFields(first, { maxCauseDepth: 2 });

    expect(fields['error.causes']).toEqual([
      { class: 'SecondError', message: 'second' },
      { class: 'ThirdError', message: 'third' },
    ]);
  });

  it('keeps try-error stacks gated by includeStack', () => {
    const withoutStack = captureErrorFields(
      createTryError({
        stack: 'ValidationError: Invalid email',
      })
    );
    const withStack = captureErrorFields(
      createTryError({
        stack: 'ValidationError: Invalid email',
      }),
      { includeStack: true }
    );

    expect(withoutStack['error.stack']).toBeUndefined();
    expect(withStack['error.stack']).toBe('ValidationError: Invalid email');
  });

  it('handles unknown thrown values', () => {
    const fields = captureErrorFields('string failure');
    expect(fields['error.class']).toBe('Error');
    expect(fields['error.message']).toBe('string failure');
  });
});
