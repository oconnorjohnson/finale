import { describe, expect, it } from 'vitest';
import { defineFields, type FieldDefinition, type SchemaType } from '@finalejs/core/portable';
import { convexFields } from './fields.js';
import { mergeFieldRegistries } from './merge-field-registries.js';

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
    group: 'domain',
    sensitivity: 'safe',
    cardinality: 'low',
    priority: 'important',
    ...overrides,
  };
}

describe('convexFields', () => {
  it('defines the canonical convex and http field family', () => {
    expect(convexFields).toEqual(
      expect.objectContaining({
        'convex.function.name': expect.any(Object),
        'convex.function.kind': expect.any(Object),
        'convex.function.outcome': expect.any(Object),
        'http.method': expect.any(Object),
        'http.route': expect.any(Object),
        'http.status_code': expect.any(Object),
        'http.duration_ms': expect.any(Object),
      })
    );
  });

  it('merges cleanly with consumer field registries using right-hand overrides', () => {
    const merged = defineFields(
      mergeFieldRegistries(convexFields, {
        'http.route': makeField({
          group: 'domain',
        }),
        'request.id': makeField(),
      })
    );

    expect(merged['request.id']).toBeDefined();
    expect(merged['http.route']?.group).toBe('domain');
  });
});
