import { describe, expect, it, vi } from 'vitest';
import type { FieldDefinition, SchemaType } from '../types/index.js';
import { validateFields } from './validation.js';

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

function makeField(type: SchemaType<unknown>): FieldDefinition {
  return {
    type,
    group: 'core',
    sensitivity: 'safe',
    cardinality: 'low',
    priority: 'must-keep',
  };
}

describe('validation engine', () => {
  it('strict mode reports issues but keeps fields', () => {
    const onIssue = vi.fn();
    const result = validateFields({
      fields: {
        'http.route': 123,
        unknown: 'value',
      },
      registry: {
        'http.route': makeField(stringSchema()),
      },
      mode: 'strict',
      onIssue,
    });

    expect(result.accepted).toEqual({
      'http.route': 123,
      unknown: 'value',
    });
    expect(result.dropped).toEqual([]);
    expect(result.issues).toHaveLength(2);
    expect(onIssue).toHaveBeenCalledTimes(2);
  });

  it('soft mode drops unknown and invalid fields', () => {
    const result = validateFields({
      fields: {
        'http.route': 123,
        unknown: 'value',
      },
      registry: {
        'http.route': makeField(stringSchema()),
      },
      mode: 'soft',
    });

    expect(result.accepted).toEqual({});
    expect(result.dropped).toEqual(['http.route', 'unknown']);
    expect(result.issues).toHaveLength(2);
  });

  it('accepts valid values', () => {
    const result = validateFields({
      fields: {
        'http.route': '/checkout',
      },
      registry: {
        'http.route': makeField(stringSchema()),
      },
      mode: 'soft',
    });

    expect(result.accepted).toEqual({ 'http.route': '/checkout' });
    expect(result.dropped).toEqual([]);
    expect(result.issues).toHaveLength(0);
  });
});
