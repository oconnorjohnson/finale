# finale

**Wide-event instrumentation layer for TypeScript**

---

## 1. Executive Summary

**finale** is a TypeScript library that makes wide events (canonical log lines) the default ergonomic path for backend observability.

### Value Proposition

Stop spraying 200 thin logs. Build one event that answers: who, what, where, why, how long, did it fail, and what mattered.

### Positioning

finale is **not a logger**. It is an instrumentation layer that:
- Accumulates context throughout a request lifecycle
- Applies schema governance, PII safety, and tail sampling
- Outputs one enriched event per request to your existing logger (pino, winston, etc.)

### Package Structure

```
@finalejs/core           # Core library (no validation runtime)
@finalejs/schema-zod     # Zod schema adapter
@finalejs/sink-pino      # Pino adapter
@finalejs/sink-console   # Dev/debug pretty-print
@finalejs/test           # Testing utilities
```

---

## 2. Problem Statement

### The Current State of Logging

Modern logging is optimized for **writing**, not **querying**:

- **Too many thin logs**: Services emit hundreds of context-poor lines per request
- **Grep archaeology**: Debugging means string-searching across distributed services
- **Schema chaos**: Field names drift (`user_id` vs `userId` vs `usr_id`)
- **PII leaks**: No systematic guardrails; sensitive data ends up in logs
- **Cost explosions**: High-cardinality, high-volume logs blow up storage bills
- **Context fragmentation**: Correlation requires stitching request IDs across shards

### Why Existing Solutions Fall Short

| Solution | Limitation |
|----------|------------|
| **pino/winston** | Optimize for throughput and ergonomics of emitting lines, not queryability |
| **OpenTelemetry** | Standardizes collection/export but doesn't decide what business context to capture |
| **Structured logging** | Exists everywhere but teams still emit many small logs, not one event per request |

### The Opportunity

Wide events / canonical log lines are a known pattern (Stripe, Honeycomb, etc.) but implementation is not a universal default. There's a gap for a TS library that makes this pattern effortless, typed, and safe.

---

## 3. Goals & Non-Goals

### Goals

1. **Wide events as default**: One enriched event per request per service hop
2. **TypeScript-native governance**: Typed schema registry prevents field chaos
3. **Safe by default**: PII redaction, cardinality guards, budget enforcement
4. **Tail sampling**: Decide what to keep after knowing outcome/duration/error
5. **Adapter pattern**: Plug into existing loggers, don't replace them
6. **Developer ergonomics**: Simple API (`.add()` + `.flush()`)

### Non-Goals

1. **Choosing business context**: The library cannot infer what domain fields matter to your org
2. **Solving storage economics**: Wide events shine with columnar backends (ClickHouse, BigQuery); the library can't pay your bill
3. **Forcing organizational discipline**: Schema stewardship and PII hygiene require human commitment
4. **Replacing loggers**: finale outputs to your logger, not stdout directly
5. **Being a durable queue**: finale is not a message broker; durability comes from your sink/agent

### Success Criteria

- Teams stop sprinkling 200 tiny logs per request
- Debugging becomes "query the one event" rather than grep across shards
- Cost becomes controllable via tail sampling and verbosity tiers
- Field consistency becomes enforceable via TS registry and schema checks

---

## 4. Operational Contract

This section defines what finale guarantees and what it does not. Teams must understand this to trust it in production.

### Emission Guarantees

| Guarantee | Level |
|-----------|-------|
| **Delivery** | Best-effort. If the process crashes, queued events may be lost. |
| **Ordering** | Not guaranteed across requests. Within a request, one event. |
| **Exactly-once** | No. Duplicates possible if sink retries succeed after timeout. |

**The posture**: finale is non-blocking and fast. Durability is the sink's job (stdout + agent, or local collector).

### When Does Finale Drop Events?

| Condition | Behavior |
|-----------|----------|
| **Sampling decision = DROP** | Intentional. Event never reaches sink. |
| **Queue full (backpressure)** | Drops according to policy (see below). |
| **Sink failure** | Swallows error, increments counter, does not retry by default. |
| **Process crash** | In-flight queue is lost. |

### Backpressure / Drop Policy

When the internal queue is full:

