import { describe, expect, it, vi } from 'vitest';
import { AccumulationScope } from './scope.js';

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
});
