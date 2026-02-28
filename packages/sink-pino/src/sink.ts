// Pino sink implementation
// TODO: Implement in Phase 9

import type { Sink, FinalizedEvent } from '@finalejs/core';

export interface PinoSinkOptions {
  /** Log level to use (default: 'info') */
  level?: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
}

/**
 * Create a Pino sink adapter.
 */
export function pinoSink(logger: unknown, options?: PinoSinkOptions): Sink {
  const _level = options?.level ?? 'info';

  return {
    emit(record: FinalizedEvent): void {
      // Will use logger[level](record.fields)
      void record;
      void logger;
    },
    async drain(): Promise<void> {
      // Pino doesn't need explicit draining for most transports
    },
  };
}