| Policy | Behavior |
|--------|----------|
| `drop-newest` | New events are dropped. Protects older (potentially more interesting) events. |
| `drop-oldest` | Old events are dropped. Keeps the queue fresh. |
| `drop-lowest-tier` | DROP < KEEP_MINIMAL < KEEP_NORMAL < KEEP_DEBUG. Prefer keeping important events. |

**Default**: `drop-lowest-tier` with fallback to `drop-newest`.

### Drain on Shutdown

```typescript
// Graceful shutdown hook
await finale.drain({ timeoutMs: 5000 });
```

- Attempts to flush queued events before process exit.
- In serverless (Lambda, Vercel), you may not get time to drain. Use stdout sink + external agent for durability.
- After timeout, remaining events are lost.

### Retry Policy

**Default**: No retries for sink failures. Rationale:
- Retries add latency and complexity.
- If you need durability, use a local collector (vector, fluent-bit, OTel Collector) that handles retries.

**Optional**: Sinks can implement their own retry logic internally.

### Observing Drops and Failures

```typescript
finale.metrics.eventsEmitted      // Successfully handed to sink
finale.metrics.eventsDropped      // Intentional (sampling) + backpressure
finale.metrics.eventsSampledOut   // Specifically sampling DROP
finale.metrics.sinkFailures       // Sink threw/rejected
finale.metrics.queueDrops         // Backpressure drops
```

### Recommended Production Setup

| Setup | Durability | Latency | Complexity |
|-------|------------|---------|------------|
| **stdout + agent** (recommended) | High (agent handles retries) | Low | Low |
| **Local collector** (vector, OTel) | High | Low | Medium |
| **Direct HTTP sink** | Medium (no retry by default) | Higher | Low |

---

## 5. Event Semantics

### What "One Event Per Request" Means

finale emits **one primary event per request per service hop**. This is the core contract.

| Scenario | Behavior |
|----------|----------|
| **Normal HTTP request** | One event, flushed after response ends. |
| **Streaming response** | One event, flushed after stream closes. Timings reflect total duration. |
| **Fan-out (request triggers N internal calls)** | Still one event. Internal calls can add fields, but don't create child events. |
| **Background job** | One event per job execution (not per retry). |
| **Nested async operations** | All contribute to the same event via shared scope. |

### What About Sub-Events?

**V1**: No sub-events. Timers capture phase durations within the primary event.

**Future consideration**: Optional `emitMilestone()` for rare cases (e.g., long-running jobs that want intermediate checkpoints). Deferred to v2+.

### Timers Are Not Traces

Timers record phase durations inside the single event. They are not distributed traces.

```typescript
scope.timers.start('db.query');
// ... query ...
scope.timers.end('db.query');
// Results in: "timings.db.query": 45 (ms)
```

If you need distributed tracing, use OpenTelemetry traces alongside finale events. finale can include `trace.id` and `span.id` for correlation.

---

## 6. Core Concepts

### Event (Wide Event)

A single, structured record representing "what happened" for a request in one service hop.

```typescript
{
  // Identity
  "service.name": "web-api",
  "deployment.env": "prod",

  // Correlation
  "request.id": "req_abc123",
  "trace.id": "...",

  // HTTP
  "http.route": "/api/checkout",
  "http.method": "POST",
  "http.status_code": 200,
  "http.duration_ms": 412,

  // Domain context
  "user.id": "usr_123",
  "org.id": "org_9",
  "checkout.cart_value_cents": 2599,
  "feature.flags": ["new-checkout"],

  // Timings
  "timings.payment.authorize": 153,
  "timings.total": 412,

  // Error (if applicable)
  "error.class": "PaymentDeclined",
  "error.message": "Card declined",

  // Metadata
  "_finale.schema_version": "1.2",
  "_finale.sampling_decision": "KEEP_NORMAL",
  "_finale.sampling_reason": "slow"
}
```

### Scope

A per-request container that:
- Stores the current Event
- Provides a safe API for adding fields
- Tracks timing phases
- Ensures one flush at end

### Policy

A pluggable decision system controlling:
- **Tail sampling**: Keep/drop/verbosity decisions
- **Redaction**: PII/secrets handling
- **Cardinality**: Field allowlists and limits
- **Budget**: Payload size constraints

### Sink

