# V1 Phase 10: Product Shape - Showcases
## Timeline
| Sequence | Agent 1 | Agent 2 | Agent 3 | Agent 4 |
| --- | --- | --- | --- | --- |
| 1 | P10.S1 API request-flow showcase | P10.S2 LLM workflow showcase | P10.S3 Interaction journey showcase | WAIT for Agent 1 to finish P10.S1 |
| 2 | WAIT for Agent 4 to finish P10.S4 | WAIT for Agent 4 to finish P10.S4 | WAIT for Agent 4 to finish P10.S4 | P10.S4 Shared queryability assertions |
| 3 | WAIT for Agent 4 to finish P10.S4 | WAIT for Agent 4 to finish P10.S4 | WAIT for Agent 4 to finish P10.S4 | P10.S5 Final docs polish and V1 acceptance framing |

## Status
Completed

## Goal
Demonstrate that the same core API solves the three intended V1 product outcomes: API request observability, LLM workflow observability, and interaction/journey observability.

## Current State
This phase is implemented. The repo now contains phase-specific showcase documentation under `packages/core/docs/showcases`, reusable showcase fixtures and integration tests under `packages/test/src/showcases`, and a shared queryability contract that exercises the intended operational questions across all three tracks.

## Entry Criteria
- `P8.S5` completed so the public API surface is stable.
- `P9.S5` completed so example integrations can rely on working adapters and test helpers.

## Exit Criteria
- API request-flow showcase demonstrates rich one-event queryability.
- LLM workflow showcase demonstrates sub-events and LLM-specific context capture.
- Interaction journey showcase demonstrates behavioral-flow observability.
- Shared queryability assertions prove the showcases answer the intended operational questions.
- Final V1 acceptance framing is documented clearly enough to guide release-readiness review.

## Sprint Breakdown
### P10.S1 API request-flow showcase
- Sprint ID: `P10.S1`
- Owner: `Agent 1`
- Depends on: `P8.S4`, `P9.S3` or `P9.S4`, `P9.S5`
- Unblocks: `P10.S4`, release demonstration for classic backend request flows
- Objective: Build a complete API request example that shows business, dependency, and outcome context in one event.
- Scope: Request lifecycle example, canonical field usage, dependency timings, retries, and outcome fields.
- Deliverables: Example code/docs and tests for the API request track.
- Acceptance checks: The example can answer incident and business-analysis questions from the emitted event shape alone.
- Completion note: Implemented by `packages/core/docs/showcases/api-request-flow.md`, `packages/test/src/showcases/api-request-flow.fixture.ts`, and `packages/test/src/showcases/api-request-flow.integration.test.ts`.

### P10.S2 LLM workflow showcase
- Sprint ID: `P10.S2`
- Owner: `Agent 2`
- Depends on: `P8.S4`, `P9.S3`, `P9.S5`, stable sub-event behavior from `P3` through `P8`
- Unblocks: `P10.S4`, release demonstration for LLM-oriented observability
- Objective: Show the same core API supporting long-running LLM flows with embedded milestones.
- Scope: Sub-events, model metadata, tool-call context, token/cost fields, and workflow outcome capture.
- Deliverables: Example code/docs and tests for the LLM track.
- Acceptance checks: The example proves no separate LLM-specific product model is required for V1.
- Completion note: Implemented by `packages/core/docs/showcases/llm-workflow.md`, `packages/test/src/showcases/llm-workflow.fixture.ts`, and `packages/test/src/showcases/llm-workflow.integration.test.ts`.

### P10.S3 Interaction journey showcase
- Sprint ID: `P10.S3`
- Owner: `Agent 3`
- Depends on: `P8.S3`, `P9.S3`, `P9.S5`
- Unblocks: `P10.S4`, release demonstration for interaction/journey observability
- Objective: Prove the event model can represent user/product journey questions such as conversion, step progression, and drop-off.
- Scope: Journey identifiers, step transitions, outcomes, and canonical interaction fields.
- Deliverables: Example code/docs and tests for the interaction track.
- Acceptance checks: The example can answer entry frequency, step conversion, and drop-off questions using the canonical event shape.
- Completion note: Implemented by `packages/core/docs/showcases/interaction-journey.md`, `packages/test/src/showcases/interaction-journey.fixture.ts`, and `packages/test/src/showcases/interaction-journey.integration.test.ts`.

