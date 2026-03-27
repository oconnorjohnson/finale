---
title: "Release Acceptance"
---

# Release Acceptance

This page summarizes what the current docs and examples prove about Finale's product shape.

## What the docs set now covers

- one-event backend request observability
- one-event LLM workflow observability with milestone `subEvents`
- linked-event interaction journey observability
- Convex function and HTTP action instrumentation
- schema governance, safety, sampling, sink behavior, and test posture

## Acceptance framing

The core claim is that Finale uses one canonical event model across multiple workload types:

- backend requests
- workflows and agent-like orchestration
- linked interaction journeys
- Convex function execution

The topology can differ by use case, but the core field-governance and finalization model stays the same.

## Reviewer checklist

- Can operators triage failures from canonical identifiers, outcomes, and normalized error fields?
- Can business context be attached through bounded, queryable fields?
- Can workflow/tool/dependency milestones be represented without fragmenting the event model?
- Can interaction conversion and drop-off be computed from linked canonical events?
- Can non-Node integration surfaces such as Convex use the same model through explicit portable scope management?

## Evidence path

- [Backend request flow](./backend-request-flow.md)
- [LLM workflows](./llm-workflows.md)
- [Interaction journeys](./interaction-journeys.md)
- [Convex functions](./convex-functions.md)
- [Convex HTTP actions](./convex-http-actions.md)
- [Queryability](./queryability.md)

## Documentation source of truth

The repo-level `docs/` tree is the primary user-facing documentation source. Older package-local showcase docs remain in the repo as legacy evidence and source material.
