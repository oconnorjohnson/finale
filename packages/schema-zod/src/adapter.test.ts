import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { zodAdapter, zodType } from './adapter.js';

describe('@finalejs/schema-zod adapter', () => {
  it('parses valid scalar values', () => {
    const schema = zodType<string>(z.string());

    expect(schema.parse('ok')).toBe('ok');
  });

  it('throws on invalid scalar values', () => {
    const schema = zodType<string>(z.string());

    expect(() => schema.parse(123)).toThrow();
  });

  it('parses object schemas into structured output', () => {
    const schema = zodType<{ id: string; count: number }>(
      z.object({
        id: z.string(),
        count: z.number(),
      })
    );

    expect(schema.parse({ id: 'evt_1', count: 2 })).toEqual({
      id: 'evt_1',
      count: 2,
    });
  });

  it('returns safeParse success for valid input', () => {
    const schema = zodType<number>(z.number());

    expect(schema.safeParse(42)).toEqual({ success: true, data: 42 });
  });

  it('returns safeParse failure with an Error for invalid input', () => {
    const schema = zodType<number>(z.number());
    const result = schema.safeParse('nope');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(Error);
    }
  });

  it('reports optional schemas correctly', () => {
    expect(zodType<string | undefined>(z.string().optional()).isOptional()).toBe(true);
    expect(zodType<string>(z.string()).isOptional()).toBe(false);
  });

  it('creates compatible schema types through zodAdapter', () => {
    const schema = zodAdapter.createType<{ name: string }>(
      z.object({
        name: z.string(),
      })
    );

    expect(schema.parse({ name: 'finale' })).toEqual({ name: 'finale' });
    expect(schema.safeParse({ name: 'finale' })).toEqual({
      success: true,
      data: { name: 'finale' },
    });
    expect(schema.isOptional()).toBe(false);
  });

  it('fails fast on invalid schema inputs', () => {
    expect(() => zodType({})).toThrow(TypeError);
    expect(() => zodAdapter.createType({})).toThrow(TypeError);
  });
});
