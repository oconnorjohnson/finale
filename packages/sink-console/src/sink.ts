// Console sink implementation
// TODO: Implement pretty-printing in Phase 9

import type { Sink, FinalizedEvent } from '@finalejs/core';

export interface ConsoleSinkOptions {
  /** Use pretty-printing with colors (default: true) */
  pretty?: boolean;
  /** Output stream (default: process.stdout) */
  stream?: NodeJS.WritableStream;
}

/**
 * Create a console sink for development/debugging.
 */
export function consoleSink(options?: ConsoleSinkOptions): Sink {
  const pretty = options?.pretty ?? true;
  const stream = options?.stream ?? process.stdout;

  return {
    emit(record: FinalizedEvent): void {
      const output = pretty
        ? JSON.stringify(record.fields, null, 2)
        : JSON.stringify(record.fields);

      stream.write(output + '\n');
    },
    async drain(): Promise<void> {
      // Console doesn't need draining
    },
  };
}
