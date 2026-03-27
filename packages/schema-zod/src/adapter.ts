import type { SchemaAdapter, SafeParseResult, SchemaType } from '@finalejs/core';
import type { ZodTypeAny, output as ZodOutput } from 'zod';

type ZodSchemaLike<TOutput = unknown> = {
  parse(value: unknown): TOutput;
  safeParse(value: unknown):
    | { success: true; data: TOutput }
    | { success: false; error: unknown };
  isOptional(): boolean;
};

function assertZodSchema(schema: unknown): asserts schema is ZodSchemaLike<unknown> {
  if (
    !schema ||
    typeof schema !== 'object' ||
    typeof (schema as { parse?: unknown }).parse !== 'function' ||
    typeof (schema as { safeParse?: unknown }).safeParse !== 'function' ||
    typeof (schema as { isOptional?: unknown }).isOptional !== 'function'
  ) {
    throw new TypeError('Expected a Zod schema');
  }
}

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function toSchemaType<TOutput>(zodSchema: ZodSchemaLike<TOutput>): SchemaType<TOutput> {
  return {
    parse(value: unknown): TOutput {
      return zodSchema.parse(value);
    },
    safeParse(value: unknown): SafeParseResult<TOutput> {
      const result = zodSchema.safeParse(value);
      if (result.success) {
        return { success: true, data: result.data };
      }

      return {
        success: false,
        error: normalizeError(result.error),
      };
    },
    isOptional(): boolean {
      return zodSchema.isOptional();
    },
  };
}

export function zodType<TSchema extends ZodTypeAny>(
  zodSchema: TSchema
): SchemaType<ZodOutput<TSchema>>;
export function zodType(zodSchema: unknown): SchemaType<unknown>;
export function zodType(zodSchema: unknown): SchemaType<unknown> {
  assertZodSchema(zodSchema);

  return toSchemaType(zodSchema);
}

/**
 * Zod schema adapter for @finalejs/core.
 */
export const zodAdapter: SchemaAdapter = {
  createType<T>(schema: unknown): SchemaType<T> {
    assertZodSchema(schema);
    return toSchemaType(schema) as SchemaType<T>;
  },
};
