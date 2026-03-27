---
title: "Quickstart"
---

# Quickstart

This is the smallest useful Finale setup: define a few fields, create a Finale instance, emit one scoped event, then drain the sink queue.

## Example

```ts
import { createFinale, defineFields, withScope } from '@finalejs/core';
import { zodType } from '@finalejs/schema-zod';
import { consoleSink } from '@finalejs/sink-console';
import { z } from 'zod';

const fields = defineFields({
  'service.name': {
    type: zodType(z.string()),
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
  'http.method': {
    type: zodType(z.string()),
    group: 'core',
    sensitivity: 'safe',
    cardinality: 'low',
    priority: 'must-keep',
  },
});

const finale = createFinale({
  fields,
  sink: consoleSink(),
  defaults: {
    'service.name': 'example-api',
  },
});

await withScope(finale, async (scope) => {
  scope.event.add({
    'request.id': 'req_123',
    'http.method': 'GET',
  });
});

await finale.drain();
```

## What happens

1. `defineFields` creates the registry that governs validation and metadata.
2. `createFinale` binds that registry to a sink and queueing runtime.
3. `withScope` creates an active scope for one unit of work.
4. `scope.event.add(...)` accumulates fields.
5. Scope finalization flushes the event.
6. `finale.drain()` waits for queued sink writes to finish.

## Representative output

With the default console sink in pretty mode, the output is conceptually:

```json
{
  "fields": {
    "service.name": "example-api",
    "request.id": "req_123",
    "http.method": "GET"
  },
  "timings": {},
  "metadata": {
    "samplingDecision": "KEEP_NORMAL",
    "samplingReason": "accumulated_not_emitted"
  }
}
```

## Next steps

- [Mental model](../core/mental-model.md)
- [Field registry](../core/field-registry.md)
- [Schema Zod package](../packages/schema-zod.md)
- [Console sink package](../packages/sink-console.md)
