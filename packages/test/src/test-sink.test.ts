import { describe, expect, it } from 'vitest';
import type { FinalizedEvent, FlushReceipt } from '@finalejs/core';
import { createTestSink } from './test-sink.js';

function createEvent(requestId: string): FinalizedEvent {
  return {
    fields: { 'request.id': requestId },
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

describe('createTestSink', () => {
  it('starts empty', () => {
    const sink = createTestSink();

    expect(sink.lastEvent()).toBeUndefined();
    expect(sink.allEvents()).toEqual([]);
    expect(sink.lastReceipt()).toBeUndefined();
    expect(sink.allReceipts()).toEqual([]);
  });

  it('captures emitted events in order', () => {
    const sink = createTestSink();
    const first = createEvent('req_1');
    const second = createEvent('req_2');

    sink.emit(first);
    sink.emit(second);

    expect(sink.lastEvent()).toBe(second);
    expect(sink.allEvents()).toEqual([first, second]);
  });

  it('returns defensive copies of captured events', () => {
    const sink = createTestSink();
    sink.emit(createEvent('req_1'));

    const events = sink.allEvents();
    events.push(createEvent('req_2'));

    expect(sink.allEvents()).toHaveLength(1);
  });

  it('captures receipts and returns the same receipt instance', () => {
    const sink = createTestSink();
    const first = createReceipt('KEEP_NORMAL');
    const second = createReceipt('DROP');

    expect(sink.captureReceipt(first)).toBe(first);
    expect(sink.captureReceipt(second)).toBe(second);
    expect(sink.lastReceipt()).toBe(second);
    expect(sink.allReceipts()).toEqual([first, second]);
  });

  it('returns defensive copies of captured receipts', () => {
    const sink = createTestSink();
    sink.captureReceipt(createReceipt('KEEP_NORMAL'));

    const receipts = sink.allReceipts();
    receipts.push(createReceipt('DROP'));

    expect(sink.allReceipts()).toHaveLength(1);
  });

  it('clears both events and receipts', () => {
    const sink = createTestSink();
    sink.emit(createEvent('req_1'));
    sink.captureReceipt(createReceipt('KEEP_NORMAL'));

    sink.clear();

    expect(sink.allEvents()).toEqual([]);
    expect(sink.allReceipts()).toEqual([]);
    expect(sink.lastEvent()).toBeUndefined();
    expect(sink.lastReceipt()).toBeUndefined();
  });

  it('drain resolves successfully', async () => {
    const sink = createTestSink();

    await expect(sink.drain?.()).resolves.toBeUndefined();
  });
});