An async adapter that receives finalized events and hands them to an existing emitter (pino, winston, collector, etc.).

---

## 7. Architecture

finale uses a 6-layer architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                     Application Code                        │
│                  scope.event.add({ ... })                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  A. Runtime Layer                                           │
│  - ScopeManager (AsyncLocalStorage / explicit passing)      │
│  - LifecycleHooks (startScope, endScope)                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  B. Event Accumulation Layer                                │
│  - EventStore (merge semantics, limits)                     │
│  - Timers (phase timings)                                   │
│  - ErrorCapture (structured normalization)                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  C. Governance Layer                                        │
│  - Field Registry (typed keys, namespaces, metadata)        │
│  - Schema Adapter Interface                                 │
│  - Validation (strict/soft modes)                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  D. Safety Layer                                            │
│  - Redaction Engine (field rules, pattern scanners)         │
│  - Cardinality Guard (per-field rules)                      │
│  - Budget Enforcer (size limits, priority drops)            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  E. Tail-Sampling Layer                                     │
│  - Sampling Policy Engine                                   │
│  - Verbosity Tiers (DROP/MINIMAL/NORMAL/DEBUG)              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  F. Sink Layer                                              │
│  - Sink Interface                                           │
│  - Async Queue (bounded, drop policy, drain)                │
│  - Built-in: pino, console                                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    [pino/stdout/collector]
```

### A. Runtime Layer

**Responsibilities:**
- Create request scope at app edge (HTTP middleware, job processor)
- Provide "current scope" getter for deep code paths
- Handle scope propagation through async boundaries

**Scope Propagation Failure Mode:**

When `getScope()` is called outside an active scope (no AsyncLocalStorage context):

| Mode | Behavior |
|------|----------|
| **Default** | Returns a **no-op scope**. Calls to `.add()` do nothing. No crash. |
| **Development** | Returns no-op scope + emits a warning (once per call site). |
| **Strict** | Throws `ScopeNotFoundError`. Opt-in for catching bugs early. |

```typescript
const scope = getScope(); // Never crashes in default mode
scope.event.add({ ... }); // Silently ignored if no active scope
```

**Nesting Behavior:**

Scopes are **stackable**. Creating a scope inside another scope pushes onto a stack.

| Operation | Behavior |
|-----------|----------|
| `getScope()` | Returns the **top of stack** (innermost active scope). |
| Nested `withScope()` | Creates a new scope; inner code sees the new scope. |
| Scope exit | Pops from stack; outer scope becomes active again. |

This prevents weirdness when libraries internally create scopes.

### B. Event Accumulation Layer

**Responsibilities:**
- Let any part of the request add context without immediately emitting
- Preserve consistent merge strategy
- Prevent runaway payload size

**Merge Semantics:**

| Type | Behavior |
|------|----------|
| Scalar | Last-write-wins |
| Array | Append, capped at max length |
| Counter | Increment (for fields declared as counters) |

**Limits:**

| Limit | Default | Configurable |
|-------|---------|--------------|
| Max keys per event | 100 | Yes |
| Max total size estimate | 64KB | Yes |
| Max array length | 20 | Yes |
| Max string length | 1000 | Yes |

### C. Governance Layer

**Responsibilities:**
- Make field naming and shapes consistent across codebase
- Make it hard to introduce junk fields, typos, or inconsistent casing

**Field Registry with Metadata:**

Each field declaration includes:

```typescript
interface FieldDefinition {
  // Type validation (via schema adapter)
  type: SchemaType;

  // Metadata for policies
  group: 'core' | 'domain' | 'diagnostics' | 'error';
  sensitivity: 'safe' | 'pii' | 'secret';
  cardinality: 'low' | 'medium' | 'high' | 'unbounded';
  priority: 'must-keep' | 'important' | 'optional' | 'drop-first';

