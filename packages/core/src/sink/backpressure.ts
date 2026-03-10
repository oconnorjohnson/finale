import type { QueueConfig } from '../types/index.js';
import type { BackpressureDecision, SinkQueueEntry, SinkQueueTier } from './internal-types.js';

const tierRank: Record<SinkQueueTier, number> = {
  KEEP_MINIMAL: 1,
  KEEP_NORMAL: 2,
  KEEP_DEBUG: 3,
};

export interface BackpressureInput {
  pending: readonly SinkQueueEntry[];
  incoming: SinkQueueEntry;
  maxSize: number;
  dropPolicy: QueueConfig['dropPolicy'];
}

export function decideBackpressure(input: BackpressureInput): BackpressureDecision {
  const { pending, incoming, maxSize, dropPolicy = 'drop-lowest-tier' } = input;

  if (pending.length < maxSize) {
    return { action: 'admit' };
  }

  if (dropPolicy === 'drop-newest') {
    return {
      action: 'drop-incoming',
      dropped: incoming,
      reason: 'queue_full_drop_newest',
    };
  }

  if (dropPolicy === 'drop-oldest') {
    const oldest = pending[0];
    if (!oldest) {
      return {
        action: 'drop-incoming',
        dropped: incoming,
        reason: 'queue_full_drop_oldest',
      };
    }

    return {
      action: 'replace-existing',
      dropped: oldest,
      reason: 'queue_full_drop_oldest',
    };
  }

  let lowestRankEntry = pending[0];

  for (const entry of pending.slice(1)) {
    if (!lowestRankEntry) {
      lowestRankEntry = entry;
      continue;
    }

    const entryRank = tierRank[entry.tier];
    const lowestRank = tierRank[lowestRankEntry.tier];
    if (entryRank < lowestRank) {
      lowestRankEntry = entry;
    }
  }

  if (!lowestRankEntry) {
    return {
      action: 'drop-incoming',
      dropped: incoming,
      reason: 'queue_full_drop_lowest_tier',
    };
  }

  if (tierRank[incoming.tier] > tierRank[lowestRankEntry.tier]) {
    return {
      action: 'replace-existing',
      dropped: lowestRankEntry,
      reason: 'queue_full_drop_lowest_tier',
    };
  }

  return {
    action: 'drop-incoming',
    dropped: incoming,
    reason: 'queue_full_drop_lowest_tier',
  };
}
