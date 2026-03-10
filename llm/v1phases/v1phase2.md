# V1 Phase 2: Runtime Layer
## Timeline
| Sequence | Agent 1 | Agent 2 | Agent 3 | Agent 4 |
| --- | --- | --- | --- | --- |
| 1 | P2.S1 No-op scope | WAIT for Agent 1 to finish P2.S1 | IDLE | IDLE |
| 2 | P2.S2 Lifecycle scaffolding | WAIT for Agent 1 to finish P2.S2 | P2.S4 Runtime tests and exports prep | IDLE |
| 3 | P2.S3 ALS scope manager | WAIT for Agent 1 to finish P2.S3 | WAIT for Agent 1 to finish P2.S3 | IDLE |
| 4 | IDLE | P2.S4 Runtime tests and exports | IDLE | WAIT for Agent 2 to finish P2.S4 |

## Status
Completed

## Goal
Introduce request-scope lifecycle primitives so downstream accumulation and API code can safely access a current scope in Node.js.

## Current State
This phase was completed in the same implementation window as Phase 1, but the docs remain split because the official implementation plan treats runtime work as its own phase. `noop-scope`, lifecycle helpers, and AsyncLocalStorage-based scope management are implemented and exported under `packages/core/src/runtime/` with dedicated tests.

## Entry Criteria
- `P1` type contracts are in place, especially `Scope` and `Finale`.
- `@finalejs/core` package scaffolding from `P0` is stable.

## Exit Criteria
- Calling code can obtain a safe no-op scope when no active scope exists.
- Runtime can create and finalize a scope lifecycle.
- AsyncLocalStorage-based `withScope()` propagation works and is covered by tests.

## Sprint Breakdown
### P2.S1 No-op scope
- Sprint ID: `P2.S1`
- Owner: `Agent 1`
- Depends on: `P1.S2`
- Unblocks: `P2.S2`, `P2.S3`, downstream safe scope access
- Objective: Provide a crash-safe fallback scope implementation for calls outside an active request context.
- Scope: `packages/core/src/runtime/noop-scope.ts` plus default event/timer no-op behavior.
- Deliverables: Reusable singleton or equivalent no-op scope semantics.
- Acceptance checks: Accessing scope APIs without an active runtime scope does not throw and does not mutate real event state.

### P2.S2 Lifecycle scaffolding
- Sprint ID: `P2.S2`
- Owner: `Agent 1`
- Depends on: `P1.S1`, `P1.S2`, `P2.S1`
- Unblocks: `P2.S3`, `P3.S4`
- Objective: Define start and end lifecycle orchestration around a runtime scope context.
- Scope: `startScope()`, `endScope()`, runtime context typing, safe fallback receipts.
- Deliverables: Lifecycle module in `packages/core/src/runtime/lifecycle.ts`.
- Acceptance checks: Runtime scope contexts can be created and finalized without direct package consumers instantiating internals manually.

### P2.S3 ALS scope manager
- Sprint ID: `P2.S3`
- Owner: `Agent 1`
- Depends on: `P2.S2`
- Unblocks: `P2.S4`, `P8.S3`, `P8.S4`, `P10.S1`, `P10.S2`, `P10.S3`
- Objective: Implement AsyncLocalStorage-backed scope stack access.
- Scope: `getScope()`, `hasScope()`, `withScope()` semantics, nested scope handling, and automatic lifecycle finalization.
- Deliverables: `packages/core/src/runtime/scope-manager.ts`.
- Acceptance checks: Nested scopes resolve correctly and clean up after completion.

### P2.S4 Runtime tests and exports
- Sprint ID: `P2.S4`
- Owner: `Agent 2`
- Depends on: `P2.S1`, `P2.S2`, `P2.S3`
- Unblocks: `P3.S5`, public consumption of runtime helpers
- Objective: Lock runtime semantics with tests and expose them via barrel exports.
- Scope: runtime test files, `packages/core/src/runtime/index.ts`, and top-level `packages/core/src/index.ts`.
- Deliverables: Runtime tests for no-op scope, lifecycle, and scope manager plus exported runtime surface.
- Acceptance checks: Runtime tests pass and downstream phases can import runtime helpers from the package root.

## Risks and Handoffs
- Async context propagation semantics had to settle before accumulation and Express-style integrations could rely on `getScope()` behavior.
- The handoff to Phase 3 depended on `startScope()` being able to use a real accumulation scope by default.

## Evidence / Validation
- Runtime implementation exists under `packages/core/src/runtime/`.
- Tests exist at `packages/core/src/runtime/noop-scope.test.ts`, `lifecycle.test.ts`, and `scope-manager.test.ts`.
- `llm/memory.md` records completion of Phase 1 and Phase 2 on 2026-02-28.