  // Transformation rule (used by safety layer)
  transform?: 'allow' | 'hash' | 'mask' | 'bucket' | 'drop';
}
```

**Example Registry:**

```typescript
const fields = defineFields({
  'service.name': {
    type: schema.string(),
    group: 'core',
    sensitivity: 'safe',
    cardinality: 'low',
    priority: 'must-keep',
  },
  'user.id': {
    type: schema.string().optional(),
    group: 'domain',
    sensitivity: 'pii',
    cardinality: 'high',
    priority: 'important',
    transform: 'allow', // Org decision: user IDs are okay to log
  },
  'user.email': {
    type: schema.string().optional(),
    group: 'domain',
    sensitivity: 'pii',
    cardinality: 'high',
    priority: 'optional',
    transform: 'drop', // Never log emails
  },
  'http.request_body': {
    type: schema.string().optional(),
    group: 'diagnostics',
    sensitivity: 'secret',
    cardinality: 'unbounded',
    priority: 'drop-first',
    transform: 'drop', // Dangerous, never log
  },
});
```

**Schema Adapter Interface:**

Core does not depend on Zod. Instead, it defines a minimal adapter interface:

```typescript
interface SchemaAdapter<T> {
  // Validate a value, return parsed or throw
  parse(value: unknown): T;

  // Safe validate, return result object
  safeParse(value: unknown): { success: true; data: T } | { success: false; error: Error };

  // Check if optional
  isOptional(): boolean;
}
```

**Provided Adapters:**

| Package | Description |
|---------|-------------|
| `@finalejs/schema-zod` | Wraps Zod schemas |
| `@finalejs/schema-typebox` | Wraps TypeBox (future) |
| `@finalejs/schema-none` | Types-only, no runtime validation |

### D. Safety Layer

**Responsibilities:**
- Prevent leaking sensitive data
- Prevent cost explosions from high-cardinality chaos

**Redaction Engine:**

Uses field metadata `sensitivity` and `transform` to apply rules:

| Transform | Effect |
|-----------|--------|
| `allow` | Pass through unchanged |
| `hash` | SHA-256 hash, prefixed with `hash:` |
| `mask` | Replace with `[REDACTED]` |
| `bucket` | Normalize into buckets (e.g., numeric ranges) |
| `drop` | Remove field entirely |

**Pattern Scanner (Last Resort):**

Scans string values for likely secrets:

```typescript
const defaultPatterns = [
  /Bearer\s+[A-Za-z0-9\-._~+\/]+=*/i,  // Bearer tokens
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z]{2,}/i,  // Emails
  /password/i,  // Password mentions
];
```

Matched values are redacted. Pattern scanning is configurable and can be disabled.

**Budget Enforcer:**

When event exceeds limits, fields are dropped by priority:

1. `drop-first` fields dropped first
2. Then `optional`
3. Then `important`
4. `must-keep` fields are never dropped

Dropped fields are recorded:

```typescript
{
  "_finale.dropped_fields": ["user.preferences", "http.headers"],
  "_finale.drop_reason": "budget_exceeded"
}
```

### E. Tail-Sampling Layer

**Responsibilities:**
- Decide whether to emit the event, and at what verbosity tier
- Make decisions after final knowledge (error, duration, VIP status)

**Sampling Outputs:**

| Decision | Description | Fields Included |
|----------|-------------|-----------------|
| `DROP` | Do not emit | None |
| `KEEP_MINIMAL` | Bare essentials | `core` |
| `KEEP_NORMAL` | Standard production | `core` + `domain` |
| `KEEP_DEBUG` | Full detail | All groups |

**Policy Interface:**

```typescript
interface SamplingPolicy {
  decide(event: FinalizedEvent): SamplingDecision;
}

interface SamplingDecision {
  decision: 'DROP' | 'KEEP_MINIMAL' | 'KEEP_NORMAL' | 'KEEP_DEBUG';
  reason?: string; // For debugging/auditing
}
```

### F. Sink Layer

**Responsibilities:**
- Convert final Event into a record and hand off to existing emitter
- Never block the hot path
- Never crash the app

**Sink Interface:**

```typescript
interface Sink {
  emit(record: FinalizedEvent): void | Promise<void>;

  // Optional: called on graceful shutdown
  drain?(): Promise<void>;
}
```

**Queue Semantics:**

| Property | Default | Notes |
|----------|---------|-------|
| Max queue size | 1000 events | Configurable |
| Drop policy | `drop-lowest-tier` | See backpressure section |
| Async | Yes | `emit()` returns immediately |

---

## 8. Public API Surface

### Engine Creation

```typescript
import { createFinale } from '@finalejs/core';
import { zodAdapter } from '@finalejs/schema-zod';
import { pinoSink } from '@finalejs/sink-pino';

