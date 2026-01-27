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
@finale/core          # Core library
@finale/sinks-pino    # Pino adapter
@finale/sinks-winston # Winston adapter (v2+)
@finale/test          # Testing utilities
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

### Success Criteria

- Teams stop sprinkling 200 tiny logs per request
- Debugging becomes "query the one event" rather than grep across shards
- Cost becomes controllable via tail sampling and verbosity tiers
- Field consistency becomes enforceable via TS registry and schema checks

---

## 4. Core Concepts

### Event (Wide Event)

A single, structured record representing "what happened" for a request in one service hop.

```typescript
// Conceptual event shape
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
  "error.message": "Card declined"
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

## 5. Architecture

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
│  - Field Registry (typed keys, namespaces)                  │
│  - Schema Versioning                                        │
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
│  - Sink Interface (emit → void | Promise)                   │
│  - Async Queue (bounded memory, drop policy)                │
│  - Built-in: pino, winston, console                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    [pino/winston/collector]
```

### A. Runtime Layer

**Responsibilities:**
- Create request scope at app edge (HTTP middleware, job processor)
- Provide "current scope" getter for deep code paths
- Handle scope propagation through async boundaries

**Modules:**

| Module | Description |
|--------|-------------|
| `ScopeManager` | Node: `AsyncLocalStorage`. Edge: explicit context passing |
| `LifecycleHooks` | `startScope()`: initialize with base fields. `endScope()`: finalize, sample, flush |

**Design Constraints:**
- Scopes must be nestable or resilient to nested async calls
- Scope creation must be cheap (no heavy allocations)

### B. Event Accumulation Layer

**Responsibilities:**
- Let any part of the request add context without immediately emitting
- Preserve consistent merge strategy
- Prevent runaway payload size

**Modules:**

| Module | Description |
|--------|-------------|
| `EventStore` | Merge semantics: last-write-wins for scalars, capped lists for arrays, counters for metrics |
| `Timers` | Start/stop named phases (not full tracing, just timings for the final event) |
| `ErrorCapture` | Normalize thrown values into structured fields; stack traces under policy control |

**Limits:**
- Max keys per event
- Max total size estimate
- Max list length per array field

### C. Governance Layer

**Responsibilities:**
- Make field naming and shapes consistent across codebase
- Make it hard to introduce junk fields, typos, or inconsistent casing

**Modules:**

| Module | Description |
|--------|-------------|
| `FieldRegistry` | Central declaration of allowed fields and their types |
| `SchemaVersioning` | Version stamps on events; deprecation support with dev/test warnings |
| `Validation` | Strict mode (throw/warn), Soft mode (drop invalid, increment counters) |

**Field Groups:**
- **Core**: Always present (service, env, route, status, duration, requestId)
- **Domain**: Business context (userId, orgId, plan, feature flags)
- **Diagnostics**: Timings, breadcrumbs, debug facts
- **Error**: Structured error fields

### D. Safety Layer

**Responsibilities:**
- Prevent leaking sensitive data
- Prevent cost explosions from high-cardinality chaos

**Modules:**

| Module | Description |
|--------|-------------|
| `RedactionEngine` | Rule-based per field: `allow`, `drop`, `hash`, `mask`, `bucket`. Pattern scanners as last resort |
| `CardinalityGuard` | Per-field rules: `user.id` allowed, raw URL query strings dropped/normalized |
| `BudgetEnforcer` | Hard cap on event size. Priority system: core fields always keep, optional drop first |

**Default Posture:** Safe by default, opt in to risky detail.

### E. Tail-Sampling Layer

**Responsibilities:**
- Decide whether to emit the event, and at what verbosity tier
- Make decisions after final knowledge (error, duration, VIP status)

**Sampling Outputs:**

| Decision | Description |
|----------|-------------|
| `DROP` | Do not emit |
| `KEEP_MINIMAL` | Emit core fields only |
| `KEEP_NORMAL` | Emit core + domain fields |
| `KEEP_DEBUG` | Emit everything including diagnostics |

**Policy Inputs:**
- Outcome (success/error)
- Duration (p95 threshold)
- User cohort (VIP)
- Feature flags
- Endpoint/operation
- Error class

