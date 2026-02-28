// Test sink for capturing events in memory
// TODO: Implement in Phase 10

import type { Sink, FinalizedEvent, FlushReceipt } from '@finalejs/core';

export interface TestSink extends Sink {
  /** Get the most recently emitted event */
  lastEvent(): FinalizedEvent | undefined;
  /** Get all emitted events */
  allEvents(): FinalizedEvent[];
  /** Get the most recent flush receipt (if tracked) */
  lastReceipt(): FlushReceipt | undefined;
  /** Clear all captured events */
  clear(): void;
}

/**
 * Create an in-memory sink for testing.
 */
export function createTestSink(): TestSink {
  const events: FinalizedEvent[] = [];
  let _lastReceipt: FlushReceipt | undefined;

  return {
    emit(record: FinalizedEvent): void {
      events.push(record);
    },

    lastEvent(): FinalizedEvent | undefined {
      return events[events.length - 1];
    },

    allEvents(): FinalizedEvent[] {
      return [...events];
    },

    lastReceipt(): FlushReceipt | undefined {
      return _lastReceipt;
    },

    clear(): void {
      events.length = 0;
      _lastReceipt = undefined;
    },

    async drain(): Promise<void> {
      // No-op for test sink
    },
  };
}
