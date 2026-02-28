import { describe, expect, it } from 'vitest';
import type { FieldDefinition, SchemaType } from '../types/index.js';
import { defineFields, FieldRegistryStore } from './field-registry.js';

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

describe('field registry', () => {
  it('defineFields preserves declarations', () => {
    const fields = defineFields({
      'http.route': makeField(stringSchema()),
    });
    expect(fields['http.route']).toBeDefined();
  });

  it('supports has/get/keys/queryNamespace', () => {
    const store = new FieldRegistryStore(
      defineFields({
        'http.route': makeField(stringSchema()),
        'http.method': makeField(stringSchema()),
        'payment.provider': makeField(stringSchema()),
      })
    );

    expect(store.has('http.route')).toBe(true);
    expect(store.get('http.route')).toBeDefined();
    expect(store.keys()).toHaveLength(3);
    expect(store.queryNamespace('http.*').map(([key]) => key)).toEqual(['http.route', 'http.method']);
    expect(store.queryNamespace('payment').map(([key]) => key)).toEqual(['payment.provider']);
  });
});
