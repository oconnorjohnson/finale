import { describe, expect, it } from 'vitest';
import type { FinalizedEvent } from '../types/index.js';
import { decideBackpressure } from './backpressure.js';
import type { SinkQueueEntry, SinkQueueTier } from './internal-types.js';

function makeEvent(id: string): FinalizedEvent {
  return {
    fields: { 'request.id': id },
    timings: {},
    metadata: {},
  };
}

function makeEntry(sequence: number, tier: SinkQueueTier): SinkQueueEntry {
  return {
    event: makeEvent(`req_${sequence}`),
    tier,
    sequence,
  };
}

describe('sink backpressure policy', () => {
  it('admits incoming entries when capacity remains', () => {
    const incoming = makeEntry(1, 'KEEP_NORMAL');

    const decision = decideBackpressure({
      pending: [],
      incoming,
      maxSize: 2,
      dropPolicy: 'drop-newest',
    });

    expect(decision).toEqual({ action: 'admit' });
  });

  it('drops the incoming entry for drop-newest', () => {
    const incoming = makeEntry(2, 'KEEP_NORMAL');

    const decision = decideBackpressure({
      pending: [makeEntry(1, 'KEEP_NORMAL')],
      incoming,
      maxSize: 1,
      dropPolicy: 'drop-newest',
    });

    expect(decision).toEqual({
      action: 'drop-incoming',
      dropped: incoming,
      reason: 'queue_full_drop_newest',
    });
  });

  it('evicts the oldest queued entry for drop-oldest', () => {
    const oldest = makeEntry(1, 'KEEP_MINIMAL');

    const decision = decideBackpressure({
      pending: [oldest, makeEntry(2, 'KEEP_DEBUG')],
      incoming: makeEntry(3, 'KEEP_NORMAL'),
      maxSize: 2,
      dropPolicy: 'drop-oldest',
    });

    expect(decision).toEqual({
      action: 'replace-existing',
      dropped: oldest,
      reason: 'queue_full_drop_oldest',
    });
  });

  it('replaces the oldest lowest-tier entry when a higher-tier event arrives', () => {
    const lowest = makeEntry(1, 'KEEP_MINIMAL');

    const decision = decideBackpressure({
      pending: [lowest, makeEntry(2, 'KEEP_NORMAL')],
      incoming: makeEntry(3, 'KEEP_DEBUG'),
      maxSize: 2,
      dropPolicy: 'drop-lowest-tier',
    });

    expect(decision).toEqual({
      action: 'replace-existing',
      dropped: lowest,
      reason: 'queue_full_drop_lowest_tier',
    });
  });

  it('drops the incoming entry when lowest-tier candidates tie', () => {
    const incoming = makeEntry(3, 'KEEP_NORMAL');

    const decision = decideBackpressure({
      pending: [makeEntry(1, 'KEEP_NORMAL'), makeEntry(2, 'KEEP_DEBUG')],
      incoming,
      maxSize: 2,
      dropPolicy: 'drop-lowest-tier',
    });

    expect(decision).toEqual({
      action: 'drop-incoming',
      dropped: incoming,
      reason: 'queue_full_drop_lowest_tier',
    });
  });

  it('drops the incoming entry when it ranks below all queued items', () => {
    const incoming = makeEntry(3, 'KEEP_MINIMAL');

    const decision = decideBackpressure({
      pending: [makeEntry(1, 'KEEP_NORMAL'), makeEntry(2, 'KEEP_DEBUG')],
      incoming,
      maxSize: 2,
      dropPolicy: 'drop-lowest-tier',
    });

    expect(decision).toEqual({
      action: 'drop-incoming',
      dropped: incoming,
      reason: 'queue_full_drop_lowest_tier',
    });
  });
});
