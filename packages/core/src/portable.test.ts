import { describe, expect, it, vi } from 'vitest';
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import * as portable from './portable.js';
import type { FieldDefinition, FinalizedEvent, SchemaType, Sink } from './types/index.js';

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
    priority: 'must-keep',
    cardinality: 'low',
    sensitivity: 'safe',
    group: 'core',
    ...overrides,
  };
}

function createRecordingSink(): { sink: Sink; emitted: FinalizedEvent[] } {
  const emitted: FinalizedEvent[] = [];

  return {
    emitted,
    sink: {
      emit: vi.fn(async (record: FinalizedEvent) => {
        emitted.push(record);
      }),
    },
  };
}

describe('portable entrypoint', () => {
  it('exports runtime-neutral helpers needed for non-Node integrations', async () => {
    const { emitted, sink } = createRecordingSink();
    const finale = portable.createFinale({
      fields: portable.defineFields({
        'request.id': makeField(),
      }),
      sink,
    });

    expect(typeof portable.createFinale).toBe('function');
    expect(typeof portable.defineFields).toBe('function');
    expect(typeof portable.startScope).toBe('function');
    expect(typeof portable.endScope).toBe('function');
    expect('withScope' in portable).toBe(false);
    expect('getScope' in portable).toBe(false);
    expect('hasScope' in portable).toBe(false);
    expect('expressMiddleware' in portable).toBe(false);

    const runtime = portable.startScope(finale);
    runtime.scope.event.add({ 'request.id': 'req_portable' });
    const receipt = portable.endScope(runtime);

    expect(receipt.emitted).toBe(true);

    await finale.drain();
    expect(emitted).toHaveLength(1);
    expect(emitted[0]?.fields['request.id']).toBe('req_portable');
  });

  it('does not pull node async hooks into the built portable bundle', async () => {
    const distPath = resolve(process.cwd(), 'dist/portable.js');
    const sourcePath = resolve(process.cwd(), 'src/portable.ts');

    let bundlePath = sourcePath;
    try {
      await access(distPath);
      bundlePath = distPath;
    } catch {
      bundlePath = sourcePath;
    }

    const bundle = await readFile(bundlePath, 'utf8');
    expect(bundle).not.toContain('node:async_hooks');
    expect(bundle).not.toContain('AsyncLocalStorage');
  });
});