const finale = createFinale({
  // Required
  fields: FieldRegistry,      // Field definitions with metadata
  sink: Sink,                 // Output adapter

  // Optional
  schemaAdapter: zodAdapter,  // Runtime validation (default: none)
  sampling: SamplingPolicy,   // Tail sampling policy
  defaults: { ... },          // Base fields for all events

  // Behavior
  validation: 'strict' | 'soft',  // Default: 'soft'
  scopeMode: 'default' | 'strict', // Default: 'default' (no-op on missing scope)

  // Queue
  queue: {
    maxSize: 1000,
    dropPolicy: 'drop-lowest-tier',
  },
});
```

### Scope Access

```typescript
// Node runtime (AsyncLocalStorage)
import { getScope } from '@finalejs/core';
const scope = getScope(); // Returns no-op scope if none active (default mode)

// Check if scope is active
import { hasScope } from '@finalejs/core';
if (hasScope()) {
  getScope().event.add({ ... });
}

// Explicit scope creation
import { withScope } from '@finalejs/core';
const result = await withScope(finale, async (scope) => {
  scope.event.add({ ... });
  return doWork();
});
```

### Event Methods

```typescript
// Core: add fields (can be called many times)
scope.event.add({
  'user.id': userId,
  'org.id': orgId,
});

// Namespaced add (auto-prefixes keys)
const http = scope.event.child('http');
http.add({ route: '/api/checkout', method: 'POST' });
// Results in: 'http.route', 'http.method'

// Convenience: add to specific group (helps sampling tier decisions)
scope.event.addDomain({ 'user.id': userId });
scope.event.addDiagnostics({ 'cache.hit': true });

// Normalize and capture error
scope.event.error(err, {
  includeStack: process.env.NODE_ENV !== 'production',
});

// Add breadcrumb annotation (capped list)
scope.event.annotate('payment_started');
scope.event.annotate('inventory_checked');

// Manual flush (usually handled by middleware)
const receipt = scope.event.flush();
```

### Flush Receipt

`flush()` returns a receipt for debugging/testing:

```typescript
interface FlushReceipt {
  emitted: boolean;          // Was event sent to sink?
  decision: SamplingDecision; // DROP, KEEP_*, reason
  fieldsDropped: string[];   // Budget-dropped fields
  fieldsRedacted: string[];  // Redacted fields
  finalSize: number;         // Approximate bytes
}

// In tests:
const receipt = scope.event.flush();
expect(receipt.emitted).toBe(true);
expect(receipt.decision.decision).toBe('KEEP_NORMAL');
```

### Timers

```typescript
scope.timers.start('payment.authorize');
// ... do work ...
scope.timers.end('payment.authorize');
// Adds 'timings.payment.authorize': <duration_ms> to event

// Convenience: wrap async work
const result = await scope.timers.measure('db.query', async () => {
  return db.query(...);
});
```

### HTTP Middleware

```typescript
import { expressMiddleware } from '@finalejs/core';

app.use(expressMiddleware(finale, {
  // Called at request start
  onRequest(scope, req) {
    scope.event.add({
      'http.route': req.path,
      'http.method': req.method,
      'request.id': req.headers['x-request-id'] || crypto.randomUUID(),
    });
  },

  // Called before flush
  onResponse(scope, req, res) {
    scope.event.add({
      'http.status_code': res.statusCode,
    });
  },

  // Optional: extract trace context
  extractTraceContext(req) {
    return {
      traceId: req.headers['x-trace-id'],
      spanId: req.headers['x-span-id'],
    };
  },
}));
```

### Field Definition with Schema Adapter

```typescript
import { defineFields } from '@finalejs/core';
import { z } from 'zod';
import { zodAdapter, zodType } from '@finalejs/schema-zod';

const fields = defineFields({
  'service.name': {
    type: zodType(z.string()),
    group: 'core',
    sensitivity: 'safe',
    cardinality: 'low',
    priority: 'must-keep',
  },
  'user.id': {
    type: zodType(z.string().optional()),
    group: 'domain',
    sensitivity: 'pii',
    cardinality: 'high',
    priority: 'important',
    transform: 'allow',
  },
  // ... more fields
});

