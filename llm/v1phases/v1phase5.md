# V1 Phase 5: Safety Layer
## Timeline
| Sequence | Agent 1 | Agent 2 | Agent 3 | Agent 4 |
| --- | --- | --- | --- | --- |
| 1 | P5.S1 Pattern scanner | WAIT for Agent 1 to finish P5.S1 | P5.S3 Budget enforcer | IDLE |
| 2 | P5.S2 Redaction engine | WAIT for Agent 1 to finish P5.S2 | IDLE | P5.S4 Scope integration/tests prep |
| 3 | WAIT for Agent 1 to finish P5.S2 | WAIT for Agent 3 to finish P5.S3 | IDLE | P5.S4 Scope integration/tests |

## Status
Completed

## Goal
Introduce PII/secret protection and payload-budget enforcement before events are sampled or emitted.

## Current State
This phase was completed. Pattern scanning, transform-based redaction, and priority-aware budget enforcement now exist in `packages/core/src/safety/`, and `AccumulationScope.flush()` runs the safety pipeline before sampling.

## Entry Criteria
- `P4.S4` completed so safety rules can consume field metadata and validation output.
- `P3.S4` provides a single flush pipeline integration point.

## Exit Criteria
- Sensitive strings can be detected by pattern scanning.
- Field transform rules can redact, hash, mask, bucket, or drop values.
- Payload budgets can drop lower-priority fields and trim sub-events deterministically.
- Scope receipts record dropped and redacted fields.

## Sprint Breakdown
### P5.S1 Pattern scanner
- Sprint ID: `P5.S1`
- Owner: `Agent 1`
- Depends on: `P4.S1`
- Unblocks: `P5.S2`
- Objective: Detect likely secrets or PII even when fields are not explicitly configured with transforms.
- Scope: Regex-based defaults for tokens, emails, and password-like strings plus scanner configuration hooks.
- Deliverables: `packages/core/src/safety/pattern-scanner.ts` and tests.
- Acceptance checks: Known sensitive patterns are detected consistently and can be consumed by redaction logic.

### P5.S2 Redaction engine
- Sprint ID: `P5.S2`
- Owner: `Agent 1`
- Depends on: `P5.S1`, `P4.S1`, `P3.S4`
- Unblocks: `P5.S4`, `P7.S4`
- Objective: Apply field-level and fallback safety transforms to finalized event fields.
- Scope: `allow`, `hash`, `mask`, `bucket`, `drop`, deterministic hashing, and redaction reporting.
- Deliverables: `packages/core/src/safety/redaction-engine.ts` and tests.
- Acceptance checks: Transforms produce expected output and report redacted and dropped fields.

### P5.S3 Budget enforcer
- Sprint ID: `P5.S3`
- Owner: `Agent 3`
- Depends on: `P4.S1`, `P3.S4`
- Unblocks: `P5.S4`, `P7.S4`
- Objective: Ensure finalized payloads stay within configured budgets without dropping must-keep fields first.
- Scope: Size estimation, priority-ordered dropping, and deterministic sub-event trimming.
- Deliverables: `packages/core/src/safety/budget-enforcer.ts` and tests.
- Acceptance checks: Over-budget events shed lower-priority data first and preserve must-keep fields.

### P5.S4 Scope integration/tests
- Sprint ID: `P5.S4`
- Owner: `Agent 4`
- Depends on: `P5.S2`, `P5.S3`
- Unblocks: `P6.S4`, `P7.S4`
- Objective: Integrate safety behavior into the flush pipeline and lock it with scope-level assertions.
- Scope: `AccumulationScope.flush()` safety ordering, receipt metadata, and integration tests.
- Deliverables: Scope pipeline changes plus safety barrel exports and updated scope tests.
- Acceptance checks: Scope receipts include safety output and integration tests confirm pipeline order and deterministic trimming.

## Risks and Handoffs
- Budget policy had to remain deterministic or later sampling and showcase phases would produce unstable payload expectations.
- The handoff to Phase 6 depended on safety completing before sampling, because sampling decisions must see redacted and trimmed payloads rather than raw fields.

## Evidence / Validation
- Safety files exist in `packages/core/src/safety/`.
- Tests exist at `pattern-scanner.test.ts`, `redaction-engine.test.ts`, and `budget-enforcer.test.ts`.
- `packages/core/src/accumulation/scope.ts` integrates the safety pipeline.
- `llm/memory.md` records Phase 5 completion on 2026-02-28.
