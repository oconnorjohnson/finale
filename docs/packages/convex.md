---
title: "@finalejs/convex"
---

# `@finalejs/convex`

`@finalejs/convex` adds first-party Finale instrumentation wrappers for Convex functions and HTTP actions.

## Install

```sh
pnpm add @finalejs/convex convex
```

You will usually also use:

```sh
pnpm add @finalejs/core
```

For Convex integrations, import the runtime-neutral surface from `@finalejs/core/portable`.

## Why it uses portable core

The Convex package is built around explicit scope passing, not ambient `getScope()` access. It depends on the portable core path so wrappers can create and finalize scopes without relying on the Node-first root export path.

## Exports

- `withFinaleQuery`
- `withFinaleMutation`
- `withFinaleAction`
- `withFinaleHttpAction`
- `convexFields`
- `mergeFieldRegistries`
- `createConvexRoutePattern`

## What it adds automatically

For wrapped Convex functions:

- `convex.function.kind`
- `convex.function.name`
- `convex.function.outcome`

For wrapped HTTP actions:

- `http.method`
- `http.route`
- `http.status_code`
- `http.duration_ms`

## Canonical field fragment

`convexFields` is a ready-made field registry fragment for the Convex-specific and HTTP fields the wrappers emit automatically.

Use it together with your own field registry:

```ts
import { createFinale, defineFields } from '@finalejs/core/portable';
import { convexFields, mergeFieldRegistries } from '@finalejs/convex';

const finale = createFinale({
  fields: defineFields(
    mergeFieldRegistries(convexFields, {
      'request.id': {
        type: stringType(),
        group: 'core',
        sensitivity: 'safe',
        cardinality: 'low',
        priority: 'must-keep',
      },
    })
  ),
  sink,
});
```

## See also

- [Portable core](../core/portable.md)
- [Convex functions guide](../guides/convex-functions.md)
- [Convex HTTP actions guide](../guides/convex-http-actions.md)
