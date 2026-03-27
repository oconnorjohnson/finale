import type { FieldDefinition, FieldRegistry, SchemaType } from '@finalejs/core/portable';

function stringType(): SchemaType<string> {
  return {
    parse(value: unknown): string {
      if (typeof value !== 'string') {
        throw new Error('invalid string');
      }

      return value;
    },
    safeParse(value: unknown) {
      if (typeof value !== 'string') {
        return { success: false as const, error: new Error('invalid string') };
      }

      return { success: true as const, data: value };
    },
    isOptional(): boolean {
      return false;
    },
  };
}

function numberType(): SchemaType<number> {
  return {
    parse(value: unknown): number {
      if (typeof value !== 'number') {
        throw new Error('invalid number');
      }

      return value;
    },
    safeParse(value: unknown) {
      if (typeof value !== 'number') {
        return { success: false as const, error: new Error('invalid number') };
      }

      return { success: true as const, data: value };
    },
    isOptional(): boolean {
      return false;
    },
  };
}

function makeField(type: SchemaType<unknown>, overrides: Partial<FieldDefinition> = {}): FieldDefinition {
  return {
    type,
    group: 'core',
    sensitivity: 'safe',
    cardinality: 'low',
    priority: 'must-keep',
    ...overrides,
  };
}

export const convexFields: FieldRegistry = {
  'convex.function.name': makeField(stringType(), {
    cardinality: 'medium',
  }),
  'convex.function.kind': makeField(stringType()),
  'convex.function.outcome': makeField(stringType()),
  'http.method': makeField(stringType()),
  'http.route': makeField(stringType(), {
    cardinality: 'medium',
  }),
  'http.status_code': makeField(numberType()),
  'http.duration_ms': makeField(numberType(), {
    priority: 'important',
  }),
};
