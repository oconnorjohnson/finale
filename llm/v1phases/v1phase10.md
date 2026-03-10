# V1 Phase 10: Product Shape - Showcases
## Timeline
| Sequence | Agent 1 | Agent 2 | Agent 3 | Agent 4 |
| --- | --- | --- | --- | --- |
| 1 | P10.S1 API request-flow showcase | P10.S2 LLM workflow showcase | P10.S3 Interaction journey showcase | WAIT for Agent 1 to finish P10.S1 |
| 2 | WAIT for Agent 4 to finish P10.S4 | WAIT for Agent 4 to finish P10.S4 | WAIT for Agent 4 to finish P10.S4 | P10.S4 Shared queryability assertions |
| 3 | WAIT for Agent 4 to finish P10.S4 | WAIT for Agent 4 to finish P10.S4 | WAIT for Agent 4 to finish P10.S4 | P10.S5 Final docs polish and V1 acceptance framing |

## Status
Pending

## Goal
Demonstrate that the same core API solves the three intended V1 product outcomes: API request observability, LLM workflow observability, and interaction/journey observability.

## Current State
This phase is pending. The implementation plan defines three showcase tracks, but there are no phase-specific showcase docs, examples, or queryability assertions in the repo yet. This phase depends on the core engine and adapter packages becoming usable first.

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

### P10.S2 LLM workflow showcase
- Sprint ID: `P10.S2`
- Owner: `Agent 2`
- Depends on: `P8.S4`, `P9.S3`, `P9.S5`, stable sub-event behavior from `P3` through `P8`
- Unblocks: `P10.S4`, release demonstration for LLM-oriented observability
- Objective: Show the same core API supporting long-running LLM flows with embedded milestones.
- Scope: Sub-events, model metadata, tool-call context, token/cost fields, and workflow outcome capture.
- Deliverables: Example code/docs and tests for the LLM track.
- Acceptance checks: The example proves no separate LLM-specific product model is required for V1.

### P10.S3 Interaction journey showcase
- Sprint ID: `P10.S3`
- Owner: `Agent 3`
- Depends on: `P8.S3`, `P9.S3`, `P9.S5`
- Unblocks: `P10.S4`, release demonstration for interaction/journey observability
- Objective: Prove the event model can represent user/product journey questions such as conversion, step progression, and drop-off.
- Scope: Journey identifiers, step transitions, outcomes, and canonical interaction fields.
- Deliverables: Example code/docs and tests for the interaction track.
- Acceptance checks: The example can answer entry frequency, step conversion, and drop-off questions using the canonical event shape.

### P10.S4 Shared queryability assertions
- Sprint ID: `P10.S4`
- Owner: `Agent 4`
- Depends on: `P10.S1`, `P10.S2`, `P10.S3`
- Unblocks: `P10.S5`
- Objective: Define and test the shared operational questions each showcase must answer.
- Scope: Assertion fixtures, expected fields, queryability checklist, and acceptance question mapping.
- Deliverables: Shared test/assertion layer plus comparison matrix across the three showcase tracks.
- Acceptance checks: All three showcases satisfy the intended V1 operational and analysis questions with the same canonical event model.

### P10.S5 Final docs polish and V1 acceptance framing
- Sprint ID: `P10.S5`
- Owner: `Agent 4`
- Depends on: `P10.S4`
- Unblocks: Final V1 completion review
- Objective: Consolidate showcase outputs into a final V1 acceptance narrative and documentation pass.
- Scope: Final doc cleanup, acceptance framing, and explicit mapping back to PRD/IMPL V1 goals.
- Deliverables: Finalized showcase documentation and release-readiness framing for V1 completion.
- Acceptance checks: A reviewer can determine V1 readiness from the showcase docs and shared acceptance criteria without reconstructing intent from scattered notes.

## Risks and Handoffs
- This phase is where product credibility is proven; weak examples here would make a technically complete engine look unfinished.
- Shared assertions are the critical dependency because they normalize success criteria across three different outcome tracks.

## Evidence / Validation
- `plans/IMPL/PLAN.md` defines the three showcase tracks and their shared acceptance goals.
- `plans/PRD/PLAN.md` and `plans/PRD/NOTES.md` already define the product obligations these showcases need to prove.
- Current repo state lacks showcase-specific implementation artifacts, confirming the phase is still open.
