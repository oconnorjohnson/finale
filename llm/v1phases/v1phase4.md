# V1 Phase 4: Governance Layer
## Timeline
| Sequence | Agent 1 | Agent 2 | Agent 3 | Agent 4 |
| --- | --- | --- | --- | --- |
| 1 | P4.S1 Field registry | P4.S2 Schema adapter abstraction | WAIT for Agent 1 to finish P4.S1 | IDLE |
| 2 | IDLE | IDLE | P4.S3 Validation engine | P4.S4 Scope integration/tests prep |
| 3 | WAIT for Agent 3 to finish P4.S3 | WAIT for Agent 3 to finish P4.S3 | IDLE | P4.S4 Scope integration/tests |

## Status
Completed

## Goal
Add typed governance over field definitions and validation so the accumulation layer can enforce schema and field metadata consistently.

## Current State
This phase was completed. `packages/core/src/governance/` now contains a field registry, schema adapter abstraction, and validation pipeline, and `AccumulationScope` uses those components to validate incoming fields in either strict or soft mode.

## Entry Criteria
- `P3.S4` completed and exposed a central accumulation scope implementation.
- `P1` field and schema type contracts are stable.

## Exit Criteria
- Field metadata can be declared and queried centrally.
- Core can validate incoming fields against declared definitions.
- Strict and soft validation modes are implemented and tested.
- Scope integration reports invalid or dropped fields deterministically.

## Sprint Breakdown
### P4.S1 Field registry
- Sprint ID: `P4.S1`
- Owner: `Agent 1`
- Depends on: `P1.S1`, `P3.S4`
- Unblocks: `P4.S3`, `P5.S2`, `P5.S3`, `P6.S3`
- Objective: Establish the canonical field metadata registry abstraction.
- Scope: Field-definition storage, namespace support, and helper utilities for declaration/lookup.
- Deliverables: `packages/core/src/governance/field-registry.ts` and tests.
- Acceptance checks: Field definitions can be declared and queried by later safety and sampling phases.

### P4.S2 Schema adapter abstraction
- Sprint ID: `P4.S2`
- Owner: `Agent 2`
- Depends on: `P1.S1`
- Unblocks: `P4.S3`, `P9.S2`
- Objective: Keep validation extensible without adding a hard Zod dependency to core.
- Scope: Minimal schema adapter behavior and adapter-facing tests.
- Deliverables: `packages/core/src/governance/schema-adapter.ts` and tests.
- Acceptance checks: Core types can represent third-party schema systems through a small adapter surface.

### P4.S3 Validation engine
- Sprint ID: `P4.S3`
- Owner: `Agent 3`
- Depends on: `P4.S1`, `P4.S2`, `P3.S4`
- Unblocks: `P4.S4`, `P5.S4`, `P6.S4`
- Objective: Validate scope input against the field registry in configurable modes.
- Scope: Unknown-key handling, type-validation failure handling, `strict` vs `soft`, and validation issue callbacks.
- Deliverables: `packages/core/src/governance/validation.ts` and tests.
- Acceptance checks: Invalid and unknown fields are either reported or dropped according to configured mode.

### P4.S4 Scope integration/tests
- Sprint ID: `P4.S4`
- Owner: `Agent 4`
- Depends on: `P4.S3`
- Unblocks: `P5.S4`, `P6.S4`, future engine metrics work
- Objective: Wire governance into accumulation scope and lock behavior with integration coverage.
- Scope: Scope validation hooks, dropped-field reporting, and governance exports.
- Deliverables: Scope integration changes plus governance barrel exports and integration tests.
- Acceptance checks: Scope tests prove strict and soft validation behavior with correct dropped-field reporting.

## Risks and Handoffs
- Governance metadata became a prerequisite for both safety and sampling to reason about field groups, priorities, and transforms.
- The handoff to Phase 5 required stable field metadata semantics; changing them later would have invalidated redaction and budget rules.

## Evidence / Validation
- Governance files exist at `packages/core/src/governance/field-registry.ts`, `schema-adapter.ts`, and `validation.ts`.
- Tests exist for each governance module and integration updates live in `packages/core/src/accumulation/scope.test.ts`.
- `llm/memory.md` records Phase 4 completion on 2026-02-28.
