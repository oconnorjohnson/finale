import { describe, expect, it } from 'vitest';
import type { FieldDefinition, FieldRegistry, SchemaType } from '../types/index.js';
import { BudgetEnforcer } from './budget-enforcer.js';

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

function makeField(priority: FieldDefinition['priority']): FieldDefinition {
  return {
    type: passthroughSchema(),
    group: 'core',
    sensitivity: 'safe',
    cardinality: 'low',
    priority,
  };
}

describe('budget enforcer', () => {
  it('drops fields in configured priority order', () => {
    const fieldRegistry: FieldRegistry = {
      keep: makeField('must-keep'),
      first: makeField('drop-first'),
      optional: makeField('optional'),
      important: makeField('important'),
    };
    const enforcer = new BudgetEnforcer({
      fieldRegistry,
      limits: { maxTotalSize: 130 },
    });

    const result = enforcer.enforce({
      keep: 'x'.repeat(40),
      first: 'x'.repeat(40),
      optional: 'x'.repeat(40),
      important: 'x'.repeat(40),
    });

    expect(result.fields.keep).toBeDefined();
    expect(result.fields.first).toBeUndefined();
    expect(result.fields.optional).toBeUndefined();
    expect(result.droppedFields).toEqual(['first', 'optional']);
    expect(result.dropReason).toBe('budget_exceeded');
  });

  it('trims sub-events deterministically when fields are not enough', () => {
    const enforcer = new BudgetEnforcer({
      limits: { maxTotalSize: 250 },
    });
    const result = enforcer.enforce(
      {
        keep: 'x'.repeat(80),
      },
      [
        { name: 'step.1', timestamp: 1, fields: { payload: 'x'.repeat(60) } },
        { name: 'step.2', timestamp: 2, fields: { payload: 'x'.repeat(60) } },
      ]
    );

    expect(result.subEvents).toEqual([{ name: 'step.1', timestamp: 1, fields: { payload: 'x'.repeat(60) } }]);
  });

  it('preserves payload when already inside budget', () => {
    const enforcer = new BudgetEnforcer({ limits: { maxTotalSize: 1024 } });
    const result = enforcer.enforce(
      { route: '/checkout' },
      [{ name: 'step', timestamp: 1, fields: { ok: true } }]
    );

    expect(result.fields).toEqual({ route: '/checkout' });
    expect(result.subEvents).toHaveLength(1);
    expect(result.droppedFields).toEqual([]);
    expect(result.dropReason).toBeUndefined();
  });
});
