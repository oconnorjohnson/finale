# API Request-Flow Showcase

This showcase demonstrates the V1 backend request story finale is meant to make routine: one enriched event for a checkout request that still answers operational and business questions after retries, dependency timing, and final outcome are known.

## What this proves

- A normal Express request can accumulate HTTP, identity, feature, payment, retry, and outcome context into one event.
- Retry history and dependency timing stay queryable without emitting separate thin logs.
- Sensitive request data such as `payment.idempotency_key` can remain useful while still being hashed by policy.
- The same core API used elsewhere in V1 is enough for classic backend request observability.

## End-to-end example

```ts
import express from 'express';
import pino from 'pino';
import { createFinale, defineFields, expressMiddleware, getScope } from '@finalejs/core';
import { zodType } from '@finalejs/schema-zod';
import { pinoSink } from '@finalejs/sink-pino';
import { z } from 'zod';

const fields = defineFields({
  'service.name': {
    type: zodType(z.string()),
    group: 'core',
    sensitivity: 'safe',
    cardinality: 'low',
    priority: 'must-keep',
  },
  'deployment.env': {
    type: zodType(z.enum(['dev', 'staging', 'prod'])),
    group: 'core',
    sensitivity: 'safe',
    cardinality: 'low',
    priority: 'must-keep',
  },
  'request.id': {
    type: zodType(z.string()),
    group: 'core',
    sensitivity: 'safe',
    cardinality: 'medium',
    priority: 'must-keep',
  },
  'http.route': {
    type: zodType(z.string()),
    group: 'core',
    sensitivity: 'safe',
    cardinality: 'low',
    priority: 'must-keep',
  },
  'http.method': {
    type: zodType(z.string()),
    group: 'core',
    sensitivity: 'safe',
    cardinality: 'low',
    priority: 'must-keep',
  },
  'http.status_code': {
    type: zodType(z.number().int()),
    group: 'core',
    sensitivity: 'safe',
    cardinality: 'low',
    priority: 'must-keep',
  },
  'user.id': {
    type: zodType(z.string()),
    group: 'domain',
    sensitivity: 'pii',
    cardinality: 'high',
    priority: 'important',
    transform: 'allow',
  },
  'org.id': {
    type: zodType(z.string()),
    group: 'domain',
    sensitivity: 'safe',
    cardinality: 'medium',
    priority: 'important',
  },
  'feature.flags': {
    type: zodType(z.array(z.string())),
    group: 'domain',
    sensitivity: 'safe',
    cardinality: 'medium',
    priority: 'optional',
  },
  'payment.provider': {
    type: zodType(z.enum(['stripe'])),
    group: 'domain',
    sensitivity: 'safe',
    cardinality: 'low',
    priority: 'important',
  },
  'payment.idempotency_key': {
    type: zodType(z.string()),
    group: 'domain',
    sensitivity: 'pii',
    cardinality: 'high',
    priority: 'important',
    transform: 'hash',
  },
  'payment.charge_id': {
    type: zodType(z.string().optional()),
    group: 'domain',
    sensitivity: 'safe',
    cardinality: 'high',
    priority: 'important',
  },
  'retry.count': {
    type: zodType(z.number().int().nonnegative()),
    group: 'domain',
    sensitivity: 'safe',
    cardinality: 'low',
    priority: 'important',
  },
  'request.outcome': {
    type: zodType(z.enum(['success', 'error'])),
    group: 'core',
    sensitivity: 'safe',
    cardinality: 'low',
    priority: 'must-keep',
  },
  'failure.reason': {
    type: zodType(z.string().optional()),
    group: 'error',
    sensitivity: 'safe',
    cardinality: 'low',
    priority: 'important',
  },
  'error.class': {
    type: zodType(z.string().optional()),
    group: 'error',
    sensitivity: 'safe',
    cardinality: 'low',
    priority: 'must-keep',
  },
  'error.message': {
    type: zodType(z.string().optional()),
    group: 'error',
    sensitivity: 'pii',
    cardinality: 'medium',
    priority: 'must-keep',
    transform: 'allow',
  },
});

const finale = createFinale({
  fields,
  sink: pinoSink(pino()),
  defaults: {
    'service.name': 'checkout-api',
    'deployment.env': 'prod',
  },
  errors: {
    projection: 'canonical-plus',
  },
});

const app = express();
app.use(express.json());
app.use(
  expressMiddleware(finale, {
    onRequest(scope, req) {
      scope.event.add({
        'request.id': req.header('x-request-id') ?? 'generated',
        'http.route': req.path,
        'http.method': req.method,
      });
    },
    onResponse(scope, _req, res) {
      scope.event.add({ 'http.status_code': res.statusCode });
    },
    extractTraceContext(req) {
      return {
        traceId: req.header('x-trace-id') ?? undefined,
        spanId: req.header('x-span-id') ?? undefined,
      };
    },
  })
);

app.post('/api/checkout', async (req, res) => {
  const scope = getScope();

  scope.event.add({
    'user.id': req.body.userId,
    'org.id': req.body.orgId,
    'feature.flags': req.body.featureFlags ?? [],
    'payment.provider': 'stripe',
    'payment.idempotency_key': req.body.idempotencyKey,
  });

  try {
    const charge = await scope.timers.measure('payment.authorize', async () => {
      // Retry in-process, but still emit one final event.
      return authorizePaymentWithRetry(scope, req.body);
    });

    scope.event.add({
      'payment.charge_id': charge.id,
      'request.outcome': 'success',
    });

    res.status(201).json({ ok: true, chargeId: charge.id });
  } catch (error) {
    scope.event.add({
      'request.outcome': 'error',
      'failure.reason': 'payment_declined',
    });
    scope.event.error(error);
    res.status(402).json({ ok: false });
  }
});
```

