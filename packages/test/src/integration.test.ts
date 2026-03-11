import { describe, expect, it } from 'vitest';
import type { FieldDefinition, FlushReceipt, SamplingPolicy, SchemaType } from '@finalejs/core';
import { createFinale, defineFields, withScope } from '@finalejs/core';
import { assertFields, assertNoField, assertSamplingDecision } from './assertions.js';
import { createTestSink } from './test-sink.js';

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

function createReceipt(decision: FlushReceipt['decision']['decision']): FlushReceipt {
  return {
    emitted: decision !== 'DROP',
    decision: { decision },
    fieldsDropped: [],
    fieldsRedacted: [],
    finalSize: 10,
  };
}

describe('@finalejs/test integration', () => {
  it('captures events and receipts through the public core API', async () => {
    const sink = createTestSink();
    const finale = createFinale({
      fields: defineFields({
        'request.id': makeField(),
        'http.status_code': makeField(),
      }),
      sink,
    });

    await withScope(finale, async (scope) => {
      scope.event.add({
        'request.id': 'req_1',
        'http.status_code': '200',
      });

      const receipt = sink.captureReceipt(scope.event.flush());
      assertSamplingDecision(receipt, 'KEEP_NORMAL');
    });

    await finale.drain();

    assertFields(sink.lastEvent(), {
      'request.id': 'req_1',
      'http.status_code': '200',
    });
    assertSamplingDecision(sink.lastReceipt(), 'KEEP_NORMAL');
  });

  it('captures sampled-out receipts without emitted events', async () => {
    const sink = createTestSink();
    const sampling: SamplingPolicy = {
      decide() {
        return { decision: 'DROP', reason: 'sampled_out' };
      },
    };
    const finale = createFinale({
      fields: defineFields({
        'request.id': makeField(),
      }),
      sink,
      sampling,
    });

    await withScope(finale, async (scope) => {
      scope.event.add({ 'request.id': 'req_drop' });
      sink.captureReceipt(scope.event.flush());
    });

    await finale.drain();

    expect(sink.allEvents()).toEqual([]);
    assertSamplingDecision(sink.lastReceipt(), 'DROP');
  });

  it('preserves order across multiple scopes', async () => {
    const sink = createTestSink();
    const finale = createFinale({
      fields: defineFields({
        'request.id': makeField(),
      }),
      sink,
    });

    await withScope(finale, async (scope) => {
      scope.event.add({ 'request.id': 'req_1' });
    });

    sink.captureReceipt(createReceipt('KEEP_NORMAL'));

    await withScope(finale, async (scope) => {
      scope.event.add({ 'request.id': 'req_2' });
    });

    sink.captureReceipt(createReceipt('KEEP_NORMAL'));

    await finale.drain();

    expect(sink.allEvents().map((event) => event.fields['request.id'])).toEqual(['req_1', 'req_2']);
    expect(sink.allReceipts().map((receipt) => receipt.decision.decision)).toEqual([
      'KEEP_NORMAL',
      'KEEP_NORMAL',
    ]);
  });

  it('can be cleared and reused without leaking state', async () => {
    const sink = createTestSink();
    const firstFinale = createFinale({
      fields: defineFields({
        'request.id': makeField(),
        'secret.token': makeField({ sensitivity: 'secret', transform: 'drop' }),
      }),
      sink,
    });

    await withScope(firstFinale, async (scope) => {
      scope.event.add({
        'request.id': 'req_before_clear',
        'secret.token': 'token-1',
      });
    });

    sink.captureReceipt(createReceipt('KEEP_NORMAL'));

    await firstFinale.drain();
    assertNoField(sink.lastEvent(), 'secret.token');

    sink.clear();

    const secondFinale = createFinale({
      fields: defineFields({
        'request.id': makeField(),
      }),
      sink,
    });

    await withScope(secondFinale, async (scope) => {
      scope.event.add({ 'request.id': 'req_after_clear' });
    });

    sink.captureReceipt(createReceipt('KEEP_NORMAL'));

    await secondFinale.drain();

    expect(sink.allEvents()).toHaveLength(1);
    expect(sink.allReceipts()).toHaveLength(1);
    assertFields(sink.lastEvent(), { 'request.id': 'req_after_clear' });
  });
});
