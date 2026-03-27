---
title: "Getting Started Overview"
---

# Getting Started Overview

Finale is built around a "wide event" model. Instead of emitting a separate log line for every step and joining them mentally later, you accumulate fields over the life of a request or workflow and emit one final record when the outcome is known.

## The core idea

- Start a scope.
- Add fields as information becomes available.
- Record timings and milestones.
- Finalize once.
- Let Finale validate, redact, sample, and enqueue the finished event.

## One final event vs many thin logs

Finale is useful when you care about the final, queryable shape of an operation:

- HTTP requests with retries, auth context, dependency timings, and final status
- workflow executions with planning, tool calls, and outcome
- linked product interaction events that share a stable join key such as `journey.id`

It is not a replacement for traces, metrics, or every kind of application log. It is the layer for "what happened in this unit of work, once everything important is known?"

## Where it fits

- Logging: Finale emits structured records through sinks, but it is stricter than free-form logging.
- Analytics: Finale can model user interactions, but it stays close to application code and canonical field definitions.
- Tracing: Finale can carry trace and span IDs, but it does not try to replace full distributed tracing.

## Supported patterns

### HTTP requests

Use `expressMiddleware(finale, options)` to start and finalize a scope around each request. Add fields in hooks and application handlers, then let middleware finalize automatically.

### Workflow scopes

Use `withScope(finale, async (scope) => { ... })` for jobs, agents, background tasks, and orchestration code that is not tied to Express.

### Linked interaction events

Use one primary event per meaningful step when absence matters, for example a funnel or settings journey. Link events with a shared key such as `journey.id`.

### Convex functions and HTTP actions

Use `@finalejs/convex` with `@finalejs/core/portable` when Finale needs to run inside an integration layer that passes scope explicitly instead of relying on ambient scope access.

## Next steps

- [Installation](./installation.md)
- [Quickstart](./quickstart.md)
- [Mental model](../core/mental-model.md)
