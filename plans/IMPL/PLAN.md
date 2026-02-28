# Finale Implementation Plan

## Overview

Build the `finale` TypeScript library from zero source code to a functional V1. The library makes wide events (canonical log lines) the default ergonomic path for backend observability.

**Current State**: Design documentation exists (PLAN.md, NOTES.md), but no source code or infrastructure.

**Target**: 5-package monorepo delivering V1 for Node.js + Express + pino + AsyncLocalStorage, including embedded sub-events for long-running and LLM-style workflows.

---

## Phase 0: Infrastructure Setup

### Tooling Decisions

| Tool | Choice | Rationale |
|------|--------|-----------|
| Package Manager | pnpm | Fast installs, strict deps, excellent workspace support |
| Monorepo | pnpm workspaces + turborepo | Fast builds, incremental caching, modern standard |
| Build | tsup (esbuild) | Fast, zero-config for libraries, handles CJS+ESM dual output |
| Test | vitest | Fast, native ESM, Jest-compatible API, great TS support |
| Lint | ESLint + Prettier | Standard tooling |

### Tasks

1. Initialize pnpm workspace with `pnpm-workspace.yaml`
2. Configure turborepo (`turbo.json`) with build/test/lint pipelines
3. Root `tsconfig.json` with strict settings and composite project references
4. ESLint + Prettier configs
5. Create package directories:
   ```
   packages/
     core/
     schema-zod/
     sink-pino/
     sink-console/
     test/
   ```
6. Package-level configs (package.json, tsconfig.json, tsup.config.ts) for each

---

## Phase 1: Core Types Foundation

**File**: `packages/core/src/types/index.ts`

Define the type contracts before implementing logic:

- `FieldDefinition` - field metadata (group, sensitivity, cardinality, priority, transform)
- `SchemaAdapter<T>` - validation abstraction (parse, safeParse, isOptional)
- `SamplingTier` - DROP / KEEP_MINIMAL / KEEP_NORMAL / KEEP_DEBUG
- `SamplingPolicy` - decide function returning SamplingDecision
- `Sink` - emit function + optional drain
- `FlushReceipt` - emitted, decision, fieldsDropped, fieldsRedacted, finalSize
- `SubEvent` - bounded milestone shape (`name`, timestamp, optional fields)
- `Scope` - user-facing interface with event and timers APIs
- `EventAPI` - add, child, error, annotate, subEvent, flush
- `TimerAPI` - start, end, measure
- `FinaleConfig` - configuration object for createFinale

---

## Phase 2: Runtime Layer

**Files**: `packages/core/src/runtime/`

### 2.1 ScopeManager (`scope-manager.ts`)
- AsyncLocalStorage-based scope stack
- `getScope()` returns top of stack or no-op scope
- `hasScope()` checks if scope active
- `withScope(finale, fn)` creates scope, runs callback, auto-flushes

### 2.2 NoOpScope (`noop-scope.ts`)
- Silent scope that ignores all operations
- Returned when no active scope (default mode)
- Prevents crashes in library code

### 2.3 Lifecycle (`lifecycle.ts`)
- `startScope()` - create scope, initialize EventStore
- `endScope()` - finalize, run pipeline, flush

---

## Phase 3: Event Accumulation Layer

**Files**: `packages/core/src/accumulation/`

### 3.1 EventStore (`event-store.ts`)
- Store fields with merge semantics (scalar: last-write-wins, array: append+cap, counter: increment)
- Enforce limits (max keys: 100, max size: 64KB, max array: 20, max string: 1000)
- Store embedded sub-events with caps (count + per-sub-event field budget)

### 3.2 TimerManager (`timer-manager.ts`)
- `start(name)` / `end(name)` - record phase timings
- `measure(name, fn)` - wrap async work

### 3.3 ErrorCapture (`error-capture.ts`)
- Normalize errors to structured fields (error.class, error.message, error.stack)
- Handle Error.cause chains

### 3.4 Scope (`scope.ts`)
- Implements `Scope` interface
- Composes EventStore + TimerManager
- Provides user-facing `event` and `timers` APIs, including `event.subEvent()`

---

## Phase 4: Governance Layer

**Files**: `packages/core/src/governance/`

### 4.1 Field Registry (`field-registry.ts`)
- `defineFields()` function for field declarations
- Store and query field metadata
- Support namespace queries (http.*, payment.*)

### 4.2 Schema Adapter (`schema-adapter.ts`)
- Define minimal adapter interface
- No Zod dependency in core

