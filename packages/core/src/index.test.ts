import { describe, expect, it, vi } from 'vitest';
import { getNoopScope } from './runtime/noop-scope.js';
import * as core from './index.js';
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

describe('package root exports', () => {
  it('exports the public engine and scope helpers', async () => {
    const { emitted, sink } = createRecordingSink();
    const finale = core.createFinale({
      fields: core.defineFields({
        'request.id': makeField(),
      }),
      sink,
    });

    expect(typeof core.createFinale).toBe('function');
    expect(typeof core.getScope).toBe('function');
    expect(typeof core.hasScope).toBe('function');
    expect(typeof core.withScope).toBe('function');

    await core.withScope(finale, async (scope) => {
      expect(core.hasScope()).toBe(true);
      expect(core.getScope()).toBe(scope);
      scope.event.add({ 'request.id': 'req_root' });
    });

    await finale.drain();

    expect(emitted).toHaveLength(1);
    expect(emitted[0]?.fields['request.id']).toBe('req_root');
  });

  it('falls back to the no-op scope outside active context', () => {
    expect(core.hasScope()).toBe(false);
    expect(core.getScope()).toBe(getNoopScope());
  });

  it('does not expose internal runtime helpers from the package root', () => {
    expect('runWithScope' in core).toBe(false);
    expect('startScope' in core).toBe(false);
    expect('endScope' in core).toBe(false);
    expect('getNoopScope' in core).toBe(false);
  });
});
