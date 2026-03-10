import type { FinalizedEvent, QueueConfig, SamplingTier, Sink } from '../types/index.js';

export type SinkQueueTier = Exclude<SamplingTier, 'DROP'>;

export type QueueDropReason =
  | 'queue_full_drop_newest'
  | 'queue_full_drop_oldest'
  | 'queue_full_drop_lowest_tier';

export type QueueLifecycleDropReason = 'queue_draining' | 'queue_drained';

export type QueueRejectReason = QueueDropReason | QueueLifecycleDropReason;

export interface SinkQueueEntry {
  event: FinalizedEvent;
  tier: SinkQueueTier;
  sequence: number;
}

export type BackpressureDecision =
  | {
      action: 'admit';
    }
  | {
      action: 'drop-incoming';
      dropped: SinkQueueEntry;
      reason: QueueDropReason;
    }
  | {
      action: 'replace-existing';
      dropped: SinkQueueEntry;
      reason: QueueDropReason;
    };

export interface SinkRuntimeHooks {
  onQueueDrop?: (entry: SinkQueueEntry, reason: QueueRejectReason) => void;
  onSinkSuccess?: (entry: SinkQueueEntry) => void;
  onSinkFailure?: (entry: SinkQueueEntry | undefined, error: unknown) => void;
  onSinkDrainFailure?: (error: unknown) => void;
  onDrainTimeout?: (pendingCount: number) => void;
}

export interface AsyncQueueOptions extends QueueConfig {
  sink: Sink;
  hooks?: SinkRuntimeHooks;
}

export interface EnqueueResult {
  admitted: boolean;
  entry: SinkQueueEntry;
  reason?: QueueRejectReason;
}

export type DrainState = 'open' | 'draining' | 'drained';
