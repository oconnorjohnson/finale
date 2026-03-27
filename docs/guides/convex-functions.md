---
title: "Convex Functions"
---

# Convex Functions

Use `@finalejs/convex` when you want Finale instrumentation around Convex queries, mutations, and actions without replacing Convex's registration model.

## Wrappers

- `withFinaleQuery`
- `withFinaleMutation`
- `withFinaleAction`

## Core contract

The wrappers preserve object-syntax definitions and wrap only the handler. Your wrapped handler receives:

```ts
(ctx, args, scope)
```

That explicit `scope` is the instrumentation handle. Convex integrations should enrich events through that argument instead of relying on ambient `getScope()`.

## Minimal example

```ts
import { createFinale, defineFields } from '@finalejs/core/portable';
import { convexFields, mergeFieldRegistries, withFinaleQuery } from '@finalejs/convex';

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

export const getRequest = withFinaleQuery(
  finale,
  {
    args: { requestId: 'validator' },
    handler: async (_ctx, args, scope) => {
      scope.event.add({ 'request.id': args.requestId });
      return { ok: true };
    },
  },
  {
    name: 'requests:get',
  }
);
```

## Automatically captured fields

The wrappers add:

- `convex.function.kind`
- `convex.function.name`
- `convex.function.outcome`

User code can then enrich the same event through `scope.event.add(...)`, `scope.timers`, and `scope.event.error(...)`.

## Hooks

Function wrappers support optional lifecycle hooks:

- `onStart(scope, ctx, args)`
- `onSuccess(scope, ctx, args, result)`
- `onError(scope, ctx, args, error)`

Use hooks when common instrumentation should happen around many handlers without repeating it in each handler body.

## Public and internal variants

The wrappers return wrapped definition objects that remain compatible with Convex-style registration flows. The core idea is additive instrumentation, not replacing Convex constructors.

## Recommended pattern

1. build a Finale instance from `@finalejs/core/portable`
2. merge `convexFields` into your registry
3. wrap the handler definition
4. enrich the event through the explicit `scope` argument
5. let the wrapper finalize automatically

## Related docs

- [Convex package](../packages/convex.md)
- [Portable core](../core/portable.md)
