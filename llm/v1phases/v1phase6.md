# V1 Phase 6: Tail-Sampling Layer
## Timeline
| Sequence | Agent 1 | Agent 2 | Agent 3 | Agent 4 |
| --- | --- | --- | --- | --- |
| 1 | P6.S1 Policy engine | WAIT for Agent 1 to finish P6.S1 | P6.S3 Verbosity filter | IDLE |
| 2 | P6.S2 Default policy | WAIT for Agent 1 to finish P6.S2 | IDLE | P6.S4 Scope integration/tests prep |
| 3 | WAIT for Agent 1 to finish P6.S2 | WAIT for Agent 3 to finish P6.S3 | IDLE | P6.S4 Scope integration/tests |

## Status
Completed

## Goal
Make keep/drop decisions after full event context is known and shape emitted payload detail by verbosity tier.

## Current State
This phase was completed. Sampling policy execution, default sampling behavior, verbosity filtering, and metadata propagation now live under `packages/core/src/sampling/`, and `AccumulationScope.flush()` runs the sampling decision after safety processing.

## Entry Criteria
- `P5.S4` completed so sampling can operate on redacted and budgeted payloads.
- Governance field-group metadata from `P4` is available for verbosity filtering.

## Exit Criteria
- Sampling policy execution exists with a stable decision format.
- A default policy supports success, slow-request, and error outcomes.
- Verbosity tiers filter payload content consistently.
- Scope flush receipts and metadata reflect the real sampling decision.

## Sprint Breakdown
### P6.S1 Policy engine
- Sprint ID: `P6.S1`
- Owner: `Agent 1`
- Depends on: `P5.S4`, `P1.S1`
- Unblocks: `P6.S2`, `P6.S4`, `P7.S4`
- Objective: Evaluate a configured sampling policy against the finalized event.
- Scope: Policy invocation, fallback behavior, and sampling decision normalization.
- Deliverables: `packages/core/src/sampling/policy-engine.ts` and tests.
- Acceptance checks: Sampling decisions are deterministic and fall back safely when no custom policy is configured.

### P6.S2 Default policy
- Sprint ID: `P6.S2`
- Owner: `Agent 1`
- Depends on: `P6.S1`
- Unblocks: `P6.S4`, `P8.S1`
- Objective: Provide a sensible built-in tail-sampling policy for early adopters.
- Scope: Error keep-debug, slow keep-normal, success probabilistic keep-minimal/drop behavior.
- Deliverables: `packages/core/src/sampling/default-policy.ts` and tests.
- Acceptance checks: Default policy behavior matches documented V1 expectations.

### P6.S3 Verbosity filter
- Sprint ID: `P6.S3`
- Owner: `Agent 3`
- Depends on: `P4.S1`, `P5.S4`
- Unblocks: `P6.S4`, `P7.S4`, `P10.S4`
- Objective: Trim payload content by sampling tier without changing the decision itself.
- Scope: Core/domain/debug field-group inclusion and minimal-tier sub-event filtering.
- Deliverables: `packages/core/src/sampling/verbosity-filter.ts` and tests.
- Acceptance checks: Each sampling tier emits the intended field groups and sub-event detail level.

### P6.S4 Scope integration/tests
- Sprint ID: `P6.S4`
- Owner: `Agent 4`
- Depends on: `P6.S2`, `P6.S3`
- Unblocks: `P7.S1`, `P7.S4`, `P8.S1`
- Objective: Integrate sampling into the flush pipeline and lock end-to-end behavior in tests.
- Scope: Sampling metadata, flush receipt updates, and integration assertions in scope tests.
- Deliverables: Scope pipeline updates plus sampling barrel exports and integration coverage.
- Acceptance checks: Scope tests confirm decision metadata, receipt behavior, and minimal-tier filtering.

## Risks and Handoffs
- Sampling had to plug into the existing flush path without yet having a real sink, creating a partial implementation that later Phase 7 must finish.
- The handoff to Phase 7 required a clear separation between “finalize and decide” versus “actually emit and drain.”

## Evidence / Validation
- Sampling files exist in `packages/core/src/sampling/`.
- Tests exist at `policy-engine.test.ts`, `default-policy.test.ts`, and `verbosity-filter.test.ts`.
- `packages/core/src/accumulation/scope.ts` records sampling decisions and filtered payloads.
- `llm/memory.md` records Phase 6 completion on 2026-02-28.
