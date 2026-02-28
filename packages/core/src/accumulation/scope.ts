import { captureErrorFields } from './error-capture.js';
import { EventStore, type EventStoreOptions } from './event-store.js';
import { TimerManager } from './timer-manager.js';
import type {
  EventAPI,
  FlushReceipt,
  NamespacedEventAPI,
  Scope,
  TimerAPI,
  FinalizedEvent,
} from '../types/index.js';

export type ScopeOptions = EventStoreOptions;

export class AccumulationScope implements Scope {
  public readonly event: EventAPI;
  public readonly timers: TimerAPI;

  private readonly eventStore: EventStore;
  private readonly timerManager: TimerManager;
  private lastFinalizedEvent?: FinalizedEvent;

  constructor(options: ScopeOptions = {}) {
    this.eventStore = new EventStore(options);
    this.timerManager = new TimerManager();

    this.event = {
      add: (fields) => {
        this.eventStore.add(fields);
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
        this.eventStore.add(prefixedFields);
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
      fieldsDropped: this.eventStore.getDroppedFields(),
      fieldsRedacted: [],
      finalSize: Buffer.byteLength(JSON.stringify(finalizedEvent)),
    };
  }
}