**Rule Composition:**
1. Deterministic rules first (errors always keep, slow requests keep)
2. Probabilistic sampling second (successes at 1%)

### F. Sink Layer

**Responsibilities:**
- Convert final Event into a record and hand off to existing emitter
- Never block the hot path
- Never crash the app

**Sink Interface:**

```typescript
interface Sink {
  emit(record: FinalizedEvent, level: string): void | Promise<void>;
}
```

**Built-in Sinks:**
- `pinoSink`: Adapts to pino logger
- `winstonSink`: Adapts to winston (v2+)
- `consoleSink`: Pretty-print for dev/testing

**Failure Behavior:**
- Swallow failures with internal counters
- Configurable: fail-open (default) vs fail-closed (dev/test)

---

## 6. Public API Surface

### Engine Creation

```typescript
import { createFinale } from '@finale/core';

const finale = createFinale({
  // Required
  schema: FieldRegistry,      // Typed field definitions
  sink: Sink,                 // Output adapter

  // Optional
  pii: PIIPolicy,             // Redaction rules
  sampling: SamplingPolicy,   // Tail sampling policy
  defaults: Record<string, unknown>,  // Base fields for all events
  validation: 'strict' | 'soft',      // Default: 'soft' in prod
});
```

### Scope Access

```typescript
// Node runtime (AsyncLocalStorage)
import { getScope } from '@finale/core';
const scope = getScope();

// Edge/explicit runtime
import { withScope } from '@finale/core';
const result = await withScope(finale, async (scope) => {
  scope.event.add({ ... });
  return doWork();
});
```

### Event Methods

```typescript
// Add fields (can be called many times)
scope.event.add({
  'user.id': userId,
  'org.id': orgId,
  'feature.flags': ['beta-checkout'],
});

// Normalize and capture error
scope.event.error(err, {
  includeStack: process.env.NODE_ENV !== 'production'
});

// Add breadcrumb annotation
scope.event.annotate('payment_started');
scope.event.annotate('inventory_checked');

// Get namespaced view (auto-prefixes keys)
const dbEvent = scope.event.child('db');
dbEvent.add({ query_count: 3, duration_ms: 45 });
// Results in: 'db.query_count': 3, 'db.duration_ms': 45

// Manual flush (usually handled by middleware)
scope.event.flush({ outcome: 'success' });
```

### Timers

```typescript
scope.timers.start('payment.authorize');
// ... do work ...
scope.timers.end('payment.authorize');
// Adds 'timings.payment.authorize': <duration_ms> to event
```

### HTTP Middleware

```typescript
import { httpMiddleware } from '@finale/core';

app.use(httpMiddleware(finale, {
  // Called at request start
  onRequest(scope, req) {
    scope.event.add({
      'http.route': req.path,
      'http.method': req.method,
    });
  },

  // Called before flush
  onResponse(scope, req, res) {
    scope.event.add({
      'http.status_code': res.statusCode,
    });
  },
}));
```

### Schema Definition

```typescript
import { z } from 'zod';

const schema = {
  // Core (always present)
  'service.name': z.string(),
  'deployment.env': z.enum(['dev', 'staging', 'prod']),
  'request.id': z.string(),

  // HTTP
  'http.route': z.string(),
  'http.method': z.string(),
  'http.status_code': z.number().int(),
  'http.duration_ms': z.number(),

  // Domain
  'user.id': z.string().optional(),
  'org.id': z.string().optional(),
  'feature.flags': z.array(z.string()).optional(),

  // Error
  'error.class': z.string().optional(),
  'error.message': z.string().optional(),
};
```

### PII Policy

```typescript
const piiPolicy = {
  // Patterns to always block
  denyPatterns: [
    /authorization/i,
    /password/i,
    /token/i,
    /cookie/i,
  ],

  // Per-field rules
  fieldRules: {
    'user.id': { mode: 'allow' },
    'user.email': { mode: 'drop' },
    'payment.card_last4': { mode: 'allow' },
    'payment.idempotency_key': { mode: 'hash' },
  },
};
```

### Sampling Policy