## `try-error` compatibility

`scope.event.error(...)` can capture native `Error` values, structurally valid live
`try-error` objects, serialized `TryErrorData`, and Convex-style wrapped
transport payloads without adding a runtime dependency on `@try-error/*`.

If you opt into `errors.projection: 'canonical-plus'` or `'mirror'`, `finale`
can emit richer fields such as `error.context`, `error.cause`, and
`error.payload`. Those fields bypass registry validation today, so define them
in your field registry if you want explicit transforms like `mask`, `hash`, or
`drop`.

## Representative success event

```json
{
  "fields": {
    "service.name": "checkout-api",
    "service.version": "1.0.0",
    "deployment.env": "prod",
    "deployment.region": "us-west-2",
    "request.id": "req_showcase_123",
    "trace.id": "trace_showcase_123",
    "span.id": "span_showcase_123",
    "http.route": "/api/checkout",
    "http.method": "POST",
    "http.status_code": 201,
    "http.duration_ms": 18,
    "user.id": "user_123",
    "org.id": "org_42",
    "checkout.cart_value_cents": 2599,
    "feature.flags": ["new-checkout"],
    "payment.provider": "stripe",
    "payment.idempotency_key": "hash:...",
    "payment.charge_id": "ch_showcase_2",
    "retry.count": 1,
    "request.outcome": "success"
  },
  "timings": {
    "payment.authorize": 11
  }
}
```

## Representative failure event

```json
{
  "fields": {
    "service.name": "checkout-api",
    "request.id": "req_showcase_failure",
    "http.route": "/api/checkout",
    "http.method": "POST",
    "http.status_code": 402,
    "user.id": "user_123",
    "org.id": "org_42",
    "payment.provider": "stripe",
    "payment.idempotency_key": "hash:...",
    "request.outcome": "error",
    "failure.reason": "payment_declined",
    "error.class": "PaymentDeclinedError",
    "error.message": "Card declined"
  },
  "timings": {
    "payment.authorize": 5
  }
}
```

## Questions this one event answers

| Question | Fields to query |
| --- | --- |
| What happened for this request? | `request.id`, `request.outcome`, `http.status_code`, `error.class`, `error.message` |
| Which tenant or user was affected? | `user.id`, `org.id` |
| Which dependency retried or slowed down? | `payment.provider`, `retry.count`, `timings.payment.authorize` |
| Which feature cohort saw the behavior? | `feature.flags`, `deployment.env`, `deployment.region`, `service.version` |
| Why did it fail? | `failure.reason`, `error.class`, `error.message` |

Retries and dependency timing stay attached to the primary request event rather than forcing extra log lines or per-attempt grep work.

`payment.idempotency_key` is intentionally hashed by policy. The event keeps the value queryable enough for correlation while avoiding raw sensitive request data in the sink payload.