const finale = createFinale({
  fields,
  schemaAdapter: zodAdapter,
  sink: pinoSink(pino()),
});
```

### Typed Namespaces (Optional Ergonomics)

For teams that want autocomplete without string keys:

```typescript
// Generated or manually created from field registry
const http = finale.namespace('http');
const user = finale.namespace('user');

// Usage
scope.event.add(http.fields({
  route: '/api/checkout',
  method: 'POST',
  statusCode: 200,
}));
// Results in: 'http.route', 'http.method', 'http.status_code'
```

---

## 9. Integration Points

### V1 Golden Path

**Primary target**: Node.js backend with Express or Next.js API routes.

| Component | V1 Support |
|-----------|------------|
| Express middleware | First-class |
| Next.js API routes (Node) | First-class |
| Pino sink | First-class |
| Console sink | First-class |
| AsyncLocalStorage scoping | First-class |

### Background Jobs

```typescript
import { withJobScope } from '@finalejs/core';

// BullMQ example
worker.process(async (job) => {
  return withJobScope(finale, {
    jobName: job.name,
    jobId: job.id,
    attempt: job.attemptsMade,
  }, async (scope) => {
    scope.event.add({ 'job.queue': 'checkout' });
    // ... process job ...
  });
});
```

### Manual Scope

```typescript
import { withScope } from '@finalejs/core';

// CLI tool, library, custom entry point
async function processFile(path: string) {
  return withScope(finale, async (scope) => {
    scope.event.add({
      'operation': 'file_process',
      'file.path': path,
    });
    // ... do work ...
  }); // Auto-flushes on scope exit
}
```

---

## 10. Developer Experience

### Validation Modes

| Mode | Behavior | Use Case |
|------|----------|----------|
| `strict` | Warn on unknown keys, wrong types | Development, CI |
| `soft` | Drop invalid fields, increment counters | Production |

Note: In `strict` mode, warnings are logged but don't throw (unless `scopeMode: 'strict'` for scope errors).

### Debug Mode

```typescript
const finale = createFinale({
  // ...
  debug: {
    prettyPrint: true,        // Colorized event output
    showRedactions: true,     // Log what was redacted
    showSampling: true,       // Log sampling decisions
    showDroppedFields: true,  // Log budget-dropped fields
  },
});
```

### Testing Utilities

```typescript
import { createTestSink, assertFields, assertNoField } from '@finalejs/test';

describe('checkout handler', () => {
  it('captures payment fields', async () => {
    const sink = createTestSink();
    const finale = createFinale({ fields, sink });

    await request(app).post('/api/checkout').send({ ... });

    const event = sink.lastEvent();
    assertFields(event, {
      'http.route': '/api/checkout',
      'payment.provider': 'stripe',
    });
    assertNoField(event, 'user.email'); // PII check

    // Check sampling decision
    const receipt = sink.lastReceipt();
    expect(receipt.decision.decision).toBe('KEEP_NORMAL');
  });
});
```

### Internal Metrics

```typescript
finale.metrics.eventsEmitted      // Successfully handed to sink
finale.metrics.eventsDropped      // Sampling DROP + backpressure
finale.metrics.eventsSampledOut   // Specifically sampling DROP
finale.metrics.fieldsDropped      // Budget enforcement
finale.metrics.redactionsApplied  // PII redactions
finale.metrics.schemaViolations   // Invalid field attempts
finale.metrics.sinkFailures       // Emission failures
finale.metrics.queueDrops         // Backpressure drops

// Snapshot for export to Prometheus/OTel
const snapshot = finale.metrics.snapshot();
```

---

## 11. Complete Usage Example

```typescript
import express from 'express';
import pino from 'pino';
import { z } from 'zod';
import { createFinale, expressMiddleware, getScope, defineFields } from '@finalejs/core';
import { zodAdapter, zodType } from '@finalejs/schema-zod';
import { pinoSink } from '@finalejs/sink-pino';

