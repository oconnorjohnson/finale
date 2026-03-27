# V1 Acceptance Framing

This document closes `P10.S5` for V1 product-shape validation. It consolidates the three showcase tracks and the shared queryability contract into one reviewer-facing acceptance surface so V1 readiness can be assessed from the repo without reconstructing intent from scattered notes.

## What Phase 10 Had To Prove

### One-event API request observability

The API request-flow showcase proves that a normal backend request can accumulate identity, business, dependency, retry, timing, and outcome context into one primary event that remains queryable after the request completes.

### One-event LLM workflow observability with milestones

The LLM workflow showcase proves that the same core API supports long-running AI flows without introducing a separate event model. Model, tool, token, cost, failure, and milestone context all remain attached to one primary event, with sub-events carrying bounded milestone detail.

### Linked-event interaction/journey observability

The interaction journey showcase proves that user-step progression, conversion, and drop-off can be represented by linked primary events keyed by `journey.id`. This is still the same canonical event model, but the topology intentionally differs because drop-off is defined by missing later steps.

### Shared canonical queryability across all tracks

The queryability matrix and shared assertion layer prove that the three showcase tracks answer the intended operational questions using the same canonical field posture, even when topology differs between single-event and linked-event flows.

## Evidence Map

| Proof point | Documentation evidence | Validation evidence |
| --- | --- | --- |
| API request-flow uses one authoritative event for request observability | `packages/core/docs/showcases/api-request-flow.md` | `packages/test/src/showcases/api-request-flow.integration.test.ts` |
| LLM workflow uses one authoritative event with sub-events, tool context, and token/cost visibility | `packages/core/docs/showcases/llm-workflow.md` | `packages/test/src/showcases/llm-workflow.integration.test.ts` |
| Interaction journey uses linked primary events for entry, conversion, and drop-off analysis | `packages/core/docs/showcases/interaction-journey.md` | `packages/test/src/showcases/interaction-journey.integration.test.ts` |
| Shared operational questions are defined against canonical fields across all tracks | `packages/core/docs/showcases/queryability-matrix.md` | `packages/test/src/showcases/queryability-contract.ts` and `packages/test/src/showcases/queryability-contract.integration.test.ts` |
| Sprint 10.5 reconciliation and final release-readiness framing | `packages/core/docs/showcases/README.md` and this document | `llm/v1phases/v1phase10.md` |

## Canonical Event-Model Conclusion

Phase 10 demonstrates that V1 does not require a separate LLM-specific product model or a separate analytics-specific product model. API requests, LLM workflows, and interaction journeys all use the same core event model, field-governance posture, safety controls, and sink pipeline.

Interaction journeys intentionally use linked primary events keyed by `journey.id` rather than one monolithic event. That choice is part of the modeling guidance, not a second event system: conversion and drop-off depend on the presence or absence of later events, while the canonical field model remains the same.

## Reviewer Checklist

- Can incident triage be performed from canonical fields such as request or workflow identifiers, route or step context, outcomes, and error fields?
- Can business-context diagnosis be performed from canonical user, org, and feature-cohort fields?
- Can the LLM workflow example answer model, token, cost, tool, and milestone questions from the primary event shape?
- Can the interaction journey example answer entry-frequency, step-conversion, and drop-off questions from linked canonical events?
- Can safety and redaction behavior be verified from the examples and tests, including hashed sensitive fields and normalized interaction targets?

## Release-Readiness Decision

V1 product-shape evidence is complete if the Phase 8 and Phase 9 prerequisites remain satisfied and the current showcase and workspace verification commands pass. Under those conditions, Phase 10 provides the reviewer-facing proof that the same core API can credibly serve the intended V1 product outcomes.

## Known Boundaries

- The interaction journey showcase uses linked events by design because conversion and drop-off are defined by missing later steps.
- Queryability is demonstrated through canonical fields and shared assertions, not through backend-specific query-helper APIs.
- This document closes V1 product-shape proof only. It does not cover post-V1 platform expansion work such as Convex support or query-helper packages.
