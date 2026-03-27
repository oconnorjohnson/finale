---
title: "Mental Model"
---

# Mental Model

Finale has one job: accumulate information about a unit of work and emit a single structured event when that unit is done.

## Main pieces

- `Finale`: the engine instance returned by `createFinale`
- `Scope`: the active container for one request, workflow, or step
- `event`: the API for adding fields, errors, annotations, and sub-events
- `timers`: the API for measuring durations
- `sink`: the output adapter that receives finalized records

## Lifecycle

1. Create a `Finale` instance with a field registry and sink.
2. Start a scope with `withScope(...)`, `expressMiddleware(...)`, or explicit lifecycle helpers such as `startScope(...)`.
3. Add fields over time as facts become known.
4. Record timings with `scope.timers`.
5. Optionally add milestone `subEvents`.
6. Finalize the scope.
7. Finale validates, redacts, enforces budgets, applies sampling, then enqueues the event for sink emission.

## Two scope-entry styles

- Ambient/root path: `withScope(...)`, `getScope()`, `expressMiddleware(...)`
- Explicit/portable path: `startScope(...)`, `endScope(...)`, and direct `scope` passing

Some integrations use explicit scope passing because ambient scope access is not the right runtime model.

## Primary event vs sub-events

The primary event is the authoritative final record. It contains:

- accumulated `fields`
- `timings`
- `metadata`
- optional `subEvents`

`subEvents` are embedded milestones inside that same record. Use them when you want additional timeline detail without creating a separate primary event for each step.

Use a separate primary event only when the absence of later events is meaningful, such as funnel drop-off.

## Pipeline placement

The finalization pipeline is:

1. accumulate raw fields and timings
2. validate against the field registry
3. apply transform-based redaction and pattern scanning
4. enforce event size and priority budgets
5. make a sampling decision
6. filter the event by verbosity tier
7. enqueue to the sink runtime

## Important current behavior

- If you do not configure sampling, Finale currently keeps events at `KEEP_NORMAL`.
- `finale.drain()` is the explicit shutdown point for queued sink writes.
- The public types expose some config fields that are not currently active at runtime. See [config gotchas](../reference/config-gotchas.md).
