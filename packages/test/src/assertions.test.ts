import { describe, expect, it } from 'vitest';
import type { FinalizedEvent, FlushReceipt } from '@finalejs/core';
import { assertFields, assertNoField, assertSamplingDecision } from './assertions.js';

function createEvent(fields: Record<string, unknown>): FinalizedEvent {
  return {
    fields,
    timings: {},
    metadata: {
      samplingDecision: 'KEEP_NORMAL',
    },
  };
}

function createReceipt(decision: FlushReceipt['decision']['decision']): FlushReceipt {
  return {
    emitted: decision !== 'DROP',
    decision: { decision },
    fieldsDropped: [],
    fieldsRedacted: [],
    finalSize: 10,
  };
}

describe('assertFields', () => {
  it('passes on exact and subset matches', () => {
    const event = createEvent({
      'request.id': 'req_1',
      'http.status_code': 200,
    });

    expect(() => assertFields(event, { 'request.id': 'req_1' })).not.toThrow();
    expect(() =>
      assertFields(event, {
        'request.id': 'req_1',
        'http.status_code': 200,
      })
    ).not.toThrow();
  });

  it('throws when the event is missing', () => {
    expect(() => assertFields(undefined, { 'request.id': 'req_1' })).toThrow(
      'assertFields: expected an event but received undefined'
    );
  });

  it('throws when a field is missing', () => {
    const event = createEvent({ 'request.id': 'req_1' });

    expect(() => assertFields(event, { 'http.status_code': 200 })).toThrow(
      'assertFields: missing field "http.status_code"'
    );
  });

  it('throws when a field value differs', () => {
    const event = createEvent({ 'request.id': 'req_1' });

    expect(() => assertFields(event, { 'request.id': 'req_2' })).toThrow(
      'assertFields: field "request.id" expected "req_2" but got "req_1"'
    );
  });
});

describe('assertNoField', () => {
  it('passes when a field is absent', () => {
    expect(() => assertNoField(createEvent({ 'request.id': 'req_1' }), 'secret.token')).not.toThrow();
  });

  it('throws when the field is present', () => {
    expect(() => assertNoField(createEvent({ 'secret.token': 'abc' }), 'secret.token')).toThrow(
      'assertNoField: field "secret.token" should not be present'
    );
  });
});

describe('assertSamplingDecision', () => {
  it('passes when the decision matches', () => {
    expect(() => assertSamplingDecision(createReceipt('KEEP_MINIMAL'), 'KEEP_MINIMAL')).not.toThrow();
  });

  it('throws on missing receipt', () => {
    expect(() => assertSamplingDecision(undefined, 'KEEP_NORMAL')).toThrow(
      'assertSamplingDecision: expected a receipt but received undefined'
    );
  });

  it('throws on mismatched tier', () => {
    expect(() => assertSamplingDecision(createReceipt('KEEP_DEBUG'), 'KEEP_NORMAL')).toThrow(
      'assertSamplingDecision: expected "KEEP_NORMAL" but got "KEEP_DEBUG"'
    );
  });
});
