import { createHash } from 'node:crypto';
import type { FieldDefinition, FieldRegistry } from '../types/index.js';
import { PatternScanner, type PatternScannerOptions } from './pattern-scanner.js';

export interface RedactionEngineOptions {
  fieldRegistry?: FieldRegistry;
  scanner?: PatternScannerOptions;
}

export interface RedactionResult {
  fields: Record<string, unknown>;
  redactedFields: string[];
  droppedFields: string[];
}

function hashValue(value: string): string {
  return `hash:${createHash('sha256').update(value).digest('hex')}`;
}

function bucketValue(value: unknown): unknown {
  if (typeof value !== 'number') {
    return value;
  }

  if (value < 10) {
    return '0-9';
  }
  if (value < 100) {
    return '10-99';
  }
  if (value < 1000) {
    return '100-999';
  }
  return '1000+';
}

function applyTransform(transform: FieldDefinition['transform'], value: unknown): { value?: unknown; redacted: boolean; dropped: boolean } {
  switch (transform) {
    case 'drop':
      return { dropped: true, redacted: false };
    case 'hash':
      return {
        value: typeof value === 'string' ? hashValue(value) : hashValue(JSON.stringify(value)),
        redacted: true,
        dropped: false,
      };
    case 'mask':
      return {
        value: '[REDACTED]',
        redacted: true,
        dropped: false,
      };
    case 'bucket':
      return {
        value: bucketValue(value),
        redacted: true,
        dropped: false,
      };
    case 'allow':
    default:
      return { value, redacted: false, dropped: false };
  }
}

export class RedactionEngine {
  private readonly fieldRegistry: FieldRegistry | undefined;
  private readonly scanner: PatternScanner;

  constructor(options: RedactionEngineOptions = {}) {
    this.fieldRegistry = options.fieldRegistry;
    this.scanner = new PatternScanner(options.scanner);
  }

  apply(fields: Record<string, unknown>): RedactionResult {
    const sanitized: Record<string, unknown> = {};
    const redactedFields = new Set<string>();
    const droppedFields = new Set<string>();

    for (const [key, value] of Object.entries(fields)) {
      const definition = this.fieldRegistry?.[key];
      const transform = definition?.transform ?? 'allow';
      const transformed = applyTransform(transform, value);

      if (transformed.dropped) {
        droppedFields.add(key);
        continue;
      }

      let nextValue = transformed.value;
      if (transformed.redacted) {
        redactedFields.add(key);
      }

      if (typeof nextValue === 'string') {
        const scan = this.scanner.scan(nextValue);
        if (scan.isSensitive) {
          nextValue = '[REDACTED]';
          redactedFields.add(key);
        }
      }

      sanitized[key] = nextValue;
    }

    return {
      fields: sanitized,
      redactedFields: [...redactedFields],
      droppedFields: [...droppedFields],
    };
  }
}
