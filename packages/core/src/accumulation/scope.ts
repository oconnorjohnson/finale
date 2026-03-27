import { captureErrorFields } from './error-capture.js';
import { EventStore, type EventStoreOptions } from './event-store.js';
import { TimerManager } from './timer-manager.js';
import { validateFields, type ValidationIssue, type ValidationMode } from '../governance/validation.js';
import type { ErrorCaptureConfig, FieldRegistry } from '../types/index.js';
import { BudgetEnforcer } from '../safety/budget-enforcer.js';
import { RedactionEngine, type RedactionEngineOptions } from '../safety/redaction-engine.js';
import { applyVerbosityFilter } from '../sampling/verbosity-filter.js';
import { decideSampling, type PolicyEngineOptions } from '../sampling/policy-engine.js';
import { getAttachedSinkRuntime } from '../sink/attachment.js';
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
  errorCapture?: ErrorCaptureConfig;
  validationMode?: ValidationMode;
  onValidationIssue?: (issue: ValidationIssue) => void;
  onFlushReceipt?: (receipt: FlushReceipt) => void;
  safety?: Omit<RedactionEngineOptions, 'fieldRegistry'>;
  sampling?: PolicyEngineOptions;
};

export class AccumulationScope implements Scope {
  public readonly event: EventAPI;
  public readonly timers: TimerAPI;

  private readonly eventStore: EventStore;
  private readonly timerManager: TimerManager;
  private readonly fieldRegistry: FieldRegistry | undefined;
  private readonly errorCapture: ErrorCaptureConfig | undefined;
  private readonly validationMode: ValidationMode;
  private readonly onValidationIssue: ((issue: ValidationIssue) => void) | undefined;
  private readonly onFlushReceipt: ((receipt: FlushReceipt) => void) | undefined;
  private readonly budgetEnforcer: BudgetEnforcer;
  private readonly redactionEngine: RedactionEngine;
  private readonly sampling: PolicyEngineOptions | undefined;
  private lastFinalizedEvent?: FinalizedEvent;
  private readonly validationDroppedFields = new Set<string>();

  constructor(options: ScopeOptions = {}) {
    this.eventStore = new EventStore(options);
    this.timerManager = new TimerManager();
    this.fieldRegistry = options.fieldRegistry;
    this.errorCapture = options.errorCapture;
    this.validationMode = options.validationMode ?? 'soft';
    this.onValidationIssue = options.onValidationIssue;
    this.onFlushReceipt = options.onFlushReceipt;
    this.redactionEngine = new RedactionEngine({
      ...(this.fieldRegistry ? { fieldRegistry: this.fieldRegistry } : {}),
      ...(options.safety?.scanner ? { scanner: options.safety.scanner } : {}),
    });
    this.sampling = options.sampling;
    this.budgetEnforcer = new BudgetEnforcer({
      ...(this.fieldRegistry ? { fieldRegistry: this.fieldRegistry } : {}),
      ...(options.limits ? { limits: options.limits } : {}),
    });

    this.event = {
      add: (fields) => {
        this.eventStore.add(this.validateIncomingFields(fields));
      },
      child: (namespace) => this.createNamespacedApi(namespace),
      error: (err, options) => {
        this.eventStore.add(captureErrorFields(err, { ...this.errorCapture, ...options }));
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
    const redactionResult = this.redactionEngine.apply(finalizedEvent.fields);
    const budgetResult = this.budgetEnforcer.enforce(redactionResult.fields, finalizedEvent.subEvents);
    const droppedFields = [
      ...this.eventStore.getDroppedFields(),
      ...this.validationDroppedFields,
      ...redactionResult.droppedFields,
      ...budgetResult.droppedFields,
    ];
    const redactedFields = redactionResult.redactedFields;

    finalizedEvent.fields = budgetResult.fields;
    if (budgetResult.subEvents && budgetResult.subEvents.length > 0) {
      finalizedEvent.subEvents = budgetResult.subEvents;
    } else {
      delete finalizedEvent.subEvents;
    }
    if (droppedFields.length > 0) {
      finalizedEvent.metadata.droppedFields = [...new Set(droppedFields)];
    }
    if (redactedFields.length > 0) {
      finalizedEvent.metadata.redactedFields = [...new Set(redactedFields)];
    }
    if (budgetResult.dropReason) {
      finalizedEvent.metadata.dropReason = budgetResult.dropReason;
    }

    const samplingDecision = decideSampling(finalizedEvent, this.sampling);
    finalizedEvent.metadata.samplingDecision = samplingDecision.decision;
    if (samplingDecision.reason) {
      finalizedEvent.metadata.samplingReason = samplingDecision.reason;
    }

    const filteredEvent = applyVerbosityFilter(finalizedEvent, samplingDecision.decision, {
      ...(this.fieldRegistry ? { fieldRegistry: this.fieldRegistry } : {}),
    });

    this.lastFinalizedEvent = filteredEvent;

    const attachedSinkRuntime = getAttachedSinkRuntime(this);
    const emitted =
      samplingDecision.decision !== 'DROP' && attachedSinkRuntime
        ? attachedSinkRuntime.enqueue(filteredEvent)
        : false;

    const receipt = {
      emitted,
      decision: samplingDecision,
      fieldsDropped: filteredEvent.metadata.droppedFields ?? [],
      fieldsRedacted: filteredEvent.metadata.redactedFields ?? [],
      finalSize: Buffer.byteLength(JSON.stringify(filteredEvent)),
    };

    this.onFlushReceipt?.(receipt);

    return receipt;
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
