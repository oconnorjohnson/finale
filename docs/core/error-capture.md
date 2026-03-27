---
title: "Error Capture"
---

# Error Capture

Finale can normalize thrown values into structured error fields on the final event.

## Two levels of configuration

Engine defaults:

```ts
const finale = createFinale({
  fields,
  sink,
  errors: {
    projection: 'canonical-plus',
    includeStack: false,
    unwrapBoundaryErrors: true,
    maxCauseDepth: 5,
  },
});
```

Per-call overrides:

```ts
scope.event.error(error, {
  projection: 'mirror',
  payloadField: 'error.transport',
});
```

Per-call options override engine defaults for that invocation only.

## What `scope.event.error(...)` does

`scope.event.error(...)` captures a thrown value and adds normalized error fields to the current event.

At a minimum, that usually means canonical fields such as:

- `error.class`
- `error.message`

Depending on projection and source shape, Finale can also include stack, cause-chain, transport-safe mirrored payloads, and boundary-wrapper details.

## Projections

### `canonical`

Emit the bounded canonical error fields only.

Use this when:

- you want the smallest stable error shape
- downstream systems should rely only on normalized fields

### `canonical-plus`

Emit canonical fields plus extra normalized detail when available, such as stack and cause-chain information.

Use this when:

- you want richer debugging context
- you still want Finale to decide the normalized shape

### `mirror`

Emit canonical fields and also attach a transport-safe mirrored payload under a field such as `error.payload`.

Use this when:

- the original error envelope matters
- you need safer inspection of wrapped/serialized errors

## Options

### `includeStack`

Include stack information when available.

### `unwrapBoundaryErrors`

Attempt to unwrap known boundary-safe wrappers, including Convex-style and transport-safe error envelopes, before falling back to generic normalization.

### `maxCauseDepth`

Limit traversal of nested `cause` chains.

### `payloadField`

Field name used for the mirrored payload when `projection: 'mirror'` is active.

Default behavior uses `error.payload`.

## Supported source shapes

Finale is designed to work with:

- native `Error` instances
- error-like thrown primitives and unknown values
- structured try-error style payloads
- wrapped or boundary-safe transport payloads
- nested `cause` chains

The normalization contract is best-effort. Finale guarantees a bounded structured output, not perfect reconstruction of every upstream error type.

## Recommended defaults

- Use `canonical` for the smallest stable production shape.
- Use `canonical-plus` when you want richer debug context without mirroring the full payload.
- Use `mirror` only when the extra payload is operationally valuable and the field registry accounts for it.

## Related docs

- [Scopes, events, and timers](./scopes-events-timers.md)
- [Config gotchas](../reference/config-gotchas.md)
- [Core API reference](../reference/core-api.md)