### 4.3 Validation (`validation.ts`)
- Validate fields against registry on `add()`
- Strict mode: warn on unknown keys/wrong types
- Soft mode: drop invalid, increment counters

---

## Phase 5: Safety Layer

**Files**: `packages/core/src/safety/`

### 5.1 Redaction Engine (`redaction-engine.ts`)
- Apply transform rules: allow, hash, mask, bucket, drop
- Track redactions for receipt

### 5.2 Pattern Scanner (`pattern-scanner.ts`)
- Scan strings for tokens, emails, passwords
- Configurable patterns

### 5.3 Budget Enforcer (`budget-enforcer.ts`)
- Drop fields by priority when over budget
- Order: drop-first → optional → important (must-keep never dropped)
- Apply deterministic trimming for sub-events when event budget is exceeded

---

## Phase 6: Tail-Sampling Layer

**Files**: `packages/core/src/sampling/`

### 6.1 Policy Engine (`policy-engine.ts`)
- Execute sampling policy against finalized event
- Return decision + reason

### 6.2 Verbosity Filter (`verbosity-filter.ts`)
- KEEP_MINIMAL: core fields only
- KEEP_NORMAL: core + domain
- KEEP_DEBUG: all groups
- Sub-events filtered by tier (minimal keeps critical milestones only)

### 6.3 Default Policy (`default-policy.ts`)
- Errors: KEEP_DEBUG
- Slow (>1500ms): KEEP_NORMAL
- Success: sample at configurable rate

---

## Phase 7: Sink Layer

**Files**: `packages/core/src/sink/`

### 7.1 Async Queue (`async-queue.ts`)
- Bounded queue (default 1000)
- Drop policy: drop-lowest-tier (default), drop-newest, drop-oldest
- Background drain loop
- Metrics for queue drops

### 7.2 Sink Interface (`sink-interface.ts`)
- `emit(record)` - void or Promise
- `drain()` - optional graceful shutdown

---

## Phase 8: Public API

**Files**: `packages/core/src/api/`

### 8.1 createFinale (`create-finale.ts`)
- Factory function returning Finale engine
- Exposes: drain(), metrics, namespace()

### 8.2 Scope Access (`scope-access.ts`)
- `getScope()`, `hasScope()`, `withScope()`

### 8.3 Express Middleware (`integrations/express.ts`)
- Create scope at request start
- Auto-flush on response finish
- Handle streaming responses

### 8.4 Metrics (`metrics.ts`)
- Counters: eventsEmitted, eventsDropped, eventsSampledOut, fieldsDropped, redactionsApplied, schemaViolations, sinkFailures, queueDrops
- `snapshot()` for export

---

## Phase 9: Adapter Packages

### @finalejs/sink-console (`packages/sink-console/`)
- Pretty-print for development
- Color-coded by sampling tier

### @finalejs/sink-pino (`packages/sink-pino/`)
- Wrap pino logger
- Map sampling tier to log level

### @finalejs/schema-zod (`packages/schema-zod/`)
- `zodAdapter` implementing SchemaAdapter
- `zodType(schema)` helper

### @finalejs/test (`packages/test/`)
- `createTestSink()` - in-memory capture
- `assertFields()`, `assertNoField()`, `assertSamplingDecision()`

---

## Phase 10: Product Shape - Dual Showcase Tracks

This phase validates that V1 solves both primary user outcomes equally:

1. Rich business-context queryability for classic API request flows
2. First-class LLM workflow observability without complex hosted assumptions

### 10.1 Showcase A: API Request Flow
- Build a complete request journey example with domain, dependency, feature, and retry context
- Prove one-event queryability for incident and business analysis workflows

### 10.2 Showcase B: LLM Workflow Flow
- Build a complete LLM workflow example with step milestones, tool outcomes, and token/cost fields
- Validate that the same core API supports LLM-specific context without introducing a separate product model

### 10.3 Shared Acceptance
- Both examples use the same core primitives (`getScope()`, `event.add()`, `event.subEvent()`, `flush`)
- Both examples have tests that assert the emitted event is sufficient for operational triage

---

## Phase 11: Context Taxonomy Implementation

Implement and document first-class context families in the registry, examples, and tests:

- HTTP lifecycle
- Identity/tenant
- Dependency operations
- Feature/release
- LLM steps/tokens/cost
- Error/retry chains
- Runtime/deploy metadata

For each family, add:

