# Convex HTTP Showcase

This showcase demonstrates the Phase 11 HTTP action path: Convex HTTP routes can keep the standard `httpAction(async (ctx, request) => ...)` registration shape while finale captures route, method, status, duration, and error context.

## Install and import posture

Install the same portable core and Convex adapter used for standard function handlers:

```sh
pnpm add @finalejs/core @finalejs/convex @finalejs/sink-console convex
```

HTTP actions should create the finale engine from `@finalejs/core/portable`, then pass that shared engine into `withFinaleHttpAction`.

## What this proves

- HTTP route metadata is explicit and deterministic through wrapper configuration.
- The wrapped handler still returns a normal `Response`.
- Finale captures `http.method`, `http.route`, `http.status_code`, and `http.duration_ms` automatically.
- Error flows can either rethrow or translate to a fallback `Response` in `onError`.

## Engine setup

```ts
import { createFinale, defineFields } from '@finalejs/core/portable';
import { consoleSink } from '@finalejs/sink-console';
import { convexFields, mergeFieldRegistries } from '@finalejs/convex';

const stripeEventField = {
  type: {
    parse(value: unknown) {
      if (typeof value !== 'string') {
        throw new Error('stripe.event_type must be a string');
      }
      return value;
    },
    safeParse(value: unknown) {
      if (typeof value !== 'string') {
        return { success: false as const, error: new Error('stripe.event_type must be a string') };
      }
      return { success: true as const, data: value };
    },
    isOptional() {
      return false;
    },
  },
  group: 'domain' as const,
  sensitivity: 'safe' as const,
  cardinality: 'low' as const,
  priority: 'important' as const,
};

export const finale = createFinale({
  fields: defineFields(
    mergeFieldRegistries(convexFields, {
      'stripe.event_type': stripeEventField,
    })
  ),
  sink: consoleSink(),
});
```

## HTTP action example

```ts
// convex/http.ts
import { httpRouter } from 'convex/server';
import { httpAction } from './_generated/server';
import { finale } from '../src/finale';
import { withFinaleHttpAction } from '@finalejs/convex';

const http = httpRouter();

http.route({
  path: '/webhooks/stripe',
  method: 'POST',
  handler: httpAction(
    withFinaleHttpAction(finale, {
      route: { path: '/webhooks/stripe', method: 'POST' },
      name: 'stripe:webhook',
      handler: async (ctx, request, scope) => {
        const payload = await request.json();

        scope.event.add({
          'stripe.event_type': payload.type,
        });

        await ctx.runMutation(internal.payments.handleWebhook, payload);

        return new Response(null, { status: 200 });
      },
      onError: async (_scope, _ctx, _request, error) => {
        if (error instanceof Error && error.message === 'invalid_signature') {
          return new Response('invalid signature', { status: 401 });
        }
      },
    })
  ),
});

export default http;
```

## Captured fields

- `convex.function.kind = "httpAction"`
- `convex.function.name = "stripe:webhook"`
- `http.method = "POST"`
- `http.route = "/webhooks/stripe"`
- `http.status_code`
- `http.duration_ms`
- `stripe.event_type` when the handler enriches the scope explicitly

If the handler throws, finale also captures the standard core error fields such as `error.class` and `error.message`.
