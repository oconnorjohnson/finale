---
title: "Interaction Journeys"
---

# Interaction Journeys

This pattern intentionally uses one primary event per step, linked by a stable `journey.id`.

## When to use linked events

Use one event per step when the absence of later events is meaningful, for example:

- funnel conversion
- drop-off analysis
- multi-step settings flows
- onboarding journeys

If you emitted only one final event for the whole journey, you would lose the ability to query partial completion cleanly.

## Core modeling rule

- one primary event per meaningful step
- same `journey.id` across steps
- stable `journey.step`
- stable canonical interaction fields

## Useful fields

- `journey.id`
- `journey.step`
- `journey.parent_step`
- `interaction.name`
- `interaction.category`
- `interaction.target`
- `screen.name`
- `screen.section`
- `ui.component`
- `interaction.outcome`
- `interaction.error`

## Pattern

1. create one scope for each interaction step
2. emit a primary event for that step
3. reuse the same `journey.id`
4. let missing later steps represent drop-off

## Why this differs from request/workflow docs

Request and workflow examples have one authoritative operation. A funnel or journey does not. The absence of the next event is part of the signal.

## Questions this pattern supports

- how many journeys started?
- how many reached the next step?
- where do users drop off?
- which cohorts fail the save step more often?

## Related docs

- [Scopes, events, and timers](../core/scopes-events-timers.md)
- [Field registry](../core/field-registry.md)
