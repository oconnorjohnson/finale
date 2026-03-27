import { describe, expect, it, vi } from 'vitest';
import type { FlushReceipt, SamplingPolicy, Sink } from '@finalejs/core';
import { createFinale, defineFields, withScope } from '@finalejs/core';
import { zodAdapter, zodType } from '@finalejs/schema-zod';
import { consoleSink } from '@finalejs/sink-console';
import { pinoSink, type PinoLoggerLike } from '@finalejs/sink-pino';
import { z } from 'zod';
import {
  assertFields,
  assertNoField,
  assertSamplingDecision,
  createTestSink,
} from './index.js';

interface MemoryStream extends NodeJS.WritableStream {
  readonly chunks: string[];
  readonly writeCalls: number;
}

function createMemoryStream(): MemoryStream {
  let writeCalls = 0;
  const chunks: string[] = [];

  return {
    chunks,
    get writeCalls() {
      return writeCalls;
    },
    write(chunk: string | Uint8Array): boolean {
      writeCalls += 1;
      chunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'));
      return true;
    },
  } as MemoryStream;
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

function createFields() {
  return defineFields({
    'service.name': {
      type: zodAdapter.createType<string>(z.string()),
      group: 'core',
      sensitivity: 'safe',
      cardinality: 'low',
      priority: 'must-keep',
    },
    'http.status_code': {
      type: zodType(z.coerce.number()),
      group: 'core',
      sensitivity: 'safe',
      cardinality: 'low',
      priority: 'must-keep',
    },
    'user.id': {
      type: zodType(z.string().optional()),
      group: 'domain',
      sensitivity: 'pii',
      cardinality: 'high',
      priority: 'important',
      transform: 'allow',
    },
  });
}

function createPayload() {
  return {
    valid: {
      'service.name': 'finale-api',
      'http.status_code': '201',
      'user.id': 'user_123',
    },
    invalid: {
      'user.id': 42,
      'unknown.field': 'unexpected',
    },
  };
}

async function emitWithFinale(options: {
  sink: Sink;
  sampling?: SamplingPolicy;
}) {
  const finale = createFinale({
    fields: createFields(),
    sink: options.sink,
    validation: 'soft',
    ...(options.sampling ? { sampling: options.sampling } : {}),
  });
  const payload = createPayload();

  await withScope(finale, async (scope) => {
    scope.event.add(payload.valid);
    scope.event.add(payload.invalid);
  });

  await finale.drain();

  return payload;
}

describe('cross-package adapter verification', () => {
  it('combines test sink, zod-backed fields, and assertion helpers through public imports', async () => {
    const sink = createTestSink();
    const finale = createFinale({
      fields: createFields(),
      sink,
      validation: 'soft',
    });
    const payload = createPayload();
    let receipt: FlushReceipt | undefined;

    await withScope(finale, async (scope) => {
      scope.event.add(payload.valid);
      scope.event.add(payload.invalid);
      receipt = sink.captureReceipt(scope.event.flush());
    });

    await finale.drain();

    assertFields(sink.lastEvent(), {
      'service.name': payload.valid['service.name'],
      'http.status_code': 201,
      'user.id': payload.valid['user.id'],
    });
    assertNoField(sink.lastEvent(), 'unknown.field');
    assertSamplingDecision(receipt, 'KEEP_NORMAL');
    expect(receipt?.fieldsDropped).toEqual(['user.id', 'unknown.field']);
  });

  it('serializes console sink output with parsed zod values through the public API', async () => {
    const stream = createMemoryStream();
    const payload = await emitWithFinale({
      sink: consoleSink({
        pretty: false,
        stream,
      }),
    });

    expect(stream.writeCalls).toBe(1);

    const serialized = JSON.parse(stream.chunks[0] ?? '');

    expect(serialized.fields).toEqual({
      'service.name': payload.valid['service.name'],
      'http.status_code': 201,
      'user.id': payload.valid['user.id'],
    });
    expect(serialized.metadata).toMatchObject({
      samplingDecision: 'KEEP_NORMAL',
    });
    expect(serialized.fields).not.toHaveProperty('unknown.field');
  });

  it('forwards pino sink payloads with parsed zod values and sampling metadata', async () => {
    const logger = createLogger();
    const sampling: SamplingPolicy = {
      decide() {
        return { decision: 'KEEP_DEBUG', reason: 'cross_package_debug' };
      },
    };
    const payload = await emitWithFinale({
      sink: pinoSink(logger),
      sampling,
    });

    expect(logger.debug).toHaveBeenCalledTimes(1);
    expect(logger.info).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith({
      fields: {
        'service.name': payload.valid['service.name'],
        'http.status_code': 201,
        'user.id': payload.valid['user.id'],
      },
      timings: {},
      metadata: {
        droppedFields: ['user.id', 'unknown.field'],
        samplingDecision: 'KEEP_DEBUG',
        samplingReason: 'cross_package_debug',
      },
    });
  });
});
