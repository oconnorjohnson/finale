import { describe, expect, it } from 'vitest';
import { EventStore } from './event-store.js';

describe('event store', () => {
  it('applies scalar last-write-wins semantics', () => {
    const store = new EventStore();
    store.add({ 'service.name': 'api-v1' });
    store.add({ 'service.name': 'api-v2' });

    expect(store.getFields()['service.name']).toBe('api-v2');
  });

  it('accumulates numeric values for counter-like writes', () => {
    const store = new EventStore();
    store.add({ 'retry.count': 1 });
    store.add({ 'retry.count': 2 });

    expect(store.getFields()['retry.count']).toBe(3);
  });

  it('appends arrays and caps to max length', () => {
    const store = new EventStore({
      limits: {
        maxArrayLength: 3,
      },
    });

    store.add({ annotations: ['a', 'b'] });
    store.add({ annotations: ['c', 'd'] });

    expect(store.getFields().annotations).toEqual(['b', 'c', 'd']);
  });

  it('preserves prior scalar value when incoming value is an array', () => {
    const store = new EventStore();
    store.add({ annotations: 'initial' });
    store.add({ annotations: ['next', 'final'] });

    expect(store.getFields().annotations).toEqual(['initial', 'next', 'final']);
  });

  it('enforces key and string limits and reports dropped fields', () => {
    const store = new EventStore({
      limits: {
        maxKeys: 1,
        maxStringLength: 3,
      },
    });

    store.add({ one: 'abcdef' });
    store.add({ two: 'ignored' });

    expect(store.getFields().one).toBe('abc');
    expect(store.getFields().two).toBeUndefined();
    expect(store.getDroppedFields()).toContain('two');
  });

  it('stores embedded sub-events with configured caps', () => {
    const store = new EventStore({
      maxSubEvents: 1,
      maxSubEventFields: 1,
    });

    store.addSubEvent('llm.step.started', { a: 1, b: 2 });
    store.addSubEvent('llm.step.completed', { c: 3 });

    const finalized = store.finalize({});
    expect(finalized.subEvents).toHaveLength(1);
    expect(finalized.subEvents?.[0]?.name).toBe('llm.step.started');
    expect(finalized.subEvents?.[0]?.fields).toEqual({ a: 1 });
  });

  it('rolls back merged value when max total size is exceeded for existing key', () => {
    const store = new EventStore({
      limits: {
        maxTotalSize: 40,
      },
    });

    store.add({ message: 'ok' });
    store.add({ message: 'this-value-is-too-large-for-the-limit' });

    expect(store.getFields().message).toBe('ok');
    expect(store.getDroppedFields()).toContain('message');
  });

  it('removes newly added key when max total size is exceeded', () => {
    const store = new EventStore({
      limits: {
        maxTotalSize: 40,
      },
    });

    store.add({ one: 'ok' });
    store.add({ two: 'this-value-is-too-large-for-the-limit' });

    expect(store.getFields().one).toBe('ok');
    expect(store.getFields().two).toBeUndefined();
    expect(store.getDroppedFields()).toContain('two');
  });
});
