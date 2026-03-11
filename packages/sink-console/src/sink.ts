import type { FinalizedEvent, SamplingTier, Sink } from '@finalejs/core';

export interface ConsoleSinkOptions {
  /** Use pretty-printing with colors (default: true) */
  pretty?: boolean;
  /** Output stream (default: process.stdout) */
  stream?: NodeJS.WritableStream;
  /** Enable ANSI colors (default: true when pretty + TTY stream) */
  colors?: boolean;
  /** Control metadata rendering (default: 'auto') */
  includeMetadata?: 'auto' | 'always' | 'never';
}

type MetadataInclusionPolicy = NonNullable<ConsoleSinkOptions['includeMetadata']>;

type OutputStream = NodeJS.WritableStream & Partial<{ isTTY: boolean }>;

interface ResolvedConsoleSinkOptions {
  pretty: boolean;
  stream: OutputStream;
  colors: boolean;
  includeMetadata: MetadataInclusionPolicy;
}

type RenderableRecord = FinalizedEvent | Omit<FinalizedEvent, 'metadata'>;

const ANSI_RESET = '\u001B[0m';
const ANSI_CYAN = '\u001B[36m';
const ANSI_GREEN = '\u001B[32m';
const ANSI_BLUE = '\u001B[34m';
const ANSI_YELLOW = '\u001B[33m';
const ANSI_DIM = '\u001B[2m';

function resolveConsoleSinkOptions(options: ConsoleSinkOptions = {}): ResolvedConsoleSinkOptions {
  const pretty = options.pretty ?? true;
  const stream = (options.stream ?? process.stdout) as OutputStream;

  return {
    pretty,
    stream,
    colors: options.colors ?? (pretty && Boolean(stream.isTTY)),
    includeMetadata: options.includeMetadata ?? 'auto',
  };
}

function getDefinedMetadataEntries(
  metadata: FinalizedEvent['metadata']
): Array<[string, unknown]> {
  return Object.entries(metadata).filter(([, value]) => value !== undefined);
}

function shouldIncludeMetadata(
  record: FinalizedEvent,
  policy: MetadataInclusionPolicy
): boolean {
  if (policy === 'always') {
    return true;
  }

  if (policy === 'never') {
    return false;
  }

  return getDefinedMetadataEntries(record.metadata).length > 0;
}

function buildRenderableRecord(record: FinalizedEvent, includeMetadata: boolean): RenderableRecord {
  if (includeMetadata) {
    return {
      fields: record.fields,
      timings: record.timings,
      ...(record.subEvents ? { subEvents: record.subEvents } : {}),
      metadata: record.metadata,
    };
  }

  return {
    fields: record.fields,
    timings: record.timings,
    ...(record.subEvents ? { subEvents: record.subEvents } : {}),
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stableSortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => stableSortValue(item));
  }

  if (!isPlainObject(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([, nestedValue]) => nestedValue !== undefined)
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
      .map(([key, nestedValue]) => [key, stableSortValue(nestedValue)])
  );
}

function stableStringify(value: unknown, spacing?: number): string {
  return JSON.stringify(stableSortValue(value), null, spacing);
}

function indentBlock(block: string): string {
  return block
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n');
}

function getHeaderTierLabel(samplingDecision: SamplingTier | undefined): string {
  return samplingDecision ?? 'UNKNOWN';
}

function colorizeHeader(
  text: string,
  samplingDecision: SamplingTier | undefined,
  enabled: boolean
): string {
  if (!enabled) {
    return text;
  }

  const color =
    samplingDecision === 'KEEP_DEBUG'
      ? ANSI_CYAN
      : samplingDecision === 'KEEP_NORMAL'
        ? ANSI_GREEN
        : samplingDecision === 'KEEP_MINIMAL'
          ? ANSI_BLUE
          : samplingDecision === 'DROP'
            ? ANSI_YELLOW
            : ANSI_DIM;

  return `${color}${text}${ANSI_RESET}`;
}

function formatPrettyRecord(record: FinalizedEvent, options: ResolvedConsoleSinkOptions): string {
  const includeMetadata = shouldIncludeMetadata(record, options.includeMetadata);
  const renderableRecord = buildRenderableRecord(record, includeMetadata);
  const headerTier = getHeaderTierLabel(record.metadata.samplingDecision);
  const samplingReason = record.metadata.samplingReason;
  const header = colorizeHeader(
    `[finale] ${headerTier}${samplingReason ? ` (${samplingReason})` : ''}`,
    record.metadata.samplingDecision,
    options.colors
  );

  const sections = [
    header,
    `fields:\n${indentBlock(stableStringify(renderableRecord.fields, 2))}`,
  ];

  if (Object.keys(renderableRecord.timings).length > 0) {
    sections.push(`timings:\n${indentBlock(stableStringify(renderableRecord.timings, 2))}`);
  }

  if ('subEvents' in renderableRecord && renderableRecord.subEvents && renderableRecord.subEvents.length > 0) {
    sections.push(`subevents:\n${indentBlock(stableStringify(renderableRecord.subEvents, 2))}`);
  }

  if ('metadata' in renderableRecord) {
    sections.push(`metadata:\n${indentBlock(stableStringify(renderableRecord.metadata, 2))}`);
  }

  return `${sections.join('\n')}\n`;
}

function formatCompactRecord(record: FinalizedEvent, options: ResolvedConsoleSinkOptions): string {
  const includeMetadata = shouldIncludeMetadata(record, options.includeMetadata);
  const renderableRecord = buildRenderableRecord(record, includeMetadata);
  return `${stableStringify(renderableRecord)}\n`;
}

/**
 * Create a console sink for development/debugging.
 */
export function consoleSink(options?: ConsoleSinkOptions): Sink {
  const resolvedOptions = resolveConsoleSinkOptions(options);

  return {
    emit(record: FinalizedEvent): void {
      const output = resolvedOptions.pretty
        ? formatPrettyRecord(record, resolvedOptions)
        : formatCompactRecord(record, resolvedOptions);

      resolvedOptions.stream.write(output);
    },
    async drain(): Promise<void> {
      return Promise.resolve();
    },
  };
}