// 1. Define fields with metadata
const fields = defineFields({
  // Core (always present)
  'service.name': {
    type: zodType(z.string()),
    group: 'core',
    sensitivity: 'safe',
    cardinality: 'low',
    priority: 'must-keep',
  },
  'deployment.env': {
    type: zodType(z.enum(['dev', 'staging', 'prod'])),
    group: 'core',
    sensitivity: 'safe',
    cardinality: 'low',
    priority: 'must-keep',
  },
  'request.id': {
    type: zodType(z.string()),
    group: 'core',
    sensitivity: 'safe',
    cardinality: 'high',
    priority: 'must-keep',
  },

  // HTTP
  'http.route': {
    type: zodType(z.string()),
    group: 'core',
    sensitivity: 'safe',
    cardinality: 'low', // Routes should be low cardinality
    priority: 'must-keep',
  },
  'http.method': {
    type: zodType(z.string()),
    group: 'core',
    sensitivity: 'safe',
    cardinality: 'low',
    priority: 'must-keep',
  },
  'http.status_code': {
    type: zodType(z.number().int()),
    group: 'core',
    sensitivity: 'safe',
    cardinality: 'low',
    priority: 'must-keep',
  },
  'http.duration_ms': {
    type: zodType(z.number()),
    group: 'core',
    sensitivity: 'safe',
    cardinality: 'medium',
    priority: 'must-keep',
  },

  // Domain
  'user.id': {
    type: zodType(z.string().optional()),
    group: 'domain',
    sensitivity: 'pii',
    cardinality: 'high',
    priority: 'important',
    transform: 'allow', // Org decision
  },
  'user.is_vip': {
    type: zodType(z.boolean().optional()),
    group: 'domain',
    sensitivity: 'safe',
    cardinality: 'low',
    priority: 'important',
  },
  'org.id': {
    type: zodType(z.string().optional()),
    group: 'domain',
    sensitivity: 'safe',
    cardinality: 'medium',
    priority: 'important',
  },
  'checkout.cart_value_cents': {
    type: zodType(z.number().int().optional()),
    group: 'domain',
    sensitivity: 'safe',
    cardinality: 'medium',
    priority: 'optional',
  },

  // Payment
  'payment.provider': {
    type: zodType(z.enum(['stripe', 'adyen']).optional()),
    group: 'domain',
    sensitivity: 'safe',
    cardinality: 'low',
    priority: 'important',
  },
  'payment.idempotency_key': {
    type: zodType(z.string().optional()),
    group: 'domain',
    sensitivity: 'pii',
    cardinality: 'high',
    priority: 'optional',
    transform: 'hash', // Reduce sensitivity
  },
  'payment.charge_id': {
    type: zodType(z.string().optional()),
    group: 'domain',
    sensitivity: 'safe',
    cardinality: 'high',
    priority: 'important',
  },

  // Error
  'error.class': {
    type: zodType(z.string().optional()),
    group: 'error',
    sensitivity: 'safe',
    cardinality: 'low',
    priority: 'must-keep',
  },
  'error.message': {
    type: zodType(z.string().optional()),
    group: 'error',
    sensitivity: 'pii', // Messages might contain PII
    cardinality: 'medium',
    priority: 'must-keep',
    transform: 'allow', // But we want to see them
  },
});

// 2. Define sampling policy
const samplingPolicy = {
  decide(event) {
    if (event['error.class']) {
      return { decision: 'KEEP_DEBUG', reason: 'error' };
    }
    if (event['http.duration_ms'] >= 1500) {
      return { decision: 'KEEP_NORMAL', reason: 'slow' };
    }
    if (event['user.is_vip']) {
      return { decision: 'KEEP_NORMAL', reason: 'vip' };
    }
    return Math.random() < 0.01
      ? { decision: 'KEEP_MINIMAL', reason: 'sampled' }
      : { decision: 'DROP', reason: 'sampled_out' };
  },
};

// 3. Create engine
const logger = pino({ level: 'info' });

const finale = createFinale({
  fields,
  schemaAdapter: zodAdapter,
  sampling: samplingPolicy,
  sink: pinoSink(logger),
  defaults: {
    'service.name': 'web-api',
    'deployment.env': process.env.NODE_ENV || 'dev',
  },
  validation: process.env.NODE_ENV === 'production' ? 'soft' : 'strict',
});

// 4. Setup Express
const app = express();
app.use(express.json());

