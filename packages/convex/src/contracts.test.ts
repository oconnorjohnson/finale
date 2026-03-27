import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createFinale, defineFields, type FieldDefinition, type SchemaType } from '@finalejs/core/portable';
import { createTestSink } from '@finalejs/test';
import { convexFields } from './fields.js';
import { mergeFieldRegistries } from './merge-field-registries.js';
import { withFinaleAction } from './action-wrapper.js';
import { withFinaleHttpAction } from './http-wrapper.js';
import { withFinaleMutation } from './mutation-wrapper.js';
import { withFinaleQuery } from './query-wrapper.js';

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
    group: 'core',
    sensitivity: 'safe',
    cardinality: 'low',
    priority: 'must-keep',
    ...overrides,
  };
}

function createPortableFinale() {
  return createFinale({
    fields: defineFields(
      mergeFieldRegistries(convexFields, {
        'request.id': makeField(),
      })
    ),
    sink: createTestSink(),
  });
}

async function listSourceFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(root, entry.name);
      if (entry.isDirectory()) {
        return listSourceFiles(path);
      }
      return path.endsWith('.ts') ? [path] : [];
    })
  );

  return files.flat();
}

describe('convex wrapper contracts', () => {
  it('preserves query definition keys and only wraps the handler', () => {
    const definition = {
      args: { requestId: 'validator' },
      returns: 'result-validator',
      handler: async (_ctx: object, args: { requestId: string }, _scope: object) => args.requestId,
    };

    const wrapped = withFinaleQuery(createPortableFinale(), definition, {
      name: 'requests:get',
    });

    expect(wrapped).not.toBe(definition);
    expect(wrapped.args).toBe(definition.args);
    expect(wrapped.returns).toBe(definition.returns);
    expect(wrapped.handler).not.toBe(definition.handler);
  });

  it('keeps non-handler object references intact when wrapping', () => {
    const args = { requestId: 'validator' };
    const returns = { type: 'result-validator' };
    const definition = {
      args,
      returns,
      handler: async (_ctx: object, input: { requestId: string }, _scope: object) => input.requestId,
    };

    const wrapped = withFinaleQuery(createPortableFinale(), definition);

    expect(wrapped).not.toBe(definition);
    expect(wrapped.args).toBe(args);
    expect(wrapped.returns).toBe(returns);
  });

  it('preserves mutation and action object syntax', () => {
    const mutation = withFinaleMutation(
      createPortableFinale(),
      {
        args: { requestId: 'validator' },
        handler: async () => 'ok',
      },
      { name: 'requests:update' }
    );
    const action = withFinaleAction(
      createPortableFinale(),
      {
        args: { requestId: 'validator' },
        handler: async () => 'ok',
      },
      { name: 'requests:notify' }
    );

    expect(typeof mutation.handler).toBe('function');
    expect(typeof action.handler).toBe('function');
    expect(mutation.args).toEqual({ requestId: 'validator' });
    expect(action.args).toEqual({ requestId: 'validator' });
  });

  it('returns a raw http handler suitable for convex httpAction', () => {
    const handler = withFinaleHttpAction(createPortableFinale(), {
      route: { path: '/webhooks/stripe', method: 'POST' },
      handler: async () => new Response('ok', { status: 200 }),
    });

    expect(typeof handler).toBe('function');
  });

  it('keeps Convex package source on the portable core import path', async () => {
    const srcDir = dirname(fileURLToPath(import.meta.url));
    const sourceFiles = await listSourceFiles(srcDir);

    for (const sourceFile of sourceFiles) {
      if (sourceFile.endsWith('.test.ts')) {
        continue;
      }

      const source = await readFile(sourceFile, 'utf8');
      expect(source).not.toMatch(/from ['"]@finalejs\/core['"]/);
    }
  });
});
