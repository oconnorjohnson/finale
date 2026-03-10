import type { FinalizedEvent, Sink } from '@finalejs/core';

export type PinoLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface PinoLoggerLike {
  trace(payload: unknown): void;
  debug(payload: unknown): void;
  info(payload: unknown): void;
  warn(payload: unknown): void;
  error(payload: unknown): void;
  fatal(payload: unknown): void;
}

export interface PinoSinkOptions {
  /** Log level to use when the record has no sampling decision (default: 'info') */
  level?: PinoLevel;
}

/**
 * Create a Pino sink adapter.
 */
export function pinoSink(logger: PinoLoggerLike, options: PinoSinkOptions = {}): Sink {
  const fallbackLevel = options.level ?? 'info';
  validateLogger(logger, fallbackLevel);

  return {
    emit(record: FinalizedEvent): void {
      const level = selectLevel(record, fallbackLevel);
      logger[level](record);
    },
    async drain(): Promise<void> {},
  };
}

function selectLevel(record: FinalizedEvent, fallbackLevel: PinoLevel): PinoLevel {
  switch (record.metadata.samplingDecision) {
    case 'KEEP_DEBUG':
      return 'debug';
    case 'KEEP_NORMAL':
    case 'KEEP_MINIMAL':
      return 'info';
    case 'DROP':
    default:
      return fallbackLevel;
  }
}

function validateLogger(logger: PinoLoggerLike, fallbackLevel: PinoLevel): void {
  if (typeof logger !== 'object' || logger === null) {
    throw new TypeError('pinoSink expected a Pino-compatible logger object');
  }

  const requiredLevels = new Set<PinoLevel>(['debug', 'info', fallbackLevel]);

  for (const level of requiredLevels) {
    const candidate = logger[level];
    if (typeof candidate !== 'function') {
      throw new TypeError(`pinoSink expected logger.${level} to be a function`);
    }
  }
}
