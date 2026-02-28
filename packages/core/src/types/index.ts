// Core type definitions for @finalejs/core

// =============================================================================
// Field Metadata Types
// =============================================================================

/**
 * Field groups determine verbosity tier inclusion during sampling.
 */
export type FieldGroup = 'core' | 'domain' | 'diagnostics' | 'error';

/**
 * Sensitivity level for PII/secrets handling.
 */
export type FieldSensitivity = 'safe' | 'pii' | 'secret';

/**
 * Expected cardinality of field values.
 */
export type FieldCardinality = 'low' | 'medium' | 'high' | 'unbounded';

/**
 * Priority for budget enforcement - what gets dropped first.
 */
export type FieldPriority = 'must-keep' | 'important' | 'optional' | 'drop-first';

/**
 * Transform rules for the safety layer.
 */
export type FieldTransform = 'allow' | 'hash' | 'mask' | 'bucket' | 'drop';

/**
 * Complete field definition with metadata.
 */
export interface FieldDefinition<T = unknown> {
  /** Type validation via schema adapter */
  type: SchemaType<T>;
  /** Field group for verbosity tiers */
  group: FieldGroup;
  /** Sensitivity level for redaction */
  sensitivity: FieldSensitivity;
  /** Expected cardinality */
  cardinality: FieldCardinality;
  /** Priority for budget enforcement */
  priority: FieldPriority;
  /** Transform rule for safety layer */
  transform?: FieldTransform;
}

// =============================================================================
// Schema Adapter Types
// =============================================================================

/**
 * Result of a safe parse operation.
 */
export type SafeParseResult<T> =
  | { success: true; data: T }
  | { success: false; error: Error };

/**
 * Minimal schema type interface - adapters wrap their schema libraries to this.
 * Core does not depend on Zod or any other schema library.
 */
export interface SchemaType<T = unknown> {
  /** Validate a value, return parsed or throw */
  parse(value: unknown): T;
  /** Safe validate, return result object */
  safeParse(value: unknown): SafeParseResult<T>;
  /** Check if this type is optional */
  isOptional(): boolean;
}

/**
 * Schema adapter interface for plugging in validation libraries.
 */
export interface SchemaAdapter {
  /** Create a schema type from a native schema definition */
  createType<T>(schema: unknown): SchemaType<T>;
}

// =============================================================================
// Sampling Types
// =============================================================================

/**
 * Sampling tier decisions - controls what gets emitted and at what verbosity.
 */
export type SamplingTier = 'DROP' | 'KEEP_MINIMAL' | 'KEEP_NORMAL' | 'KEEP_DEBUG';

/**
 * Result of a sampling decision.
 */
export interface SamplingDecision {
  /** The sampling tier */
  decision: SamplingTier;
  /** Optional reason for debugging/auditing */
  reason?: string;
}

/**
 * Embedded milestone for long-running and LLM-oriented workflows.
 */
export interface SubEvent {
  /** Milestone name (for example: llm.step.completed) */
  name: string;
  /** Timestamp in milliseconds since unix epoch */
  timestamp: number;
  /** Optional milestone-scoped fields */
  fields?: Record<string, unknown>;
}

/**
 * Finalized event ready for sampling decision.
 */
export interface FinalizedEvent {
  /** All accumulated fields */
  fields: Record<string, unknown>;
  /** Timing data */
  timings: Record<string, number>;
  /** Embedded milestones captured during request/workflow execution */
  subEvents?: SubEvent[];
  /** Metadata added by finale */
  metadata: EventMetadata;
}

/**
 * Event metadata added by finale.
 */
export interface EventMetadata {
  /** Schema version if applicable */
  schemaVersion?: string;
  /** Sampling decision that was made */
  samplingDecision?: SamplingTier;
  /** Sampling reason */
  samplingReason?: string;
  /** Fields that were dropped due to budget */
  droppedFields?: string[];
  /** Drop reason */
  dropReason?: string;
  /** Fields that were redacted */
  redactedFields?: string[];
}

/**
 * Sampling policy interface - implement to customize sampling behavior.
 */
export interface SamplingPolicy {
  /** Make a sampling decision based on the finalized event */
  decide(event: FinalizedEvent): SamplingDecision;
}

// =============================================================================
// Sink Types
// =============================================================================

/**
 * Sink interface - adapters implement this to output events.
 */
export interface Sink {
  /** Emit a finalized event record */
  emit(record: FinalizedEvent): void | Promise<void>;
  /** Optional: called on graceful shutdown to flush pending events */
  drain?(): Promise<void>;
}

// =============================================================================
// Flush Receipt
// =============================================================================

/**
 * Receipt returned from flush() for debugging/testing.
 */
export interface FlushReceipt {
  /** Whether the event was emitted to the sink */
  emitted: boolean;
  /** The sampling decision that was made */
  decision: SamplingDecision;
  /** Fields that were dropped due to budget */
  fieldsDropped: string[];
  /** Fields that were redacted */
  fieldsRedacted: string[];
  /** Approximate size of the final event in bytes */
  finalSize: number;
}

// =============================================================================
// Timer API
// =============================================================================

/**
 * Timer API for recording phase durations within the event.
 */
export interface TimerAPI {
  /** Start a named timer */
  start(name: string): void;
  /** End a named timer and record duration */
  end(name: string): void;
  /** Measure an async operation */
  measure<T>(name: string, fn: () => T | Promise<T>): T | Promise<T>;
}

