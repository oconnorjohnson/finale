# V1 Phase 3: Event Accumulation Layer
## Timeline
| Sequence | Agent 1 | Agent 2 | Agent 3 | Agent 4 |
| --- | --- | --- | --- | --- |
| 1 | P3.S1 EventStore | WAIT for Agent 1 to finish P3.S1 | WAIT for Agent 1 to finish P3.S1 | IDLE |
| 2 | P3.S4 AccumulationScope integration prep | P3.S2 TimerManager | P3.S3 ErrorCapture | P3.S5 Lifecycle/test hardening prep |
| 3 | P3.S4 AccumulationScope integration | WAIT for Agent 2 to finish P3.S2 | WAIT for Agent 3 to finish P3.S3 | WAIT for Agent 1 to finish P3.S4 |
| 4 | IDLE | IDLE | IDLE | P3.S5 Lifecycle/test hardening |

## Status
Completed

## Goal
Provide the request-scoped event accumulation machinery that collects fields, timings, sub-events, and normalized errors into a finalized event shape.

## Current State
This phase was completed. The core accumulation modules now exist under `packages/core/src/accumulation/`, including `EventStore`, `TimerManager`, `ErrorCapture`, and `AccumulationScope`, with integration into runtime lifecycle and dedicated unit coverage.

## Entry Criteria
- `P2` runtime lifecycle primitives are available.
- `P1` event and scope contracts are stable enough to implement concretely.

## Exit Criteria
- Accumulation semantics exist for fields, arrays, counters, strings, size limits, and sub-events.
- Timers and normalized error capture are integrated into the scope.
- Runtime lifecycle defaults can create a real accumulation scope.
- Accumulation tests pass across unit and integration scenarios.

## Sprint Breakdown
### P3.S1 EventStore
- Sprint ID: `P3.S1`
- Owner: `Agent 1`
- Depends on: `P2.S2`, `P1.S1`
- Unblocks: `P3.S2`, `P3.S3`, `P3.S4`
- Objective: Implement the mutable event store and merge semantics.
- Scope: Field merge behavior, dropped-field tracking, array caps, string truncation, total size limits, and bounded sub-event storage.
- Deliverables: `packages/core/src/accumulation/event-store.ts` and core unit tests.
- Acceptance checks: EventStore correctly accumulates scalars, counters, arrays, and sub-events while enforcing configured limits.

### P3.S2 TimerManager
- Sprint ID: `P3.S2`
- Owner: `Agent 2`
- Depends on: `P3.S1`
- Unblocks: `P3.S4`
- Objective: Provide named timing measurement that can snapshot into the finalized event.
- Scope: Start/end timer handling and `measure()` convenience wrapper.
- Deliverables: `packages/core/src/accumulation/timer-manager.ts` and tests.
- Acceptance checks: Timings are recorded deterministically and can be consumed by scope finalization.

### P3.S3 ErrorCapture
- Sprint ID: `P3.S3`
- Owner: `Agent 3`
- Depends on: `P3.S1`
- Unblocks: `P3.S4`
- Objective: Normalize arbitrary error input into structured event fields.
- Scope: Error class, message, stack behavior, and cause-chain support.
- Deliverables: `packages/core/src/accumulation/error-capture.ts` and tests.
- Acceptance checks: Error normalization is stable for `Error`, unknown inputs, and nested causes.

### P3.S4 AccumulationScope integration
- Sprint ID: `P3.S4`
- Owner: `Agent 1`
- Depends on: `P3.S1`, `P3.S2`, `P3.S3`, `P2.S2`
- Unblocks: `P3.S5`, `P4.S4`, `P5.S4`, `P6.S4`, `P7.S4`
- Objective: Combine event storage, timers, and error capture into the user-facing scope object.
- Scope: `event.add`, `event.child`, `event.error`, `event.annotate`, `event.subEvent`, `event.flush`, and timer APIs.
- Deliverables: `packages/core/src/accumulation/scope.ts` plus barrel exports.
- Acceptance checks: A single scope can accumulate fields, timings, and errors and produce a finalized event snapshot.

### P3.S5 Lifecycle/test hardening
- Sprint ID: `P3.S5`
- Owner: `Agent 4`
- Depends on: `P3.S4`
- Unblocks: `P4.S4`, all later phase integration testing
- Objective: Ensure accumulation integrates cleanly with runtime lifecycle and expose regressions early.
- Scope: Scope tests, lifecycle coverage updates, and export validation.
- Deliverables: Accumulation integration tests and runtime lifecycle update for real-scope defaults.
- Acceptance checks: Scope tests pass for field, timer, error, and sub-event behavior, and lifecycle uses `AccumulationScope` by default.

## Risks and Handoffs
- Merge semantics in `EventStore` were a long-tail risk because later safety and sampling phases depend on deterministic finalized payloads.
- The handoff to Phase 4, 5, and 6 required `AccumulationScope.flush()` to be the single place where later governance, safety, and sampling stages could plug in.

## Evidence / Validation
- Accumulation files exist in `packages/core/src/accumulation/`.
- Tests exist at `event-store.test.ts`, `timer-manager.test.ts`, `error-capture.test.ts`, and `scope.test.ts`.
- `llm/memory.md` records Phase 3 completion and later regression hardening on 2026-02-28.
