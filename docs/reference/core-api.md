---
title: "Core API Reference"
---

# Core API Reference

This page indexes the public API exported by `@finalejs/core`.

## Functions

### `createFinale(config: FinaleConfig): Finale`

Create a Finale engine instance with field registry, sink, queue config, and optional defaults, validation, limits, and sampling.

See:

- [Quickstart](../getting-started/quickstart.md)
- [Mental model](../core/mental-model.md)

### `withScope(finale, fn, options?): Promise<T>`

Run a function inside an active scope and finalize it automatically.

See:

- [Scopes, events, and timers](../core/scopes-events-timers.md)

### `getScope(): Scope`

Get the active scope. Outside an active context, Finale currently falls back to a no-op scope.

### `hasScope(): boolean`

Return whether a scope is currently active.

### `expressMiddleware(finale, options?): RequestHandler`

Create Express middleware that manages a Finale scope for each request.

See:

- [Express integration](../core/express.md)

### `defineFields(fields): FieldRegistry`

Create a typed field registry definition.

See:

- [Field registry](../core/field-registry.md)

### `createDefaultSamplingPolicy(options?): SamplingPolicy`

Create the built-in default sampling policy.

See:

- [Sampling](../core/sampling.md)

### `startScope(finale)` and `endScope(runtime)`

Portable lifecycle helpers exported from `@finalejs/core/portable`.

See:

- [Portable core](../core/portable.md)

## Important types

### `FinaleConfig`

Engine configuration object.

Commonly used active fields:

- `fields`
- `sink`
- `sampling`
- `defaults`
- `validation`
- `queue`
- `limits`
- `errors`

See caveats:

- [Config gotchas](./config-gotchas.md)

### `FieldDefinition`

Field schema and metadata entry.

### `SchemaType`

Minimal runtime validation contract used by core.

### `SamplingPolicy`

Interface with `decide(event): SamplingDecision`.

### `Sink`

Interface with `emit(record)` and optional `drain()`.

### `Scope`

Exposes `event` and `timers`.

### `FlushReceipt`

Returned by manual flush or finalization. Contains emission and drop/redaction details.

### `FinalizedEvent`

The finalized record shape sent to sinks.

### `Metrics`

Per-engine counters for operational visibility.

### `WithScopeOptions`

Options for `withScope(...)`, including an explicit `scope` override.

### `ErrorCaptureProjection`

Projection mode for normalized error capture.

### `ErrorCaptureConfig`

Engine-level defaults for error capture under `FinaleConfig.errors`.

### `ErrorCaptureOptions`

Per-call overrides for `scope.event.error(err, options)`.

## Portable note

The root `@finalejs/core` package does not expose the portable-only subpath exports directly. Import `startScope(...)`, `endScope(...)`, and other portable-only helpers from `@finalejs/core/portable`.