// =============================================================================
// Event API
// =============================================================================

/**
 * Options for error capture.
 */
export interface ErrorCaptureOptions {
  /** Include stack trace (default: false in production) */
  includeStack?: boolean;
}

/**
 * Namespaced event API - auto-prefixes keys with namespace.
 */
export interface NamespacedEventAPI {
  /** Add fields with auto-prefixed keys */
  add(fields: Record<string, unknown>): void;
}

/**
 * Event API - the main interface for adding fields to the wide event.
 */
export interface EventAPI {
  /** Add fields to the event */
  add(fields: Record<string, unknown>): void;
  /** Create a namespaced view that auto-prefixes keys */
  child(namespace: string): NamespacedEventAPI;
  /** Capture and normalize an error */
  error(err: unknown, options?: ErrorCaptureOptions): void;
  /** Add a breadcrumb annotation */
  annotate(tag: string): void;
  /** Add an embedded milestone to the current event */
  subEvent(name: string, fields?: Record<string, unknown>): void;
  /** Manually flush the event (usually handled by middleware) */
  flush(): FlushReceipt;
}

// =============================================================================
// Scope Types
// =============================================================================

/**
 * Scope - the per-request container providing event and timer access.
 */
export interface Scope {
  /** Event API for adding fields */
  readonly event: EventAPI;
  /** Timer API for recording durations */
  readonly timers: TimerAPI;
}

// =============================================================================
// Configuration Types
// =============================================================================

/**
 * Field registry - a mapping of field names to their definitions.
 */
export type FieldRegistry = Record<string, FieldDefinition>;

/**
 * Queue configuration for the sink layer.
 */
export interface QueueConfig {
  /** Maximum queue size (default: 1000) */
  maxSize?: number;
  /** Drop policy when queue is full */
  dropPolicy?: 'drop-newest' | 'drop-oldest' | 'drop-lowest-tier';
}

/**
 * Debug configuration.
 */
export interface DebugConfig {
  /** Pretty-print events to console */
  prettyPrint?: boolean;
  /** Show what was redacted */
  showRedactions?: boolean;
  /** Show sampling decisions */
  showSampling?: boolean;
  /** Show budget-dropped fields */
  showDroppedFields?: boolean;
}

/**
 * Limits configuration for event accumulation.
 */
export interface LimitsConfig {
  /** Maximum keys per event (default: 100) */
  maxKeys?: number;
  /** Maximum total size estimate in bytes (default: 65536) */
  maxTotalSize?: number;
  /** Maximum array length (default: 20) */
  maxArrayLength?: number;
  /** Maximum string length (default: 1000) */
  maxStringLength?: number;
}

/**
 * Main configuration for createFinale().
 */
export interface FinaleConfig {
  /** Field definitions with metadata */
  fields: FieldRegistry;
  /** Output sink adapter */
  sink: Sink;
  /** Optional schema adapter for runtime validation */
  schemaAdapter?: SchemaAdapter;
  /** Tail sampling policy */
  sampling?: SamplingPolicy;
  /** Default fields for all events */
  defaults?: Record<string, unknown>;
  /** Validation mode: 'strict' warns, 'soft' silently drops (default: 'soft') */
  validation?: 'strict' | 'soft';
  /** Scope mode: 'default' returns no-op, 'strict' throws (default: 'default') */
  scopeMode?: 'default' | 'strict';
  /** Queue configuration */
  queue?: QueueConfig;
  /** Debug configuration */
  debug?: DebugConfig;
  /** Limits configuration */
  limits?: LimitsConfig;
}

// =============================================================================
// Finale Engine Types
// =============================================================================

/**
 * Metrics snapshot for observability.
 */
export interface MetricsSnapshot {
  /** Events successfully emitted to sink */
  eventsEmitted: number;
  /** Events dropped (sampling + backpressure) */
  eventsDropped: number;
  /** Events specifically dropped by sampling */
  eventsSampledOut: number;
  /** Fields dropped due to budget */
  fieldsDropped: number;
  /** Redactions applied */
  redactionsApplied: number;
  /** Schema violations encountered */
  schemaViolations: number;
  /** Sink failures */
  sinkFailures: number;
  /** Queue drops due to backpressure */
  queueDrops: number;
}

/**
 * Metrics API exposed by the Finale engine.
 */
export interface Metrics {
  /** Events successfully emitted */
  readonly eventsEmitted: number;
  /** Events dropped */
  readonly eventsDropped: number;
  /** Events sampled out */
  readonly eventsSampledOut: number;
  /** Fields dropped */
  readonly fieldsDropped: number;
  /** Redactions applied */
  readonly redactionsApplied: number;
  /** Schema violations */
  readonly schemaViolations: number;
  /** Sink failures */
  readonly sinkFailures: number;
  /** Queue drops */
  readonly queueDrops: number;
  /** Get a snapshot for export */
  snapshot(): MetricsSnapshot;
}

/**
 * Drain options for graceful shutdown.
 */
export interface DrainOptions {
  /** Timeout in milliseconds */
  timeoutMs?: number;
}

/**
 * The Finale engine instance returned by createFinale().
 */
export interface Finale {
  /** Metrics for observability */
  readonly metrics: Metrics;
  /** Graceful shutdown - flush queued events */
  drain(options?: DrainOptions): Promise<void>;
}
