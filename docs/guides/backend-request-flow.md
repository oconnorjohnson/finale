---
title: "Backend Request Flow"
---

# Backend Request Flow

This pattern uses one rich primary event for a full backend request, even if the request includes retries, dependency timings, and final outcome classification.

## When to use it

Use one primary event when:

- the whole request has one authoritative outcome
- intermediate retries should remain part of the same final record
- operators care about final status, latency, tenant, and dependency context together

## Common fields

- `request.id`
- `trace.id`
- `span.id`
- `http.route`
- `http.method`
- `http.status_code`
- `http.duration_ms`
- `user.id`
- `org.id`
- `retry.count`
- `request.outcome`
- `failure.reason`

## Pattern

1. start the request scope with `expressMiddleware(...)`
2. attach route, method, request ID, and trace context in `onRequest(...)`
3. add domain fields in handlers
4. use `scope.timers.measure(...)` for dependency calls
5. add final outcome fields before response completion
6. let middleware finalize automatically

## Why this is better than many thin logs

It keeps these questions answerable from one record:

- what route failed?
- who did it affect?
- how many retries happened?
- how long did the payment or dependency call take?
- what was the final status?

## Representative shape

```json
{
  "fields": {
    "request.id": "req_checkout_123",
    "http.route": "/checkout",
    "http.method": "POST",
    "http.status_code": 201,
    "request.outcome": "success",
    "retry.count": 1,
    "payment.provider": "stripe",
    "payment.charge_id": "ch_123"
  },
  "timings": {
    "payment.authorize": 84
  }
}
```

## Related docs

- [Express integration](../core/express.md)
- [Safety and redaction](../core/safety-redaction.md)
- [Sampling](../core/sampling.md)
