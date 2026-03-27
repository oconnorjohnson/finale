---
title: "Scopes, Events, and Timers"
---

# Scopes, Events, and Timers

Scopes are where instrumentation happens. A scope represents one unit of work and exposes two APIs:

- `scope.event`
- `scope.timers`

## Starting a scope

For non-HTTP code, use `withScope(...)`:

```ts
import { createFinale, withScope } from '@finalejs/core';

await withScope(finale, async (scope) => {
  scope.event.add({ 'workflow.id': 'wf_123' });
});
```

Inside the callback, `getScope()` returns the active scope and `hasScope()` returns `true`.

## Explicit lifecycle control

Some integrations do not use ambient scope access. In those cases, start and end the scope explicitly through `@finalejs/core/portable` and pass the `scope` object directly to the code being instrumented.

This is the pattern used by the Convex wrappers.

## Adding fields

```ts
scope.event.add({
  'request.id': 'req_123',
  'request.outcome': 'success',
});
```

Repeated writes overwrite previous scalar values. Number-to-number writes accumulate, and arrays are merged with size limits.

## Namespaced fields with `child(...)`

```ts
const payment = scope.event.child('payment');

payment.add({
  provider: 'stripe',
  charge_id: 'ch_123',
});
```

That produces:

```json
{
  "payment.provider": "stripe",
  "payment.charge_id": "ch_123"
}
```

## Capturing errors

```ts
try {
  await doWork();
} catch (error) {
  scope.event.error(error);
}
```

This normalizes error fields such as `error.class` and `error.message` for the final event.

## Breadcrumbs with `annotate(...)`

```ts
scope.event.annotate('retrying');
```

Use annotations for lightweight markers. Keep them bounded and meaningful.

## Milestones with `subEvent(...)`

```ts
scope.event.subEvent('tool.call.completed', {
  'tool.name': 'search',
  'tool.result_count': 3,
});
```

Use `subEvent(...)` when you want milestone-level detail inside the same authoritative event.

## Timers

Start and end a named timer:

```ts
scope.timers.start('payment.authorize');
await authorize();
scope.timers.end('payment.authorize');
```

Or use `measure(...)`:

```ts
const result = await scope.timers.measure('tool.search', async () => {
  return runSearch();
});
```

Final timings are emitted under the event's `timings` object.

## Manual flush

`scope.event.flush()` returns a `FlushReceipt`. Most code should let `withScope(...)` or `expressMiddleware(...)` control finalization, but manual flush is useful in tests and advanced integrations.

## Recommendation

- Use `withScope(...)` for workflows and background jobs.
- Use `expressMiddleware(...)` for HTTP.
- Use `getScope()` only inside an active scope.
- Use explicit `Scope` plumbing when an integration layer should not rely on ambient runtime scope access.
- Prefer a small number of canonical fields over many debug-only keys.
