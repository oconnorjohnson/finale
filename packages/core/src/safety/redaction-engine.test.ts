import { describe, expect, it } from 'vitest';
import type { FieldDefinition, FieldRegistry, SchemaType } from '../types/index.js';
import { RedactionEngine } from './redaction-engine.js';

function passthroughSchema(): SchemaType<unknown> {
  return {
    parse(value: unknown): unknown {
      return value;
    },
    safeParse(value: unknown) {
      return { success: true as const, data: value };
    },
    isOptional(): boolean {
      return true;
    },
  };
}

function makeField(transform: FieldDefinition['transform']): FieldDefinition {
  return {
    type: passthroughSchema(),
    group: 'core',
    sensitivity: 'safe',
    cardinality: 'low',
    priority: 'important',
    transform,
  };
}

describe('redaction engine', () => {
  it('applies hash, mask, bucket and drop transforms', () => {
    const fieldRegistry: FieldRegistry = {
      email: makeField('hash'),
      token: makeField('mask'),
      duration: makeField('bucket'),
      debug: makeField('drop'),
    };
    const engine = new RedactionEngine({ fieldRegistry });

    const result = engine.apply({
      email: 'alice@example.com',
      token: 'abc123',
      duration: 42,
      debug: 'omit-me',
      plain: 'keep-me',
    });

    expect(result.fields.email).toMatch(/^hash:/);
    expect(result.fields.token).toBe('[REDACTED]');
    expect(result.fields.duration).toBe('10-99');
    expect(result.fields.debug).toBeUndefined();
    expect(result.fields.plain).toBe('keep-me');
    expect(result.redactedFields).toEqual(expect.arrayContaining(['email', 'token', 'duration']));
    expect(result.droppedFields).toEqual(['debug']);
  });

  it('applies pattern scanner as fallback safety net', () => {
    const engine = new RedactionEngine();
    const result = engine.apply({
      note: 'user email alice@example.com',
      safe: 'service healthy',
    });

    expect(result.fields.note).toBe('[REDACTED]');
    expect(result.fields.safe).toBe('service healthy');
    expect(result.redactedFields).toContain('note');
  });

  it('produces deterministic hashes for the same value', () => {
    const fieldRegistry: FieldRegistry = {
      secret: makeField('hash'),
    };
    const engine = new RedactionEngine({ fieldRegistry });

    const first = engine.apply({ secret: 'stable-value' }).fields.secret;
    const second = engine.apply({ secret: 'stable-value' }).fields.secret;

    expect(first).toBe(second);
  });
});
