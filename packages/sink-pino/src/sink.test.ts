import { describe, expect, it, vi } from 'vitest';
import type { FinalizedEvent } from '@finalejs/core';
import { pinoSink, type PinoLoggerLike } from './sink.js';

function createLogger(): PinoLoggerLike {
  return {
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
  };
}

function makeEvent(
  samplingDecision?: FinalizedEvent['metadata']['samplingDecision']
): FinalizedEvent {
  return {
    fields: {
      'request.id': 'req_1',
      'user.id': 'usr_1',
    },
    timings: {
      'db.query': 12,
    },
    subEvents: [
      {
        name: 'llm.step.completed',
        timestamp: 123,
        fields: { 'llm.tokens_out': 42 },
      },
    ],
    metadata: {
      ...(samplingDecision ? { samplingDecision } : {}),
      samplingReason: 'test',
      droppedFields: ['foo'],
      redactedFields: ['bar'],
    },
  };
}

describe('pino sink', () => {
  it('emits the full record at debug for KEEP_DEBUG', () => {
    const logger = createLogger();
    const sink = pinoSink(logger);
    const record = makeEvent('KEEP_DEBUG');

    sink.emit(record);

    expect(logger.debug).toHaveBeenCalledTimes(1);
    expect(logger.debug).toHaveBeenCalledWith(record);
    expect(logger.info).not.toHaveBeenCalled();
    expect(logger.trace).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.fatal).not.toHaveBeenCalled();
  });

  it('emits the full record at info for KEEP_NORMAL', () => {
    const logger = createLogger();
    const sink = pinoSink(logger);
    const record = makeEvent('KEEP_NORMAL');

    sink.emit(record);

    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(record);
  });

  it('emits the full record at info for KEEP_MINIMAL', () => {
    const logger = createLogger();
    const sink = pinoSink(logger);
    const record = makeEvent('KEEP_MINIMAL');

    sink.emit(record);

    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(record);
  });

  it('falls back to the configured level when sampling decision is missing', () => {
    const logger = createLogger();
    const sink = pinoSink(logger, { level: 'warn' });
    const record = makeEvent();

    sink.emit(record);

    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(record);
    expect(logger.info).not.toHaveBeenCalled();
  });

  it('falls back to info when sampling decision is missing and no option is set', () => {
    const logger = createLogger();
    const sink = pinoSink(logger);
    const record = makeEvent();

    sink.emit(record);

    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(record);
  });

  it('does not flatten the payload', () => {
    const logger = createLogger();
    const sink = pinoSink(logger);
    const record = makeEvent('KEEP_NORMAL');

    sink.emit(record);

    expect(logger.info).toHaveBeenCalledWith(record);
    expect(logger.info).not.toHaveBeenCalledWith(record.fields);
    expect(logger.info.mock.calls[0]).toHaveLength(1);
    expect(logger.info.mock.calls[0]?.[0]).toBe(record);
  });

  it('throws on an invalid logger at construction time', () => {
    expect(() => pinoSink({} as PinoLoggerLike)).toThrow(
      'pinoSink expected logger.debug to be a function'
    );
  });

  it('throws when the configured fallback level method is missing', () => {
    const partialLogger = {
      debug: vi.fn(),
      info: vi.fn(),
    } as unknown as PinoLoggerLike;

    expect(() => pinoSink(partialLogger, { level: 'warn' })).toThrow(
      'pinoSink expected logger.warn to be a function'
    );
  });

  it('drain resolves successfully', async () => {
    const logger = createLogger();
    const sink = pinoSink(logger);

    await expect(sink.drain?.()).resolves.toBeUndefined();

    expect(logger.trace).not.toHaveBeenCalled();
    expect(logger.debug).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.fatal).not.toHaveBeenCalled();
  });
});
