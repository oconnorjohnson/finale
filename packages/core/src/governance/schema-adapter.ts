import type { SafeParseResult, SchemaType } from '../types/index.js';

export function safeParseWithSchema<T>(schema: SchemaType<T>, value: unknown): SafeParseResult<T> {
  return schema.safeParse(value);
}

export function parseWithSchema<T>(schema: SchemaType<T>, value: unknown): T {
  return schema.parse(value);
}

export function isOptionalSchema(schema: SchemaType<unknown>): boolean {
  return schema.isOptional();
}