```typescript
const samplingPolicy = {
  decide(event: FinalizedEvent): SamplingDecision {
    // Always keep errors
    if (event['error.class']) {
      return { decision: 'KEEP_DEBUG', reason: 'error' };
    }

    // Keep slow requests
    if (event['http.duration_ms'] >= 1500) {
      return { decision: 'KEEP_NORMAL', reason: 'slow' };
    }

    // Keep VIP traffic
    if (event['user.is_vip']) {
      return { decision: 'KEEP_NORMAL', reason: 'vip' };
    }

    // Sample successes at 1%
    return Math.random() < 0.01
      ? { decision: 'KEEP_MINIMAL', reason: 'sampled' }
      : { decision: 'DROP', reason: 'sampled_out' };
  },

  // Map decisions to field groups
  tiers: {
    KEEP_MINIMAL: { include: ['core', 'http', 'correlation'] },
    KEEP_NORMAL: { include: ['core', 'http', 'correlation', 'domain'] },
    KEEP_DEBUG: { include: ['core', 'http', 'correlation', 'domain', 'error', 'diagnostics'] },
  },
};
```

---

## 7. Integration Points

### HTTP Frameworks

| Framework | Support |
|-----------|---------|
| Express | v1 (first-class) |
| Fastify | v1 (adapter) |
| Nest.js | v2 |
| Next.js API Routes | v1 (Node runtime) |
| Next.js Edge | v2 (explicit scoping) |

### Background Jobs

```typescript
import { withJobScope } from '@finale/core';

// BullMQ example
worker.process(async (job) => {
  return withJobScope(finale, job, async (scope) => {
    scope.event.add({
      'job.name': job.name,
      'job.id': job.id,
      'job.attempt': job.attemptsMade,
    });

    // ... process job ...
  });
});
```

### Manual Scope

```typescript
import { withScope } from '@finale/core';

// CLI tool, library, custom entry point
async function processFile(path: string) {
  return withScope(finale, async (scope) => {
    scope.event.add({
      'operation': 'file_process',
      'file.path': path,
    });

    // ... do work ...

    scope.event.flush({ outcome: 'success' });
  });
}
```

---

## 8. Developer Experience

### Validation Modes

| Mode | Behavior | Use Case |
|------|----------|----------|
| `strict` | Throw/warn on unknown keys or wrong types | Development, CI |
| `soft` | Drop invalid fields, increment counters | Production |

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
import { createTestSink, assertFields, assertNoField } from '@finale/test';

describe('checkout handler', () => {
  it('captures payment fields', async () => {
    const sink = createTestSink();
    const finale = createFinale({ ..., sink });

    await request(app).post('/api/checkout').send({ ... });

    const event = sink.lastEvent();
    assertFields(event, {
      'http.route': '/api/checkout',
      'payment.provider': 'stripe',
    });
    assertNoField(event, 'user.email'); // PII check
  });
});
```

### Internal Metrics

finale exposes counters for operational visibility:

```typescript
finale.metrics.fieldsDropped      // Budget enforcement
finale.metrics.redactionsApplied  // PII redactions
finale.metrics.schemaViolations   // Invalid field attempts
finale.metrics.samplingDecisions  // { DROP: n, KEEP_*: n }
finale.metrics.sinkFailures       // Emission failures
```

---

## 9. Complete Usage Example

```typescript
import express from 'express';
import pino from 'pino';
import { z } from 'zod';
import { createFinale, httpMiddleware, getScope } from '@finale/core';
import { pinoSink } from '@finale/sinks-pino';

// 1. Define schema
const schema = {
  'service.name': z.string(),
  'deployment.env': z.enum(['dev', 'staging', 'prod']),
  'request.id': z.string(),
  'trace.id': z.string().optional(),
  'http.route': z.string(),
  'http.method': z.string(),
  'http.status_code': z.number().int(),
  'http.duration_ms': z.number(),
  'user.id': z.string().optional(),
  'user.is_vip': z.boolean().optional(),
  'org.id': z.string().optional(),
  'checkout.cart_value_cents': z.number().int().optional(),
  'feature.flags': z.array(z.string()).optional(),
  'payment.provider': z.enum(['stripe', 'adyen']).optional(),
  'payment.idempotency_key': z.string().optional(),
  'payment.charge_id': z.string().optional(),
  'error.class': z.string().optional(),
  'error.message': z.string().optional(),
};

