import { Writable } from 'node:stream';
import pino from 'pino';
import { describe, expect, it, vi } from 'vitest';
import type { FieldDefinition, FinalizedEvent, SamplingPolicy, SchemaType } from '@finalejs/core';
import { createFinale, defineFields, withScope } from '@finalejs/core';
import { pinoSink, type PinoLoggerLike } from './index.js';

function stringSchema(): SchemaType<string> {
  return {
    parse(value: unknown): string {
      if (typeof value !== 'string') {
        throw new Error('invalid');
      }

      return value;
    },
    safeParse(value: unknown) {
      if (typeof value !== 'string') {
        return { success: false as const, error: new Error('invalid') };
      }

      return { success: true as const, data: value };
    },
    isOptional(): boolean {
      return false;
    },
  };
}

function makeField(overrides: Partial<FieldDefinition> = {}): FieldDefinition {
  return {
    type: stringSchema(),
    group: 'core',
    sensitivity: 'safe',
    cardinality: 'low',
    priority: 'must-keep',
    ...overrides,
  };
}

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

async function emitThroughPublicApi(options: {
  logger?: PinoLoggerLike;
  sampling?: SamplingPolicy;
  fields?: Record<string, unknown>;
} = {}): Promise<PinoLoggerLike> {
  const logger = options.logger ?? createLogger();
  const finale = createFinale({
    fields: defineFields({
      'request.id': makeField(),
      'http.method': makeField(),
    }),
    sink: pinoSink(logger),
    ...(options.sampling ? { sampling: options.sampling } : {}),
  });

  await withScope(finale, async (scope) => {
    scope.event.add(
      options.fields ?? {
        'request.id': 'req_1',
        'http.method': 'GET',
      }
    );
  });

  await finale.drain();

  return logger;
}

function makeRecord(
  samplingDecision: FinalizedEvent['metadata']['samplingDecision'] = 'KEEP_NORMAL'
): FinalizedEvent {
  return {
    fields: {
      'request.id': 'req_pino',
      'http.method': 'POST',
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
      samplingDecision,
      samplingReason: 'integration_test',
      droppedFields: ['foo'],
      redactedFields: ['bar'],
    },
  };
}

describe('pino sink integration', () => {
  it('emits a finalized event through the public engine flow', async () => {
    const logger = await emitThroughPublicApi();

    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.debug).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith({
      fields: {
        'request.id': 'req_1',
        'http.method': 'GET',
      },
      timings: {},
      metadata: {
        samplingDecision: 'KEEP_NORMAL',
        samplingReason: 'accumulated_not_emitted',
      },
    });
    expect((logger.info as ReturnType<typeof vi.fn>).mock.calls[0]).toHaveLength(1);
  });

  it('routes KEEP_DEBUG to logger.debug through the public engine flow', async () => {
    const logger = await emitThroughPublicApi({
      sampling: {
        decide() {
          return { decision: 'KEEP_DEBUG', reason: 'debug_flow' };
        },
      },
    });

    expect(logger.debug).toHaveBeenCalledTimes(1);
    expect(logger.info).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith({
      fields: {
        'request.id': 'req_1',
        'http.method': 'GET',
      },
      timings: {},
      metadata: {
        samplingDecision: 'KEEP_DEBUG',
        samplingReason: 'debug_flow',
      },
    });
  });

  it('does not call the logger when sampling drops the event', async () => {
    const logger = await emitThroughPublicApi({
      sampling: {
        decide() {
          return { decision: 'DROP', reason: 'sampled_out' };
        },
      },
    });

    expect(logger.trace).not.toHaveBeenCalled();
    expect(logger.debug).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.fatal).not.toHaveBeenCalled();
  });

  it('works with a real pino logger instance and writes one serialized line', () => {
    const chunks: string[] = [];
    const destination = new Writable({
      write(chunk, _encoding, callback) {
        chunks.push(chunk.toString());
        callback();
      },
    });
    const logger = pino({ base: undefined, timestamp: false }, destination);
    const sink = pinoSink(logger);
    const record = makeRecord();

    sink.emit(record);
    logger.flush();

    expect(chunks).toHaveLength(1);

    const payload = JSON.parse(chunks[0] ?? '');

    expect(payload.level).toBe(30);
    expect(payload.fields).toEqual(record.fields);
    expect(payload.timings).toEqual(record.timings);
    expect(payload.subEvents).toEqual(record.subEvents);
    expect(payload.metadata).toEqual(record.metadata);
  });
});
