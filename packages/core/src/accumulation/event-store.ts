import type { FinalizedEvent, LimitsConfig, SubEvent } from '../types/index.js';

export interface EventStoreOptions {
  defaults?: Record<string, unknown>;
  limits?: LimitsConfig;
  maxSubEvents?: number;
  maxSubEventFields?: number;
}

const DEFAULT_LIMITS: Required<LimitsConfig> = {
  maxKeys: 100,
  maxTotalSize: 64 * 1024,
  maxArrayLength: 20,
  maxStringLength: 1000,
};

const DEFAULT_MAX_SUB_EVENTS = 50;
const DEFAULT_MAX_SUB_EVENT_FIELDS = 20;

function estimateSize(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value));
}

export class EventStore {
  private readonly limits: Required<LimitsConfig>;
  private readonly maxSubEvents: number;
  private readonly maxSubEventFields: number;
  private readonly fields: Record<string, unknown>;
  private readonly subEvents: SubEvent[] = [];
  private readonly droppedFields = new Set<string>();

  constructor(options: EventStoreOptions = {}) {
    this.limits = { ...DEFAULT_LIMITS, ...options.limits };
    this.maxSubEvents = options.maxSubEvents ?? DEFAULT_MAX_SUB_EVENTS;
    this.maxSubEventFields = options.maxSubEventFields ?? DEFAULT_MAX_SUB_EVENT_FIELDS;
    this.fields = { ...(options.defaults ?? {}) };
  }

  add(fields: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(fields)) {
      this.setField(key, value);
    }
  }

  addSubEvent(name: string, fields?: Record<string, unknown>): void {
    if (this.subEvents.length >= this.maxSubEvents) {
      return;
    }

    const trimmedFields = fields ? this.trimSubEventFields(fields) : undefined;
    this.subEvents.push({
      name,
      timestamp: Date.now(),
      ...(trimmedFields ? { fields: trimmedFields } : {}),
    });
  }

  getDroppedFields(): string[] {
    return [...this.droppedFields];
  }

  getFields(): Record<string, unknown> {
    return { ...this.fields };
  }

  finalize(timings: Record<string, number>): FinalizedEvent {
    const metadata: FinalizedEvent['metadata'] = {};
    const dropped = this.getDroppedFields();
    if (dropped.length > 0) {
      metadata.droppedFields = dropped;
    }

    const finalized: FinalizedEvent = {
      fields: this.getFields(),
      timings,
      metadata,
    };

    if (this.subEvents.length > 0) {
      finalized.subEvents = [...this.subEvents];
    }

    return finalized;
  }

  private setField(key: string, incomingValue: unknown): void {
    if (!(key in this.fields) && Object.keys(this.fields).length >= this.limits.maxKeys) {
      this.droppedFields.add(key);
      return;
    }

    const normalizedIncoming = this.normalizeValue(incomingValue);
    const previous = this.fields[key];
    const merged = this.mergeValues(previous, normalizedIncoming);
    this.fields[key] = merged;

    if (estimateSize(this.fields) > this.limits.maxTotalSize) {
      if (previous === undefined) {
        delete this.fields[key];
      } else {
        this.fields[key] = previous;
      }
      this.droppedFields.add(key);
    }
  }

  private mergeValues(current: unknown, incoming: unknown): unknown {
    if (current === undefined) {
      return incoming;
    }

    if (typeof current === 'number' && typeof incoming === 'number') {
      // Counter-like numeric fields should accumulate across repeated writes.
      return current + incoming;
    }

    if (Array.isArray(current) || Array.isArray(incoming)) {
      const currentValues = Array.isArray(current) ? current : [current];
      const incomingValues = Array.isArray(incoming) ? incoming : [incoming];
      return [...currentValues, ...incomingValues].slice(-this.limits.maxArrayLength);
    }

    return incoming;
  }

  private normalizeValue(value: unknown): unknown {
    if (typeof value === 'string') {
      return value.length > this.limits.maxStringLength
        ? value.slice(0, this.limits.maxStringLength)
        : value;
    }

    if (Array.isArray(value)) {
      return value.slice(-this.limits.maxArrayLength).map((item) => this.normalizeValue(item));
    }

    return value;
  }

  private trimSubEventFields(fields: Record<string, unknown>): Record<string, unknown> {
    const entries = Object.entries(fields).slice(0, this.maxSubEventFields);
    return Object.fromEntries(entries.map(([key, value]) => [key, this.normalizeValue(value)]));
  }
}
