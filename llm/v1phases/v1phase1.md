# V1 Phase 1: Core Types Foundation
## Timeline
| Sequence | Agent 1 | Agent 2 | Agent 3 | Agent 4 |
| --- | --- | --- | --- | --- |
| 1 | P1.S1 Field/event/sampling contracts | WAIT for Agent 1 to finish P1.S1 | IDLE | IDLE |
| 2 | P1.S2 Scope/sink/config/finale contracts | WAIT for Agent 1 to finish P1.S1 | P1.S3 Type tests and exports prep | IDLE |
| 3 | IDLE | P1.S3 Type tests and exports | WAIT for Agent 1 to finish P1.S2 | IDLE |

## Status
Completed

## Goal
Define the stable type contracts that later runtime, accumulation, safety, sampling, sink, and public API work all build on.

## Current State
This phase was completed in the same implementation window as Phase 2, but it remains a separate phase because `plans/IMPL/PLAN.md` defines it separately. Core event, schema, sampling, sink, scope, configuration, metrics, and finale engine type contracts now exist in `packages/core/src/types/index.ts` with dedicated tests and top-level exports.

## Entry Criteria
- `P0` completed with shared TypeScript and package scaffolding.
- The package boundary for `@finalejs/core` was available.

## Exit Criteria
- All foundational TypeScript interfaces and unions needed by later phases exist.
- Type definitions are exported through the package surface.
- Type-focused tests validate the intended shape at the contract layer.

## Sprint Breakdown
### P1.S1 Field/event/sampling contracts
- Sprint ID: `P1.S1`
- Owner: `Agent 1`
- Depends on: `P0.S2`
- Unblocks: `P1.S2`, `P2.S2`, `P3.S4`, `P4.S3`, `P5.S2`, `P6.S1`, `P7.S4`, `P8.S1`
- Objective: Define the low-level event, field, schema, sub-event, and sampling contracts.
- Scope: `FieldDefinition`, schema abstractions, `SamplingTier`, `SamplingDecision`, `SubEvent`, `FinalizedEvent`, metadata, and sink interfaces.
- Deliverables: Core event-domain type surface in `packages/core/src/types/index.ts`.
- Acceptance checks: Types compile cleanly and support later module signatures without circular redesign.

### P1.S2 Scope/sink/config/finale contracts
- Sprint ID: `P1.S2`
- Owner: `Agent 1`
- Depends on: `P1.S1`
- Unblocks: `P2.S1`, `P2.S3`, `P7.S4`, `P8.S1`, `P8.S2`, `P8.S3`, `P9.S1`, `P9.S2`, `P9.S3`, `P9.S4`
- Objective: Define the user-facing scope, timer, event, config, metrics, and finale engine contracts.
- Scope: `EventAPI`, `TimerAPI`, `Scope`, `FinaleConfig`, `Metrics`, `DrainOptions`, `Finale`.
- Deliverables: Engine-facing type layer for runtime and public API implementation.
- Acceptance checks: Runtime and engine modules can import these contracts without introducing missing fields or type placeholders.

### P1.S3 Type tests and exports
- Sprint ID: `P1.S3`
- Owner: `Agent 2`
- Depends on: `P1.S1`, `P1.S2`
- Unblocks: `P2.S4`, downstream package consumption
- Objective: Verify the type surface and expose it through the public package boundary.
- Scope: `packages/core/src/types/index.test.ts`, `packages/core/src/index.ts`, and build output validation.
- Deliverables: Type tests plus top-level exports for the types module.
- Acceptance checks: Type tests pass and the root `@finalejs/core` export surface includes the types module.

## Risks and Handoffs
- Type churn here would have cascaded into every later phase, so the handoff required keeping names and intent stable even before full engine implementation existed.
- Because Phase 2 started immediately after this work, the runtime handoff depended on `Scope` and `Finale` contracts being complete enough to avoid backtracking.

## Evidence / Validation
- `packages/core/src/types/index.ts` contains the foundational contract set.
- `packages/core/src/types/index.test.ts` exists and passes in the current workspace.
- `packages/core/src/index.ts` exports the types module.
- `llm/memory.md` records Phase 1 and Phase 2 completion together on 2026-02-28.
