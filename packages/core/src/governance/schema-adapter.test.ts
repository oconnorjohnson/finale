import { describe, expect, it } from 'vitest';
import type { SafeParseResult, SchemaType } from '../types/index.js';
import { isOptionalSchema, parseWithSchema, safeParseWithSchema } from './schema-adapter.js';

function mockSchema(optional: boolean): SchemaType<string> {
  return {
    parse(value: unknown): string {
      if (typeof value !== 'string') {
        throw new Error('invalid');
      }
      return value;
    },
    safeParse(value: unknown): SafeParseResult<string> {
      if (typeof value !== 'string') {
        return { success: false, error: new Error('invalid') };
      }
      return { success: true, data: value };
    },
    isOptional(): boolean {
      return optional;
    },
  };
}

describe('schema adapter helpers', () => {
  it('runs parse and safeParse through schema abstraction', () => {
    const schema = mockSchema(false);
    expect(parseWithSchema(schema, 'ok')).toBe('ok');
    expect(safeParseWithSchema(schema, 'ok')).toEqual({ success: true, data: 'ok' });
    expect(safeParseWithSchema(schema, 1).success).toBe(false);
  });

  it('detects optional schemas', () => {
    expect(isOptionalSchema(mockSchema(true))).toBe(true);
    expect(isOptionalSchema(mockSchema(false))).toBe(false);
  });
});
