import type { SchemaType, SafeParseResult, SchemaAdapter } from '@finalejs/core';

type ZodSchemaLike<T> = {
  parse(value: unknown): T;
  safeParse(value: unknown):
    | { success: true; data: T }
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

export function zodType<T>(zodSchema: unknown): SchemaType<T> {
  assertZodSchema(zodSchema);

  return {
    parse(value: unknown): T {
      return zodSchema.parse(value) as T;
    },
    safeParse(value: unknown): SafeParseResult<T> {
      const result = zodSchema.safeParse(value);
      if (result.success) {
        return { success: true, data: result.data as T };
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

/**
 * Zod schema adapter for @finalejs/core.
 */
export const zodAdapter: SchemaAdapter = {
  createType<T>(schema: unknown): SchemaType<T> {
    return zodType<T>(schema);
  },
};