- baseline field definitions
- safety and cardinality expectations
- example query and assertion fixtures

---

## Phase 12: LLM Granularity Modes (Default + Optional)

### 12.1 Default Mode
- Keep one primary event with embedded milestones as the default operational model

### 12.2 Optional Mode
- Add optional out-of-band milestone emission path for long-running/interactive workflows
- Ensure primary event remains authoritative for final workflow outcome

### 12.3 Simplicity Guardrails
- Optional mode is opt-in only
- No hosted control-plane assumptions
- API ergonomics stay consistent with the one-event mental model

---

## Phase 13: OSS Quality, Docs, and Governance Workstreams

### 13.1 CI and Quality Gates
- PR CI for typecheck, lint, unit/integration tests, and compatibility matrix
- Coverage thresholds enforced in vitest
- Security checks integrated into release gate

### 13.2 Documentation and Examples
- Root README that explains positioning and adoption path
- Package-level docs for all public APIs
- Two first-class runnable examples (API flow + LLM workflow flow)

### 13.3 OSS Repo Standards
- LICENSE, CONTRIBUTING, SECURITY, issue templates, PR template
- Maintainer/review and support expectations

---

## Phase 14: Release Automation and Public Launch Readiness

- Versioning and changelog workflow
- Publish automation for workspace packages
- Pre-release checklist for docs/examples/tests/security/compatibility gates
- Launch criteria for first public release candidate

---

## Phase 15: Maintenance and Evolution Policy

- Backward compatibility and deprecation policy execution
- Ongoing compatibility test upkeep (Node/TypeScript/integration targets)
- Roadmap process for optional advanced observability features
- Triage flow for bug, security, and adoption issues

---

## Build Order

```
1. Infrastructure (Phase 0)
2. Core types (Phase 1)
3. Runtime layer (Phase 2)
4. Accumulation layer (Phase 3)
5. Governance layer (Phase 4)
6. Safety layer (Phase 5)
7. Sampling layer (Phase 6)
8. Sink layer (Phase 7)
9. Public API (Phase 8)
10. sink-console (enables manual testing)
11. test utilities
12. schema-zod
13. sink-pino
14. Integration tests
```

---

## Critical Path to Working Demo

Minimum to demonstrate the library:

1. Infrastructure setup
2. Core types (essential interfaces only)
3. ScopeManager with AsyncLocalStorage
4. EventStore with add() + subEvent()
5. Console sink (simple JSON output)
6. Express middleware (basic hooks)
7. createFinale + flush wiring

Result:
```typescript
const finale = createFinale({ sink: consoleSink() });
app.use(expressMiddleware(finale));

app.get('/', (req, res) => {
  getScope().event.add({ 'user.id': '123' });
  getScope().event.subEvent('llm.step.completed', { 'llm.tokens_out': 320 });
  res.send('Hello');
}); // Auto-flushes one wide event
```

---

## Verification Plan

### Unit Tests
- Each layer has isolated tests
- Mock dependencies using vitest
- Test edge cases: limits, errors, missing context
- Assert field coverage across all V1 context families
- Assert no regression in safety defaults for high-risk fields

### Integration Tests
- Test layer combinations
- Verify data flows through pipeline
- Validate dual showcase paths (API and LLM workflow)
- Validate compatibility between default and optional LLM granularity modes

### E2E Tests
- Real Express app with middleware
- Complete request lifecycle
- Verify: fields captured, sub-events bounded/captured, timers work, errors normalized, sampling decisions, redaction applied, flush receipt accurate
- Validate canonical queryability scenarios:
  - incident triage from one event
  - business-context diagnosis from one event
  - LLM step-level diagnosis from one event plus optional milestones

### Manual Testing
1. Run demo Express app
2. Make requests with various scenarios (success, error, slow)
3. Verify console output shows wide events
4. Check sampling decisions match policy
5. Run LLM workflow example and verify token/cost/tool fields
6. Verify optional milestone emission can be enabled without altering default API flow

---

## Key Files

| File | Purpose |
|------|---------|
| `plans/PRD/PLAN.md` | Authoritative spec - reference for all API decisions |
| `plans/PRD/NOTES.md` | Design rationale - explains tradeoffs |
| `packages/core/src/types/index.ts` | Central type definitions |
| `packages/core/src/runtime/scope-manager.ts` | AsyncLocalStorage foundation |
| `packages/core/src/accumulation/event-store.ts` | Core data structure |
