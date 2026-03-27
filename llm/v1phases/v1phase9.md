# V1 Phase 9: Adapter Packages
## Timeline
| Sequence | Agent 1 | Agent 2 | Agent 3 | Agent 4 |
| --- | --- | --- | --- | --- |
| 1 | P9.S1 @finalejs/test | P9.S2 @finalejs/schema-zod | P9.S3 @finalejs/sink-console | P9.S4 @finalejs/sink-pino |
| 2 | WAIT for Agent 2 to finish P9.S2 | WAIT for Agent 1 to finish P9.S1 | WAIT for Agent 1 to finish P9.S1 | WAIT for Agent 1 to finish P9.S1 |
| 3 | P9.S5 Cross-package verification | WAIT for Agent 1 to finish P9.S5 | WAIT for Agent 1 to finish P9.S5 | WAIT for Agent 1 to finish P9.S5 |

## Status
Completed

## Goal
Turn the existing package shells into usable adapters and test utilities that prove the core public API is viable in real package consumption scenarios.

## Current State
Phase 9 is complete. `@finalejs/test`, `@finalejs/schema-zod`, `@finalejs/sink-console`, and `@finalejs/sink-pino` all have real implementations and package coverage in the working tree, and `P9.S5` closes the phase by verifying those packages together from a consumer-style integration suite in `packages/test`. The remaining Phase 9 work is status alignment and evidence capture rather than adapter feature build-out.

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
- Status: `Implemented / verified in working tree`
- Objective: Provide a usable development/debug sink with stable formatting behavior.
- Scope: Pretty output, non-pretty output, metadata inclusion policy, and stream targeting.
- Deliverables: Completed `packages/sink-console/src/sink.ts`, `packages/sink-console/src/sink.test.ts`, and `packages/sink-console/src/sink.integration.test.ts`.
- Acceptance checks: Console output reflects finalized events, remains suitable for local debugging, and is exercised through the public engine surface.

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
- Status: `Implemented / verified in working tree`
- Objective: Prove that the package ecosystem works together against the public engine surface.
- Scope: Integration tests that combine core engine creation with adapters and test helpers.
- Deliverables: Cross-package tests and workspace verification updates.
- Acceptance checks: Root `lint`, `typecheck`, `build`, and `test` pass with adapter implementations and cross-package tests enabled.

## Risks and Handoffs
- This phase will reveal whether the `@finalejs/core` public API is actually ergonomic or only internally coherent.
- `P9.S5` is the dependency gate for Phase 10 because the showcases need working adapters, not just core internals.

## Evidence / Validation
- Implemented console-sink behavior is visible in `packages/sink-console/src/sink.ts`, with formatting and stream-targeting coverage in `packages/sink-console/src/sink.test.ts` and public-API flow coverage in `packages/sink-console/src/sink.integration.test.ts`.
- Real adapter implementations are present in `packages/test/src/test-sink.ts`, `packages/schema-zod/src/adapter.ts`, and `packages/sink-pino/src/sink.ts`, indicating Phase 9 is in a verification/close-out stage rather than package scaffolding.
- Cross-package consumer verification now lives in `packages/test/src/cross-package.integration.test.ts`, covering `@finalejs/test`, `@finalejs/schema-zod`, `@finalejs/sink-console`, and `@finalejs/sink-pino` together through public package imports.
- Root `lint`, `typecheck`, `build`, and `test` pass with the cross-package suite enabled, closing the remaining Phase 9 verification gap.
