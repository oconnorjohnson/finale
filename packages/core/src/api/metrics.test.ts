import { describe, expect, it } from 'vitest';
import { createMetricsStore } from './metrics.js';

describe('metrics store', () => {
  it('starts with zeroed counters', () => {
    const { metrics } = createMetricsStore();

    expect(metrics.snapshot()).toEqual({
      eventsEmitted: 0,
      eventsDropped: 0,
      eventsSampledOut: 0,
      fieldsDropped: 0,
      redactionsApplied: 0,
      schemaViolations: 0,
      sinkFailures: 0,
      queueDrops: 0,
    });
  });

  it('reflects live updates through getters and snapshots', () => {
    const { metrics, recorder } = createMetricsStore();

    recorder.recordValidationIssue();
    recorder.recordFlushReceipt({
      emitted: false,
      decision: { decision: 'DROP', reason: 'sampled_out' },
      fieldsDropped: ['a', 'b'],
      fieldsRedacted: ['secret'],
      finalSize: 10,
    });
    recorder.recordQueueDrop('queue_full_drop_newest');
    recorder.recordSinkEmitSuccess();
    recorder.recordSinkEmitFailure();

    expect(metrics.eventsEmitted).toBe(1);
    expect(metrics.eventsDropped).toBe(2);
    expect(metrics.eventsSampledOut).toBe(1);
    expect(metrics.fieldsDropped).toBe(2);
    expect(metrics.redactionsApplied).toBe(1);
    expect(metrics.schemaViolations).toBe(1);
    expect(metrics.sinkFailures).toBe(1);
    expect(metrics.queueDrops).toBe(1);
    expect(metrics.snapshot()).toEqual({
      eventsEmitted: 1,
      eventsDropped: 2,
      eventsSampledOut: 1,
      fieldsDropped: 2,
      redactionsApplied: 1,
      schemaViolations: 1,
      sinkFailures: 1,
      queueDrops: 1,
    });
  });

  it('returns a defensive snapshot copy', () => {
    const { metrics, recorder } = createMetricsStore();
    recorder.recordSinkEmitSuccess();

    const snapshot = metrics.snapshot();
    snapshot.eventsEmitted = 99;

    expect(metrics.eventsEmitted).toBe(1);
    expect(metrics.snapshot().eventsEmitted).toBe(1);
  });

  it('does not count lifecycle queue rejections as queue drops', () => {
    const { metrics, recorder } = createMetricsStore();

    recorder.recordQueueDrop('queue_draining');
    recorder.recordQueueDrop('queue_drained');

    expect(metrics.queueDrops).toBe(0);
  });

  it('counts sink drain failures without incrementing dropped events', () => {
    const { metrics, recorder } = createMetricsStore();

    recorder.recordSinkDrainFailure();

    expect(metrics.sinkFailures).toBe(1);
    expect(metrics.eventsDropped).toBe(0);
  });
});
