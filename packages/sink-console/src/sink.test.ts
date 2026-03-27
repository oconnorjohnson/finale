import { describe, expect, it, vi } from 'vitest';
import type { FinalizedEvent } from '@finalejs/core';
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

function makeEvent(overrides: Partial<FinalizedEvent> = {}): FinalizedEvent {
  const base: FinalizedEvent = {
    fields: {
      'service.name': 'web-api',
      'request.id': 'req_1',
      'z.key': 'last',
      'a.key': 'first',
    },
    timings: {
      'db.query': 12,
      'http.total': 42,
    },
    subEvents: [
      {
        name: 'llm.step.started',
        timestamp: 123,
        fields: {
          'z.inner': 'z',
          'a.inner': 'a',
        },
      },
    ],
    metadata: {
      samplingDecision: 'KEEP_NORMAL',
      samplingReason: 'slow_request',
      droppedFields: ['debug.payload'],
      redactedFields: ['user.email'],
    },
  };

  return {
    ...base,
    ...overrides,
    fields: { ...base.fields, ...overrides.fields },
    ...(overrides.timings !== undefined ? { timings: overrides.timings } : { timings: base.timings }),
    ...(overrides.subEvents !== undefined ? { subEvents: overrides.subEvents } : { subEvents: base.subEvents }),
    metadata:
      overrides.metadata !== undefined
        ? Object.keys(overrides.metadata).length === 0
          ? {}
          : { ...base.metadata, ...overrides.metadata }
        : base.metadata,
  };
}

function stripAnsi(value: string): string {
  const escapeCharacter = String.fromCharCode(27);
  return value.replace(new RegExp(`${escapeCharacter}\\[[0-9;]*m`, 'g'), '');
}