app.use(expressMiddleware(finale, {
  onRequest(scope, req) {
    scope.event.add({
      'http.route': req.path,
      'http.method': req.method,
      'request.id': req.headers['x-request-id'] || crypto.randomUUID(),
    });
    scope.timers.start('total');
  },
  onResponse(scope, req, res) {
    scope.event.add({ 'http.status_code': res.statusCode });
    scope.timers.end('total');
  },
}));

// 5. Handler with domain context
app.post('/api/checkout', async (req, res) => {
  const scope = getScope();

  scope.event.add({
    'user.id': req.body.userId,
    'org.id': req.body.orgId,
    'checkout.cart_value_cents': req.body.cartValueCents,
    'user.is_vip': Boolean(req.body.isVip),
  });

  scope.timers.start('payment.authorize');

  try {
    const charge = await processPayment(req.body);
    scope.timers.end('payment.authorize');

    scope.event.add({
      'payment.provider': 'stripe',
      'payment.idempotency_key': req.body.idempotencyKey,
      'payment.charge_id': charge.id,
    });

    res.json({ ok: true, chargeId: charge.id });
  } catch (err) {
    scope.timers.end('payment.authorize');
    scope.event.error(err);
    res.status(500).json({ ok: false });
  }
  // Middleware auto-flushes ONE event
});

// 6. Graceful shutdown
process.on('SIGTERM', async () => {
  await finale.drain({ timeoutMs: 5000 });
  process.exit(0);
});

app.listen(3000);
```

---

## 12. Minimum Lovable V1

### V1 Golden Path

**Target**: Node.js + Express + pino + AsyncLocalStorage

| Feature | Status |
|---------|--------|
| `createFinale()` | V1 |
| `getScope()` / `hasScope()` / `withScope()` | V1 |
| `scope.event.add()` / `.child()` / `.error()` / `.annotate()` | V1 |
| `scope.timers.start()` / `.end()` / `.measure()` | V1 |
| `flush()` with receipt | V1 |
| Express middleware with auto-flush | V1 |
| Field registry with metadata | V1 |
| Schema adapter interface | V1 |
| `@finalejs/schema-zod` adapter | V1 |
| Validation strict/soft modes | V1 |
| Redaction engine (field rules) | V1 |
| Budget enforcer | V1 |
| Tail sampling (4 tiers) | V1 |
| `@finalejs/sink-pino` | V1 |
| `@finalejs/sink-console` | V1 |
| `@finalejs/test` (test sink + assertions) | V1 |
| Debug mode | V1 |
| Metrics counters | V1 |
| `drain()` for graceful shutdown | V1 |
| No-op scope on missing context | V1 |
| Stackable nested scopes | V1 |

### Defer to V2+

| Feature | Rationale |
|---------|-----------|
| Edge runtime explicit scoping | Requires different propagation model |
| Next.js Edge / Cloudflare Workers | After Node proves out |
| `@finalejs/sink-winston` | Lower priority than pino |
| OTel log export | JS logs API still unstable |
| Typed namespace codegen | Nice-to-have after adoption |
| Lint rules for field keys | Post-stabilization |
| Docs generation from registry | Post-adoption |
| GraphQL integration | After HTTP proves out |
| Partial/milestone flush | Complexity, rare use case |
| Direct HTTP sink with retries | Use local collector instead |

---

## 13. Open Questions (Resolved)

| Question | Decision |
|----------|----------|
| Package naming | Use `@finalejs/*` (check availability, have backup) |
| Zod dependency | **Decoupled**. Core has schema adapter interface. Zod is optional via `@finalejs/schema-zod`. |
| Sink batching | Core provides async queue + backpressure. Sinks are simple `emit()`. |
| Metrics export | Expose `.metrics.snapshot()` for integration with Prometheus/OTel. |
| Scope failure mode | **No-op by default** + optional strict mode. |
| Nesting | **Stackable** scopes. `getScope()` returns top of stack. |

---

## 14. References

- [loggingsucks.com](https://loggingsucks.com) - Inspiration for the wide events pattern
- [Stripe Canonical Log Lines](https://stripe.com/blog/canonical-log-lines) - Production implementation
- [Honeycomb Wide Events](https://www.honeycomb.io/blog/structured-events-better-than-logs) - Conceptual foundation
- [AsyncLocalStorage](https://nodejs.org/api/async_context.html) - Node.js context propagation
