import { describe, expect, it } from 'vitest';
import { createNoopScope, getNoopScope } from './noop-scope.js';

describe('noop scope', () => {
  it('returns stable shared fallback scope', () => {
    expect(getNoopScope()).toBe(getNoopScope());
  });

  it('creates isolated no-op scopes for runtime stack entries', () => {
    const scopeA = createNoopScope();
    const scopeB = createNoopScope();
    expect(scopeA).not.toBe(scopeB);
  });

  it('safely ignores event and timer operations', async () => {
    const scope = createNoopScope();

    scope.event.add({ hello: 'world' });
    scope.event.error(new Error('ignored'));
    scope.event.annotate('checkpoint');
    scope.event.subEvent('llm.step.completed', { 'llm.tokens_out': 42 });
    scope.event.child('llm').add({ step: 'complete' });
    scope.timers.start('db.query');
    scope.timers.end('db.query');

    const syncValue = scope.timers.measure('sync.measure', () => 'ok');
    const asyncValue = await scope.timers.measure('async.measure', async () => 'ok-async');

    expect(syncValue).toBe('ok');
    expect(asyncValue).toBe('ok-async');
  });

  it('returns a non-emitted receipt when flush is called', () => {
    const receipt = createNoopScope().event.flush();
    expect(receipt.emitted).toBe(false);
    expect(receipt.decision.decision).toBe('DROP');
    expect(receipt.decision.reason).toBe('missing_scope');
  });
});
