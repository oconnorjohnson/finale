---
title: "Convex HTTP Actions"
---

# Convex HTTP Actions

Use `withFinaleHttpAction(...)` to instrument Convex HTTP routes while preserving normal `Request` / `Response` behavior.

## What it wraps

`withFinaleHttpAction(...)` returns a raw HTTP handler suitable for Convex `httpAction(...)` registration.

## Supported usage shapes

You can call it with:

- `(finale, handler, options)`
- `(finale, { route, name, handler, ...hooks })`

Route metadata is required.

## Minimal example

```ts
import { withFinaleHttpAction } from '@finalejs/convex';

export const handler = withFinaleHttpAction(finale, {
  route: { path: '/webhooks/stripe', method: 'POST' },
  name: 'stripe:webhook',
  handler: async (_ctx, request, scope) => {
    const payload = await request.json();

    scope.event.add({
      'stripe.event_type': payload.type,
    });

    return new Response('ok', { status: 200 });
  },
});
```

## Automatically captured fields

The wrapper adds:

- `convex.function.kind = "httpAction"`
- `convex.function.name`
- `convex.function.outcome`
- `http.method`
- `http.route`
- `http.status_code`
- `http.duration_ms`

## Hooks

- `onStart(scope, ctx, request)`
- `onResponse(scope, ctx, request, response)`
- `onError(scope, ctx, request, error)`

## `onError` fallback behavior

If `onError(...)` returns a `Response`, that response becomes the handler result and its status code is recorded. If it does not return a `Response`, the original error is rethrown after Finale captures the error fields and duration.

## Route patterns

`createConvexRoutePattern(...)` converts route descriptors into canonical route strings. For example:

- explicit `path` => that exact path
- `pathPrefix` => prefix plus `*`

## Recommendation

Treat route metadata as part of the canonical event schema, not just a registration detail. Use stable route strings so HTTP action events stay queryable across deployments.

## Related docs

- [Convex package](../packages/convex.md)
- [Error capture](../core/error-capture.md)
