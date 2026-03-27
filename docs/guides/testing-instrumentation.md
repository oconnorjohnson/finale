---
title: "Testing Instrumentation"
---

# Testing Instrumentation

Instrumentation should be tested through public APIs, not internal runtime helpers.

## Recommended pattern

1. use `createTestSink()`
2. construct `createFinale(...)` with the real field registry
3. exercise the code through `withScope(...)` or `expressMiddleware(...)`
4. `await finale.drain()`
5. assert on emitted events and captured receipts

## Example

```ts
import { createFinale, defineFields, withScope } from '@finalejs/core';
import { zodType } from '@finalejs/schema-zod';
import { assertFields, createTestSink } from '@finalejs/test';
import { z } from 'zod';

const sink = createTestSink();

const finale = createFinale({
  fields: defineFields({
    'request.id': {
      type: zodType(z.string()),
      group: 'core',
      sensitivity: 'safe',
      cardinality: 'medium',
      priority: 'must-keep',
    },
  }),
  sink,
});

await withScope(finale, async (scope) => {
  scope.event.add({ 'request.id': 'req_123' });
});

await finale.drain();

assertFields(sink.lastEvent(), {
  'request.id': 'req_123',
});
```

## What to assert

- expected field subset
- absence of dropped fields
- sampling decision when policy matters
- redaction behavior for sensitive fields
- timing names and values when latency is important

## Receipt-focused tests

Use captured receipts when you want to check:

- `fieldsDropped`
- `fieldsRedacted`
- `finalSize`
- sampling decision independent of sink output

## Why this matters

Instrumentation regressions are often schema regressions, not business-logic regressions. A lightweight, public-API test harness makes those failures obvious.
