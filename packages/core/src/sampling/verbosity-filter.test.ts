import { describe, expect, it } from 'vitest';
import type { FieldRegistry, FinalizedEvent, SchemaType } from '../types/index.js';
import { applyVerbosityFilter } from './verbosity-filter.js';

function passthroughSchema(): SchemaType<unknown> {
  return {
    parse(value: unknown): unknown {
      return value;
    },
    safeParse(value: unknown) {
      return { success: true as const, data: value };
    },
    isOptional(): boolean {
      return true;
    },
  };
}

const fieldRegistry: FieldRegistry = {
  'request.id': {
    type: passthroughSchema(),
    group: 'core',
    sensitivity: 'safe',
    cardinality: 'low',
    priority: 'must-keep',
  },
  'user.id': {
    type: passthroughSchema(),
    group: 'domain',
    sensitivity: 'safe',
    cardinality: 'low',
    priority: 'important',
  },
  'db.statement': {
    type: passthroughSchema(),
    group: 'diagnostics',
    sensitivity: 'safe',
    cardinality: 'low',
    priority: 'optional',
  },
};

function makeEvent(): FinalizedEvent {
  return {
    fields: {
      'request.id': 'req_1',
      'user.id': 'usr_1',
      'db.statement': 'SELECT 1',
      unknown: true,
    },
    timings: {},
    subEvents: [
      { name: 'llm.step.completed', timestamp: 1 },
      { name: 'llm.step.error', timestamp: 2 },
    ],
    metadata: {},
  };
}

describe('verbosity filter', () => {
  it('keeps only core fields and critical sub-events in minimal mode', () => {
    const filtered = applyVerbosityFilter(makeEvent(), 'KEEP_MINIMAL', { fieldRegistry });

    expect(filtered.fields).toEqual({ 'request.id': 'req_1' });
    expect(filtered.subEvents).toEqual([{ name: 'llm.step.error', timestamp: 2 }]);
  });

  it('keeps core and domain fields in normal mode', () => {
    const filtered = applyVerbosityFilter(makeEvent(), 'KEEP_NORMAL', { fieldRegistry });

    expect(filtered.fields).toEqual({
      'request.id': 'req_1',
      'user.id': 'usr_1',
      unknown: true,
    });
    expect(filtered.subEvents).toHaveLength(2);
  });

  it('drops all payload fields in drop mode', () => {
    const filtered = applyVerbosityFilter(makeEvent(), 'DROP', { fieldRegistry });

    expect(filtered.fields).toEqual({});
    expect(filtered.subEvents).toEqual([]);
  });
});