describe('console sink', () => {
  it('renders pretty multi-line output with stable ordering and sections', () => {
    const stream = createMemoryStream({ isTTY: false });
    const sink = consoleSink({ stream });

    sink.emit(makeEvent());

    expect(stream.writeCalls).toBe(1);
    expect(stream.chunks).toHaveLength(1);
    expect(stream.chunks[0]).toBe(
      [
        '[finale] KEEP_NORMAL (slow_request)',
        'fields:',
        '  {',
        '    "a.key": "first",',
        '    "request.id": "req_1",',
        '    "service.name": "web-api",',
        '    "z.key": "last"',
        '  }',
        'timings:',
        '  {',
        '    "db.query": 12,',
        '    "http.total": 42',
        '  }',
        'subevents:',
        '  [',
        '    {',
        '      "fields": {',
        '        "a.inner": "a",',
        '        "z.inner": "z"',
        '      },',
        '      "name": "llm.step.started",',
        '      "timestamp": 123',
        '    }',
        '  ]',
        'metadata:',
        '  {',
        '    "droppedFields": [',
        '      "debug.payload"',
        '    ],',
        '    "redactedFields": [',
        '      "user.email"',
        '    ],',
        '    "samplingDecision": "KEEP_NORMAL",',
        '    "samplingReason": "slow_request"',
        '  }',
        '',
      ].join('\n')
    );
  });

  it('renders all header variants in pretty mode', () => {
    const stream = createMemoryStream({ isTTY: false });
    const sink = consoleSink({ stream });

    sink.emit(makeEvent({ metadata: { samplingDecision: 'KEEP_DEBUG' } }));
    sink.emit(makeEvent({ metadata: { samplingDecision: 'KEEP_MINIMAL' } }));
    sink.emit(makeEvent({ metadata: { samplingDecision: 'DROP' } }));
    sink.emit(makeEvent({ metadata: { samplingDecision: undefined, samplingReason: undefined } }));

    const headers = stream.chunks.map((chunk) => chunk.split('\n')[0]);

    expect(headers).toEqual([
      '[finale] KEEP_DEBUG (slow_request)',
      '[finale] KEEP_MINIMAL (slow_request)',
      '[finale] DROP (slow_request)',
      '[finale] UNKNOWN',
    ]);
  });

  it('renders compact single-line full records without ANSI codes', () => {
    const stream = createMemoryStream({ isTTY: true });
    const sink = consoleSink({ stream, pretty: false, colors: true });

    sink.emit(makeEvent());

    expect(stream.writeCalls).toBe(1);
    expect(stream.chunks[0]?.includes('\u001B[')).toBe(false);
    expect(stream.chunks[0]).toBe(
      '{"fields":{"a.key":"first","request.id":"req_1","service.name":"web-api","z.key":"last"},"metadata":{"droppedFields":["debug.payload"],"redactedFields":["user.email"],"samplingDecision":"KEEP_NORMAL","samplingReason":"slow_request"},"subEvents":[{"fields":{"a.inner":"a","z.inner":"z"},"name":"llm.step.started","timestamp":123}],"timings":{"db.query":12,"http.total":42}}\n'
    );
  });

  it('applies metadata inclusion policy in pretty and compact modes', () => {
    const emptyMetadataEvent = makeEvent({ metadata: {} });
    const undefinedMetadataEvent = makeEvent({
      metadata: {
        samplingDecision: undefined,
        samplingReason: undefined,
        droppedFields: undefined,
        redactedFields: undefined,
      },
    });

    const autoPrettyStream = createMemoryStream({ isTTY: false });
    consoleSink({ stream: autoPrettyStream, includeMetadata: 'auto' }).emit(emptyMetadataEvent);
    expect(autoPrettyStream.chunks[0]).not.toContain('metadata:');

    const autoPrettyUndefinedStream = createMemoryStream({ isTTY: false });
    consoleSink({ stream: autoPrettyUndefinedStream, includeMetadata: 'auto' }).emit(undefinedMetadataEvent);
    expect(autoPrettyUndefinedStream.chunks[0]).not.toContain('metadata:');

    const alwaysPrettyStream = createMemoryStream({ isTTY: false });
    consoleSink({ stream: alwaysPrettyStream, includeMetadata: 'always' }).emit(emptyMetadataEvent);
    expect(alwaysPrettyStream.chunks[0]).toContain('metadata:\n  {}\n');

    const neverPrettyStream = createMemoryStream({ isTTY: false });
    consoleSink({ stream: neverPrettyStream, includeMetadata: 'never' }).emit(makeEvent());
    expect(neverPrettyStream.chunks[0]).not.toContain('metadata:');

    const autoCompactStream = createMemoryStream({ isTTY: false });
    consoleSink({ stream: autoCompactStream, pretty: false, includeMetadata: 'auto' }).emit(emptyMetadataEvent);
    expect(autoCompactStream.chunks[0]).not.toContain('"metadata"');

    const autoCompactUndefinedStream = createMemoryStream({ isTTY: false });
    consoleSink({
      stream: autoCompactUndefinedStream,
      pretty: false,
      includeMetadata: 'auto',
    }).emit(undefinedMetadataEvent);
    expect(autoCompactUndefinedStream.chunks[0]).not.toContain('"metadata"');

    const alwaysCompactStream = createMemoryStream({ isTTY: false });
    consoleSink({ stream: alwaysCompactStream, pretty: false, includeMetadata: 'always' }).emit(emptyMetadataEvent);
    expect(alwaysCompactStream.chunks[0]).toContain('"metadata":{}');

    const neverCompactStream = createMemoryStream({ isTTY: false });
    consoleSink({ stream: neverCompactStream, pretty: false, includeMetadata: 'never' }).emit(makeEvent());
    expect(neverCompactStream.chunks[0]).not.toContain('"metadata"');
  });

  it('colors only the header line and defaults colors from tty state', () => {
    const ttyStream = createMemoryStream({ isTTY: true });
    consoleSink({ stream: ttyStream }).emit(makeEvent({ metadata: { samplingDecision: 'KEEP_DEBUG' } }));

    const ttyOutput = ttyStream.chunks[0] ?? '';
    const [ttyHeader = '', ...ttyBody] = ttyOutput.split('\n');

    expect(ttyHeader).toContain('\u001B[36m');
    expect(ttyHeader).toContain('\u001B[0m');
    expect(ttyBody.join('\n')).not.toContain('\u001B[');

    const noColorStream = createMemoryStream({ isTTY: true });
    consoleSink({ stream: noColorStream, colors: false }).emit(makeEvent());
    expect(noColorStream.chunks[0]).toBe(stripAnsi(noColorStream.chunks[0] ?? ''));
  });

  it('omits empty timings and subevents sections in pretty mode', () => {
    const stream = createMemoryStream({ isTTY: false });
    const sink = consoleSink({ stream });

    sink.emit(
      makeEvent({
        timings: {},
        subEvents: [],
      })
    );

    expect(stream.chunks[0]).not.toContain('timings:');
    expect(stream.chunks[0]).not.toContain('subevents:');
    expect(stream.chunks[0]).toContain('fields:');
  });

  it('writes only to the provided stream once per event', () => {
    const stream = createMemoryStream({ isTTY: false });
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    try {
      consoleSink({ stream }).emit(makeEvent());
    } finally {
      stdoutSpy.mockRestore();
    }

    expect(stream.writeCalls).toBe(1);
    expect(stdoutSpy).not.toHaveBeenCalled();
  });

  it('drain resolves without writing output', async () => {
    const stream = createMemoryStream({ isTTY: false });
    const sink = consoleSink({ stream });

    await expect(sink.drain?.()).resolves.toBeUndefined();
    expect(stream.writeCalls).toBe(0);
  });
});
