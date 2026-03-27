---
title: "Express Integration"
---

# Express Integration

Use `expressMiddleware(finale, options?)` to manage a Finale scope for each request.

## What the middleware does

- starts a scope for the request
- optionally extracts trace context
- runs `onRequest(...)`
- makes the scope available to downstream handlers
- finalizes on `finish`, `close`, `aborted`, or stream errors
- records `http.duration_ms` automatically on finalization

## Minimal example

```ts
import express from 'express';
import { createFinale, defineFields, expressMiddleware, getScope } from '@finalejs/core';
import { zodType } from '@finalejs/schema-zod';
import { pinoSink } from '@finalejs/sink-pino';
import pino from 'pino';
import { z } from 'zod';

const fields = defineFields({
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
    type: zodType(z.number()),
    group: 'core',
    sensitivity: 'safe',
    cardinality: 'low',
    priority: 'must-keep',
  },
  'http.duration_ms': {
    type: zodType(z.number()),
    group: 'core',
    sensitivity: 'safe',
    cardinality: 'low',
    priority: 'must-keep',
  },
});

const finale = createFinale({
  fields,
  sink: pinoSink(pino()),
});

const app = express();

app.use(
  expressMiddleware(finale, {
    onRequest(scope, req) {
      scope.event.add({
        'request.id': String(req.headers['x-request-id'] ?? 'generated'),
        'http.route': req.path,
        'http.method': req.method,
      });
    },
    onResponse(scope, _req, res) {
      scope.event.add({
        'http.status_code': res.statusCode,
      });
    },
    extractTraceContext(req) {
      return {
        traceId: req.header('x-trace-id') ?? undefined,
        spanId: req.header('x-span-id') ?? undefined,
      };
    },
  })
);

app.get('/health', (_req, res) => {
  const scope = getScope();
  scope.event.add({ 'request.id': 'health_req' });
  res.status(200).json({ ok: true });
});
```

## Hooks

- `onRequest(scope, req)`: attach early request fields
- `onResponse(scope, req, res)`: attach response fields before final flush
- `extractTraceContext(req)`: map incoming headers to `trace.id` and `span.id`

## Lifecycle notes

- `finish`: normal successful completion
- `close`: response stream closed
- `aborted`: request aborted by the client
- `error`: request or response stream error

Finale finalizes once and ignores later writes after the scope is closed.

## Recommendation

Call `getScope()` only inside request handling after the middleware has run. Treat `onRequest(...)` as the place for route, method, identity, and trace attachment, and `onResponse(...)` as the place for status/outcome fields.
