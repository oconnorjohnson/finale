import type { FlushReceipt, Metrics, MetricsSnapshot } from '../types/index.js';
import type { QueueRejectReason } from '../sink/internal-types.js';

export interface MetricsRecorder {
  recordValidationIssue(): void;
  recordFlushReceipt(receipt: FlushReceipt): void;
  recordQueueDrop(reason: QueueRejectReason): void;
  recordSinkEmitSuccess(): void;
  recordSinkEmitFailure(): void;
  recordSinkDrainFailure(): void;
}

function createZeroSnapshot(): MetricsSnapshot {
  return {
    eventsEmitted: 0,
    eventsDropped: 0,
    eventsSampledOut: 0,
    fieldsDropped: 0,
    redactionsApplied: 0,
    schemaViolations: 0,
    sinkFailures: 0,
    queueDrops: 0,
  };
}

function isBackpressureDrop(reason: QueueRejectReason): boolean {
  return (
    reason === 'queue_full_drop_newest' ||
    reason === 'queue_full_drop_oldest' ||
    reason === 'queue_full_drop_lowest_tier'
  );
}

export function createMetricsStore(): {
  metrics: Metrics;
  recorder: MetricsRecorder;
} {
  const snapshot = createZeroSnapshot();

  const metrics: Metrics = {
    get eventsEmitted() {
      return snapshot.eventsEmitted;
    },
    get eventsDropped() {
      return snapshot.eventsDropped;
    },
    get eventsSampledOut() {
      return snapshot.eventsSampledOut;
    },
    get fieldsDropped() {
      return snapshot.fieldsDropped;
    },
    get redactionsApplied() {
      return snapshot.redactionsApplied;
    },
    get schemaViolations() {
      return snapshot.schemaViolations;
    },
    get sinkFailures() {
      return snapshot.sinkFailures;
    },
    get queueDrops() {
      return snapshot.queueDrops;
    },
    snapshot(): MetricsSnapshot {
      return { ...snapshot };
    },
  };

  const recorder: MetricsRecorder = {
    recordValidationIssue(): void {
      snapshot.schemaViolations += 1;
    },
    recordFlushReceipt(receipt: FlushReceipt): void {
      snapshot.fieldsDropped += receipt.fieldsDropped.length;
      snapshot.redactionsApplied += receipt.fieldsRedacted.length;

      if (receipt.decision.decision === 'DROP') {
        snapshot.eventsDropped += 1;
        snapshot.eventsSampledOut += 1;
        return;
      }

      if (!receipt.emitted) {
        snapshot.eventsDropped += 1;
      }
    },
    recordQueueDrop(reason: QueueRejectReason): void {
      if (isBackpressureDrop(reason)) {
        snapshot.queueDrops += 1;
      }
    },
    recordSinkEmitSuccess(): void {
      snapshot.eventsEmitted += 1;
    },
    recordSinkEmitFailure(): void {
      snapshot.sinkFailures += 1;
      snapshot.eventsDropped += 1;
    },
    recordSinkDrainFailure(): void {
      snapshot.sinkFailures += 1;
    },
  };

  return { metrics, recorder };
}
