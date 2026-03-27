# V1 Phase 8: Public API
## Timeline
| Sequence | Agent 1 | Agent 2 | Agent 3 | Agent 4 |
| --- | --- | --- | --- | --- |
| 1 | P8.S1 createFinale engine | P8.S2 Metrics implementation | WAIT for Agent 1 to finish P8.S1 | IDLE |
| 2 | P8.S3 Public scope access surface | WAIT for Agent 1 to finish P8.S1 | P8.S4 Express middleware prep | P8.S5 API exports/tests/examples prep |
| 3 | WAIT for Agent 3 to finish P8.S3 | WAIT for Agent 2 to finish P8.S2 | P8.S4 Express middleware | WAIT for Agent 1 to finish P8.S1 |
| 4 | IDLE | IDLE | IDLE | P8.S5 API exports/tests/examples |

## Status
Completed

## Goal
Expose a usable `@finalejs/core` engine surface with creation, metrics, scope access, and framework integration.

## Current State
This phase was completed. `@finalejs/core` now exposes a functioning engine surface with `createFinale()`, live metrics with snapshot support, public scope access helpers, and first-party Express middleware. The root package exports now include `expressMiddleware` plus its public types, and API-level tests cover both engine usage and request-lifecycle middleware usage through the package root.

## Entry Criteria
- `P7.S4` completed so the engine can emit events through a real sink path.
- Runtime and accumulation helpers from prior phases are stable.

## Exit Criteria
- `createFinale()` exists and returns a functioning engine.
- Metrics are implemented and exposed with snapshot support.
- Public scope access helpers are exported as stable API.
- Express middleware exists for request lifecycle management.
- API-level tests and examples validate the public surface.

## Sprint Breakdown
### P8.S1 createFinale engine
- Sprint ID: `P8.S1`
- Owner: `Agent 1`
- Depends on: `P7.S4`
- Unblocks: `P8.S2`, `P8.S3`, `P8.S4`, `P8.S5`, `P9.S1`, `P9.S2`, `P9.S3`, `P9.S4`
- Objective: Build the top-level engine factory and wire config into runtime, scope, sampling, and sink behavior.
- Scope: `packages/core/src/api/create-finale.ts`, configuration normalization, sink runtime ownership, and `drain()` implementation.
- Deliverables: Working `createFinale()` plus supporting API modules.
- Acceptance checks: Consumers can instantiate an engine with field registry, sink, and optional policies and obtain a working `drain()` method.

### P8.S2 Metrics implementation
- Sprint ID: `P8.S2`
- Owner: `Agent 2`
- Depends on: `P7.S2`, `P7.S3`, `P8.S1`
- Unblocks: `P8.S5`, `P9.S5`, `P10.S4`
- Objective: Implement the engine metrics contract and connect it to queue, sink, validation, safety, and sampling outcomes.
- Scope: Mutable counter store, read-only metrics view, and `snapshot()`.
- Deliverables: `packages/core/src/api/metrics.ts` plus instrumentation points across the core pipeline.
- Acceptance checks: Metrics reflect real emitted, dropped, sampled-out, redacted, failed, and queue-drop outcomes.

### P8.S3 Public scope access surface
- Sprint ID: `P8.S3`
- Owner: `Agent 1`
- Depends on: `P8.S1`, `P2.S3`
- Unblocks: `P8.S4`, `P8.S5`, `P10.S1`, `P10.S2`, `P10.S3`
- Objective: Expose the runtime helpers through a stable API module rather than low-level internal paths.
- Scope: `getScope()`, `hasScope()`, `withScope()`, and any engine-coupled scope helpers that should be public.
- Deliverables: `packages/core/src/api/scope-access.ts` and root exports.
- Acceptance checks: Consumers can use scope helpers through the public package surface without importing internal module paths.

### P8.S4 Express middleware
- Sprint ID: `P8.S4`
- Owner: `Agent 3`
- Depends on: `P8.S1`, `P8.S3`
- Unblocks: `P10.S1`, `P10.S2`
- Objective: Add a first-party Node/Express integration that demonstrates the intended request lifecycle pattern.
- Scope: Middleware creation, request-scope start, response-finish flush, streaming behavior, and error-safe cleanup.
- Deliverables: `packages/core/src/api/integrations/express.ts` plus middleware tests.
- Acceptance checks: An Express request can create a scope, accumulate context during the request, and flush exactly once on completion.

### P8.S5 API exports/tests/examples
- Sprint ID: `P8.S5`
- Owner: `Agent 4`
- Depends on: `P8.S1`, `P8.S2`, `P8.S3`, `P8.S4`
- Unblocks: `P9.S5`, `P10.S1`, `P10.S2`, `P10.S3`, final V1 API readiness
- Objective: Present a coherent public surface and prove it with API-level tests and minimal examples.
- Scope: Package root exports, engine tests, example snippets, and adoption-focused API verification.
- Deliverables: Updated `packages/core/src/index.ts`, API tests, and example coverage.
- Acceptance checks: Root package exports align with documented V1 usage and API-level tests validate core engine flows.

## Risks and Handoffs
- `createFinale()` is the major integration point where hidden assumptions across prior phases become visible.
- `P8.S5` is the stability gate for Phase 9; adapters should not target internal modules once the public API surface is finalized.

## Evidence / Validation
- `packages/core/src/api/create-finale.ts` implements engine creation, queue normalization, sink runtime ownership, and `drain()` wiring.
- `packages/core/src/api/metrics.ts` provides the concrete metrics store and snapshot-capable read-only view used by `Finale`.
- `packages/core/src/api/scope-access.ts` exposes `getScope()`, `hasScope()`, and `withScope()` as stable public API helpers.
- `packages/core/src/api/integrations/express.ts` implements first-party Express request lifecycle management with trace context extraction and single-flush semantics.
- `packages/core/src/index.ts` exports the supported root V1 API, including `expressMiddleware`, while `packages/core/src/index.test.ts` and `packages/core/src/api/public-api-examples.test.ts` verify documented root-import usage without exposing internal runtime helpers.
