import type { Sink, FinalizedEvent, FlushReceipt } from '@finalejs/core';

export interface TestSink extends Sink {
  /** Get the most recently emitted event captured by this sink. */
  lastEvent(): FinalizedEvent | undefined;
  /** Get all emitted events in insertion order. */
  allEvents(): FinalizedEvent[];
  /** Get the most recent manually captured flush receipt. */
  lastReceipt(): FlushReceipt | undefined;
  /** Get all manually captured flush receipts in insertion order. */
  allReceipts(): FlushReceipt[];
  /** Store a receipt returned from flush() and return the same instance unchanged. */
  captureReceipt<T extends FlushReceipt>(receipt: T): T;
  /** Clear all captured events and receipts so the sink can be reused. */
  clear(): void;
}

/**
 * Create an in-memory sink for testing event emission through the public API.
 *
 * Receipt tracking is explicit: callers must pass a receipt returned from
 * `flush()` into `captureReceipt()` when they want receipt assertions.
 */
export function createTestSink(): TestSink {
  const events: FinalizedEvent[] = [];
  const receipts: FlushReceipt[] = [];

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
      return receipts[receipts.length - 1];
    },

    allReceipts(): FlushReceipt[] {
      return [...receipts];
    },

    captureReceipt<T extends FlushReceipt>(receipt: T): T {
      receipts.push(receipt);
      return receipt;
    },

    clear(): void {
      events.length = 0;
      receipts.length = 0;
    },

    async drain(): Promise<void> {
      return undefined;
    },
  };
}
