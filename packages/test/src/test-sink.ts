import type { Sink, FinalizedEvent, FlushReceipt } from '@finalejs/core';

export interface TestSink extends Sink {
  /** Get the most recently emitted event */
  lastEvent(): FinalizedEvent | undefined;
  /** Get all emitted events */
  allEvents(): FinalizedEvent[];
  /** Get the most recent flush receipt (if tracked) */
  lastReceipt(): FlushReceipt | undefined;
  /** Get all captured receipts */
  allReceipts(): FlushReceipt[];
  /** Capture a receipt returned from flush() and return it unchanged */
  captureReceipt<T extends FlushReceipt>(receipt: T): T;
  /** Clear all captured events */
  clear(): void;
}

/**
 * Create an in-memory sink for testing.
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
