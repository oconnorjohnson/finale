---
title: "@finalejs/test"
---

# `@finalejs/test`

This package provides test helpers for Finale-based instrumentation.

## Exports

- `createTestSink()`
- `assertFields(event, expected)`
- `assertNoField(event, fieldName)`
- `assertSamplingDecision(receipt, expectedTier)`

## `createTestSink()`

The test sink stores finalized events in memory and lets you inspect them without a real logger.

```ts
import { createTestSink } from '@finalejs/test';

const sink = createTestSink();
```

Useful methods:

- `lastEvent()`
- `allEvents()`
- `lastReceipt()`
- `allReceipts()`
- `captureReceipt(receipt)`
- `clear()`

## Receipt capture is explicit

`scope.event.flush()` returns a receipt, but the test sink does not intercept it automatically. If you want receipt assertions, capture it explicitly:

```ts
let receipt;

await withScope(finale, async (scope) => {
  receipt = sink.captureReceipt(scope.event.flush());
});
```

## Assertion helpers

Field subset assertion:

```ts
assertFields(sink.lastEvent(), {
  'request.id': 'req_123',
});
```

Ensure a field is absent:

```ts
assertNoField(sink.lastEvent(), 'unknown.field');
```

Assert the sampling tier recorded on a receipt:

```ts
assertSamplingDecision(receipt, 'KEEP_NORMAL');
```

## Recommended testing pattern

1. create a `TestSink`
2. build `createFinale(...)` with that sink
3. instrument through public APIs only
4. `await finale.drain()`
5. assert on events and, when needed, captured receipts
