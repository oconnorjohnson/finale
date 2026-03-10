# V1 Phase 9: Adapter Packages
## Timeline
| Sequence | Agent 1 | Agent 2 | Agent 3 | Agent 4 |
| --- | --- | --- | --- | --- |
| 1 | P9.S1 @finalejs/test | P9.S2 @finalejs/schema-zod | P9.S3 @finalejs/sink-console | P9.S4 @finalejs/sink-pino |
| 2 | WAIT for Agent 2 to finish P9.S2 | WAIT for Agent 1 to finish P9.S1 | WAIT for Agent 1 to finish P9.S1 | WAIT for Agent 1 to finish P9.S1 |
| 3 | P9.S5 Cross-package verification | WAIT for Agent 1 to finish P9.S5 | WAIT for Agent 1 to finish P9.S5 | WAIT for Agent 1 to finish P9.S5 |

## Status
Pending

## Goal
Turn the existing package shells into usable adapters and test utilities that prove the core public API is viable in real package consumption scenarios.

## Current State
This phase is pending. The adapter packages already exist, but they are still placeholder-level: `@finalejs/test` has minimal in-memory helpers without full receipt tracking or tests, `@finalejs/schema-zod` returns pass-through placeholder behavior, `@finalejs/sink-console` is basic JSON output only, and `@finalejs/sink-pino` is effectively a stub.

## Entry Criteria
- `P8.S1` completed so adapters target a stable engine factory.
- `P8.S5` completed so package exports and test patterns are stable.

## Exit Criteria
- `@finalejs/test` provides usable in-memory sink and assertion helpers.
- `@finalejs/schema-zod` provides a real Zod-backed schema adapter.
- `@finalejs/sink-console` and `@finalejs/sink-pino` are functional sink adapters.
- Cross-package tests prove the adapters work with the core public API.

## Sprint Breakdown
### P9.S1 @finalejs/test
- Sprint ID: `P9.S1`
- Owner: `Agent 1`
- Depends on: `P8.S1`, `P8.S5`
- Unblocks: `P9.S5`, `P10.S4`
- Objective: Provide testing utilities for event capture and assertions against the public engine surface.
- Scope: In-memory sink behavior, receipt tracking, and assertion helpers for fields and sampling decisions.
- Deliverables: Completed `packages/test/src/test-sink.ts`, `assertions.ts`, and package tests.
- Acceptance checks: Package consumers can write end-to-end assertions without reaching into core internals.

### P9.S2 @finalejs/schema-zod
- Sprint ID: `P9.S2`
- Owner: `Agent 2`
- Depends on: `P8.S1`, `P8.S5`, `P4.S2`
- Unblocks: `P9.S5`
- Objective: Implement a real Zod adapter that satisfies the core schema abstraction.
- Scope: `zodType()`, `zodAdapter`, optional detection, and adapter tests against real Zod schemas.
- Deliverables: Completed `packages/schema-zod/src/adapter.ts` and tests.
- Acceptance checks: Zod-backed validation behaves correctly for parse, safeParse, and optional schema handling.

### P9.S3 @finalejs/sink-console
- Sprint ID: `P9.S3`
- Owner: `Agent 3`
- Depends on: `P8.S1`, `P8.S5`
- Unblocks: `P9.S5`, `P10.S1`, `P10.S2`, `P10.S3`
- Objective: Provide a usable development/debug sink with stable formatting behavior.
- Scope: Pretty output, non-pretty output, metadata inclusion policy, and stream targeting.
- Deliverables: Completed `packages/sink-console/src/sink.ts` and package tests.
- Acceptance checks: Console output reflects finalized events and remains suitable for local debugging.

### P9.S4 @finalejs/sink-pino
- Sprint ID: `P9.S4`
- Owner: `Agent 4`
- Depends on: `P8.S1`, `P8.S5`
- Unblocks: `P9.S5`, `P10.S1`
- Objective: Provide a production-facing sink adapter that forwards events to Pino with predictable level mapping.
- Scope: Logger method selection, tier-to-level mapping, record forwarding shape, and adapter tests.
- Deliverables: Completed `packages/sink-pino/src/sink.ts` and package tests.
- Acceptance checks: Pino sink calls the expected logger method with the expected event payload shape.

### P9.S5 Cross-package verification
- Sprint ID: `P9.S5`
- Owner: `Agent 1`
- Depends on: `P9.S1`, `P9.S2`, `P9.S3`, `P9.S4`
- Unblocks: `P10.S1`, `P10.S2`, `P10.S3`, release-readiness confidence
- Objective: Prove that the package ecosystem works together against the public engine surface.
- Scope: Integration tests that combine core engine creation with adapters and test helpers.
- Deliverables: Cross-package tests and workspace verification updates.
- Acceptance checks: Root `lint`, `typecheck`, `build`, and `test` pass with adapter implementations and cross-package tests enabled.

## Risks and Handoffs
- This phase will reveal whether the `@finalejs/core` public API is actually ergonomic or only internally coherent.
- `P9.S5` is the dependency gate for Phase 10 because the showcases need working adapters, not just core internals.

## Evidence / Validation
- Placeholder state is visible in `packages/test/src/test-sink.ts`, `packages/test/src/assertions.ts`, `packages/schema-zod/src/adapter.ts`, `packages/sink-console/src/sink.ts`, and `packages/sink-pino/src/sink.ts`.
- Package scaffolding, exports, and build output already exist, which reduces risk to implementation rather than package creation.
- Current workspace checks pass despite these placeholders, confirming the phase is still open functionality rather than broken infrastructure.
