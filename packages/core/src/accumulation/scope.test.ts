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
});
