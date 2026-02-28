import { captureErrorFields } from './error-capture.js';
import { EventStore, type EventStoreOptions } from './event-store.js';
import { TimerManager } from './timer-manager.js';
import { validateFields, type ValidationIssue, type ValidationMode } from '../governance/validation.js';
import type { FieldRegistry } from '../types/index.js';
import type {
  EventAPI,
  FlushReceipt,
  NamespacedEventAPI,
  Scope,
  TimerAPI,
  FinalizedEvent,
} from '../types/index.js';

export type ScopeOptions = EventStoreOptions & {
  fieldRegistry?: FieldRegistry;
  validationMode?: ValidationMode;
  onValidationIssue?: (issue: ValidationIssue) => void;
};

export class AccumulationScope implements Scope {
  public readonly event: EventAPI;
  public readonly timers: TimerAPI;

  private readonly eventStore: EventStore;
  private readonly timerManager: TimerManager;
  private readonly fieldRegistry: FieldRegistry | undefined;
  private readonly validationMode: ValidationMode;
  private readonly onValidationIssue: ((issue: ValidationIssue) => void) | undefined;
  private lastFinalizedEvent?: FinalizedEvent;
  private readonly validationDroppedFields = new Set<string>();

  constructor(options: ScopeOptions = {}) {
    this.eventStore = new EventStore(options);
    this.timerManager = new TimerManager();
    this.fieldRegistry = options.fieldRegistry;
    this.validationMode = options.validationMode ?? 'soft';
    this.onValidationIssue = options.onValidationIssue;

    this.event = {
      add: (fields) => {
        this.eventStore.add(this.validateIncomingFields(fields));
      },
      child: (namespace) => this.createNamespacedApi(namespace),
      error: (err, options) => {
        this.eventStore.add(captureErrorFields(err, options));
      },
      annotate: (tag) => {
        this.eventStore.add({ annotations: [tag] });
      },
      subEvent: (name, fields) => {
        this.eventStore.addSubEvent(name, fields);
      },
      flush: () => this.flush(),
    };

    this.timers = {
      start: (name) => this.timerManager.start(name),
      end: (name) => this.timerManager.end(name),
      measure: (name, fn) => this.timerManager.measure(name, fn),
    };
  }

  getLastFinalizedEvent(): FinalizedEvent | undefined {
    return this.lastFinalizedEvent;
  }

  private createNamespacedApi(namespace: string): NamespacedEventAPI {
    return {
      add: (fields) => {
        const prefixedFields = Object.fromEntries(
          Object.entries(fields).map(([key, value]) => [`${namespace}.${key}`, value])
        );
        this.eventStore.add(this.validateIncomingFields(prefixedFields));
      },
    };
  }

  private flush(): FlushReceipt {
    const finalizedEvent = this.eventStore.finalize(this.timerManager.snapshot());
    this.lastFinalizedEvent = finalizedEvent;

    return {
      emitted: false,
      decision: {
        decision: 'KEEP_NORMAL',
        reason: 'accumulated_not_emitted',
      },
      fieldsDropped: [...this.eventStore.getDroppedFields(), ...this.validationDroppedFields],
      fieldsRedacted: [],
      finalSize: Buffer.byteLength(JSON.stringify(finalizedEvent)),
    };
  }

  private validateIncomingFields(fields: Record<string, unknown>): Record<string, unknown> {
    if (!this.fieldRegistry) {
      return fields;
    }

    const result = validateFields({
      fields,
      registry: this.fieldRegistry,
      mode: this.validationMode,
      ...(this.onValidationIssue ? { onIssue: this.onValidationIssue } : {}),
    });

    for (const key of result.dropped) {
      this.validationDroppedFields.add(key);
    }

    return result.accepted;
  }
}