// 2. Define policies
const piiPolicy = {
  denyPatterns: [/authorization/i, /password/i, /token/i],
  fieldRules: {
    'user.id': { mode: 'allow' },
    'payment.idempotency_key': { mode: 'hash' },
  },
};

const samplingPolicy = {
  decide(event) {
    if (event['error.class']) return { decision: 'KEEP_DEBUG' };
    if (event['http.duration_ms'] >= 1500) return { decision: 'KEEP_NORMAL' };
    if (event['user.is_vip']) return { decision: 'KEEP_NORMAL' };
    return Math.random() < 0.01
      ? { decision: 'KEEP_MINIMAL' }
      : { decision: 'DROP' };
  },
};

// 3. Create engine
const logger = pino({ level: 'info' });

const finale = createFinale({
  schema,
  pii: piiPolicy,
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

app.use(httpMiddleware(finale, {
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

  // Add business context as it becomes known
  scope.event.add({
    'user.id': req.body.userId,
    'org.id': req.body.orgId,
    'checkout.cart_value_cents': req.body.cartValueCents,
    'feature.flags': req.body.featureFlags ?? [],
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
    scope.event.add({ 'payment.provider': 'stripe' });
    res.status(500).json({ ok: false });
  }

  // No manual logging - middleware flushes ONE event automatically
});

app.listen(3000);
```

**Output (if sampled KEEP_NORMAL):**

```json
{
  "service.name": "web-api",
  "deployment.env": "prod",
  "request.id": "req_abc123",
  "http.route": "/api/checkout",
  "http.method": "POST",
  "http.status_code": 200,
  "http.duration_ms": 412,
  "user.id": "usr_123",
  "user.is_vip": true,
  "org.id": "org_9",
  "checkout.cart_value_cents": 2599,
  "feature.flags": ["new-checkout"],
  "payment.provider": "stripe",
  "payment.idempotency_key": "hash:a1b2c3...",
  "payment.charge_id": "ch_xyz789",
  "timings.payment.authorize": 153,
  "timings.total": 412
}
```

---

## 10. Minimum Lovable V1

### Include in V1

| Feature | Description |
|---------|-------------|
| Event API | `add()`, `flush()`, `error()`, `annotate()`, `child()` |
| Timers | `start()`, `end()` for phase timings |
| Node Scoping | AsyncLocalStorage-based `getScope()` |
| HTTP Middleware | Express adapter with auto-flush |
| Schema Registry | Typed fields with Zod integration |
| Validation | Strict/soft modes |
| PII Rules | Field-level allow/drop/hash |
| Basic Budgets | Max keys, max size enforcement |
| Tail Sampling | DROP/MINIMAL/NORMAL/DEBUG tiers |
| Pino Sink | First-class adapter |
| Console Sink | Dev/debug output |
| Test Sink | In-memory capture + assertions |
| Debug Mode | Sampling/redaction visibility |

### Defer to V2+

| Feature | Rationale |
|---------|-----------|
| Edge runtime scoping | Requires explicit context passing design |
| Winston sink | Lower priority than pino |
| OTel log export | JS logs API still unstable |
| Lint rules | Nice-to-have after core stabilizes |
| Docs generation | Post-adoption feature |
| GraphQL integration | After HTTP proves out |
| Partial flush | Rare use case, adds complexity |

---

## 11. Open Questions

1. **Package naming**: Is `@finale/core` available on npm?
2. **Zod dependency**: Should schema validation be Zod-native or bring-your-own-validator?
3. **Sink batching**: Should the core library handle async batching or leave to sink implementations?
4. **Metrics export**: Should internal counters be exportable to Prometheus/OTel metrics?

---

## 12. References

- [loggingsucks.com](https://loggingsucks.com) - Inspiration for the wide events pattern
- [Stripe Canonical Log Lines](https://stripe.com/blog/canonical-log-lines) - Production implementation
- [Honeycomb Wide Events](https://www.honeycomb.io/blog/structured-events-better-than-logs) - Conceptual foundation
- [AsyncLocalStorage](https://nodejs.org/api/async_context.html) - Node.js context propagation