### P10.S4 Shared queryability assertions
- Sprint ID: `P10.S4`
- Owner: `Agent 4`
- Depends on: `P10.S1`, `P10.S2`, `P10.S3`
- Unblocks: `P10.S5`
- Objective: Define and test the shared operational questions each showcase must answer.
- Scope: Assertion fixtures, expected fields, queryability checklist, and acceptance question mapping.
- Deliverables: Shared test/assertion layer plus comparison matrix across the three showcase tracks.
- Acceptance checks: All three showcases satisfy the intended V1 operational and analysis questions with the same canonical event model.
- Completion note: Implemented by `packages/test/src/showcases/queryability-contract.ts`, `packages/core/docs/showcases/queryability-matrix.md`, and `packages/test/src/showcases/queryability-contract.integration.test.ts`.

### P10.S5 Final docs polish and V1 acceptance framing
- Sprint ID: `P10.S5`
- Owner: `Agent 4`
- Depends on: `P10.S4`
- Unblocks: Final V1 completion review
- Objective: Consolidate showcase outputs into a final V1 acceptance narrative and documentation pass.
- Scope: Final doc cleanup, acceptance framing, and explicit mapping back to PRD/IMPL V1 goals.
- Deliverables: Finalized showcase documentation and release-readiness framing for V1 completion.
- Acceptance checks: A reviewer can determine V1 readiness from the showcase docs and shared acceptance criteria without reconstructing intent from scattered notes.
- Completion note: Implemented by `packages/core/docs/showcases/README.md` and `packages/core/docs/showcases/v1-acceptance.md`.

## Risks and Handoffs
- This phase is where product credibility is proven; weak examples here would make a technically complete engine look unfinished.
- Shared assertions are the critical dependency because they normalize success criteria across three different outcome tracks.

## Implementation Evidence
- Showcase documentation:
  - `packages/core/docs/showcases/api-request-flow.md`
  - `packages/core/docs/showcases/llm-workflow.md`
  - `packages/core/docs/showcases/interaction-journey.md`
  - `packages/core/docs/showcases/queryability-matrix.md`
  - `packages/core/docs/showcases/v1-acceptance.md`
- Showcase fixtures:
  - `packages/test/src/showcases/api-request-flow.fixture.ts`
  - `packages/test/src/showcases/llm-workflow.fixture.ts`
  - `packages/test/src/showcases/interaction-journey.fixture.ts`
- Showcase validation:
  - `packages/test/src/showcases/api-request-flow.integration.test.ts`
  - `packages/test/src/showcases/llm-workflow.integration.test.ts`
  - `packages/test/src/showcases/interaction-journey.integration.test.ts`
  - `packages/test/src/showcases/queryability-contract.integration.test.ts`
  - `packages/test/src/showcases/queryability-contract.ts`

## Evidence / Validation
- `plans/IMPL/PLAN.md` defines the three showcase tracks and their shared acceptance goals.
- `plans/PRD/PLAN.md` and `plans/PRD/NOTES.md` define the product obligations these showcases are intended to prove.
- The current repo state includes the Phase 10 showcase docs, fixtures, and shared queryability assertions listed above, confirming the phase is implemented rather than pending.

## Verification
- `pnpm --filter @finalejs/test test` passed on 2026-03-26 with 8 test files and 42 tests passing, including all showcase integration coverage.
- `pnpm --filter @finalejs/core test` passed on 2026-03-26 with 29 test files and 138 tests passing.
- `pnpm typecheck` passed on 2026-03-26 across `@finalejs/core`, `@finalejs/schema-zod`, `@finalejs/sink-console`, `@finalejs/sink-pino`, and `@finalejs/test`.
- `pnpm build` passed on 2026-03-26 across `@finalejs/core`, `@finalejs/schema-zod`, `@finalejs/sink-console`, `@finalejs/sink-pino`, and `@finalejs/test`.
- `pnpm test` passed on 2026-03-26 across the full workspace with 10 successful turbo tasks.
