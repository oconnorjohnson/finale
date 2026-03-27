# Convex Extension Showcase

This showcase demonstrates the Phase 11 Convex adapter story: Convex users can keep Convex's native function registration patterns while adding finale instrumentation through a small wrapper layer.

## Install and import posture

Install the Convex adapter against the portable core surface:

```sh
pnpm add @finalejs/core @finalejs/convex @finalejs/sink-console convex
```

The Convex package is designed to import `createFinale` and lifecycle-safe types from `@finalejs/core/portable`, not the Node-first root entrypoint.

## What this proves

- Convex query, mutation, and action definitions can stay in official object syntax.
- Finale scope access is explicit through the wrapped handler signature `(ctx, args, scope)`.
- Convex integrations can depend on `@finalejs/core/portable` instead of the Node-first root package.
- Canonical Convex metadata can be merged into a normal finale field registry with `convexFields`.

## Field registry setup

Create the finale engine once and merge `convexFields` with your own application fields:

```ts
import { createFinale, defineFields } from '@finalejs/core/portable';
import { consoleSink } from '@finalejs/sink-console';
import { convexFields, mergeFieldRegistries } from '@finalejs/convex';

const requestIdField = {
  type: {
    parse(value: unknown) {
      if (typeof value !== 'string') {
        throw new Error('request.id must be a string');
      }
      return value;
    },
    safeParse(value: unknown) {
      if (typeof value !== 'string') {
        return { success: false as const, error: new Error('request.id must be a string') };
      }
      return { success: true as const, data: value };
    },
    isOptional() {
      return false;
    },
  },
  group: 'core' as const,
  sensitivity: 'safe' as const,
  cardinality: 'low' as const,
  priority: 'must-keep' as const,
};

export const finale = createFinale({
  fields: defineFields(
    mergeFieldRegistries(convexFields, {
      'request.id': requestIdField,
    })
  ),
  sink: consoleSink(),
});
```

## Query / mutation / action examples

```ts
import { createFinale, defineFields } from '@finalejs/core/portable';
import { consoleSink } from '@finalejs/sink-console';
import { v } from 'convex/values';
import { query, mutation, action } from './_generated/server';
import { convexFields, mergeFieldRegistries, withFinaleAction, withFinaleMutation, withFinaleQuery } from '@finalejs/convex';

const finale = createFinale({
  fields: defineFields(
    mergeFieldRegistries(convexFields, {
      'request.id': {
        type: {
          parse(value: unknown) {
            if (typeof value !== 'string') {
              throw new Error('request.id must be a string');
            }
            return value;
          },
          safeParse(value: unknown) {
            if (typeof value !== 'string') {
              return { success: false as const, error: new Error('request.id must be a string') };
            }
            return { success: true as const, data: value };
          },
          isOptional() {
            return false;
          },
        },
        group: 'core',
        sensitivity: 'safe',
        cardinality: 'low',
        priority: 'must-keep',
      },
    })
  ),
  sink: consoleSink(),
});

export const getRequest = query(
  withFinaleQuery(
    finale,
    {
      args: { requestId: v.string() },
      handler: async (ctx, args, scope) => {
        scope.event.add({ 'request.id': args.requestId });
        return await ctx.db
          .query('requests')
          .withIndex('by_request_id', (q) => q.eq('requestId', args.requestId))
          .first();
      },
    },
    {
      name: 'requests:get',
    }
  )
);

export const updateRequest = mutation(
  withFinaleMutation(
    finale,
    {
      args: { requestId: v.string() },
      handler: async (ctx, args, scope) => {
        scope.event.add({ 'request.id': args.requestId });
        await ctx.db.patch(args.requestId, { updatedAt: Date.now() });
        return null;
      },
    },
    {
      name: 'requests:update',
    }
  )
);

export const notifyRequest = action(
  withFinaleAction(
    finale,
    {
      args: { requestId: v.string() },
      handler: async (_ctx, args, scope) => {
        scope.event.add({ 'request.id': args.requestId });
        await fetch('https://example.com/notify', {
          method: 'POST',
          body: JSON.stringify(args),
        });
        return { ok: true };
      },
    },
    {
      name: 'requests:notify',
    }
  )
);
```

## Resulting event shape

The wrappers automatically add Convex identity fields such as:

- `convex.function.kind`
- `convex.function.name`
- `convex.function.outcome`

Typical application fields for the examples above include:

- `request.id`
- `http.method`
- `http.route`
- `http.status_code`
- `http.duration_ms`

User code can then enrich the same event through the explicit `scope` argument without relying on `AsyncLocalStorage`.
