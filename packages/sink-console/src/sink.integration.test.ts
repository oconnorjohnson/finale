import { describe, expect, it, vi } from 'vitest';
import type { FieldDefinition, SamplingPolicy, SchemaType } from '@finalejs/core';
import { createFinale, defineFields, withScope } from '@finalejs/core';
import { consoleSink } from './sink.js';

interface MemoryStream extends NodeJS.WritableStream {
  readonly chunks: string[];
  readonly writeCalls: number;
  isTTY?: boolean;
}

function createMemoryStream(options: { isTTY?: boolean } = {}): MemoryStream {
  let writeCalls = 0;
  const chunks: string[] = [];

  return {
    chunks,
    get writeCalls() {
      return writeCalls;
    },
    ...(options.isTTY !== undefined ? { isTTY: options.isTTY } : {}),
    write(chunk: string | Uint8Array): boolean {
      writeCalls += 1;
      chunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'));
      return true;
    },
  } as MemoryStream;
}

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

async function emitThroughPublicApi(options: {
  sinkOptions?: Parameters<typeof consoleSink>[0];
  sampling?: SamplingPolicy;
  fields?: Record<string, unknown>;
}): Promise<MemoryStream> {
  const stream = createMemoryStream({ isTTY: false });
  const finale = createFinale({
    fields: defineFields({
      'request.id': makeField(),
      'http.method': makeField(),
    }),
    sink: consoleSink({
      stream,
      ...options.sinkOptions,
    }),
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

  return stream;
}

describe('console sink integration', () => {
  it('emits pretty output through the public engine flow', async () => {
    const stream = await emitThroughPublicApi({});

    expect(stream.writeCalls).toBe(1);
    expect(stream.chunks[0]).toContain('[finale] KEEP_NORMAL');
    expect(stream.chunks[0]).toContain('fields:');
    expect(stream.chunks[0]).toContain('"request.id": "req_1"');
    expect(stream.chunks[0]).toContain('"http.method": "GET"');
  });

  it('emits compact output through the public engine flow', async () => {
    const stream = await emitThroughPublicApi({
      sinkOptions: { pretty: false },
    });

    expect(stream.writeCalls).toBe(1);
    expect(stream.chunks[0]).toBe(
      '{"fields":{"http.method":"GET","request.id":"req_1"},"metadata":{"samplingDecision":"KEEP_NORMAL","samplingReason":"accumulated_not_emitted"},"timings":{}}\n'
    );
  });

  it('does not write output when sampling drops the event', async () => {
    const stream = await emitThroughPublicApi({
      sampling: {
        decide() {
          return { decision: 'DROP', reason: 'sampled_out' };
        },
      },
    });

    expect(stream.writeCalls).toBe(0);
    expect(stream.chunks).toEqual([]);
  });

  it('writes only to the injected stream when used through createFinale', async () => {
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    try {
      const stream = await emitThroughPublicApi({});
      expect(stream.writeCalls).toBe(1);
    } finally {
      stdoutSpy.mockRestore();
    }

    expect(stdoutSpy).not.toHaveBeenCalled();
  });
});
