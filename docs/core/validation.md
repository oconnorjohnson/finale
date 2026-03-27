---
title: "Validation"
---

# Validation

Validation happens when fields are added to a scope and a field registry is present.

## What is validated

For each incoming field, Finale checks:

- whether the key exists in the field registry
- whether the value passes the field's `SchemaType`

## Validation modes

### `soft`

In `soft` mode:

- unknown fields are dropped
- invalid values are dropped
- validation issues are recorded internally for metrics

This is the safer mode when you want the emitted schema to stay clean.

### `strict`

In current runtime behavior, `strict` does not throw. Instead:

- unknown fields are kept
- invalid values are kept
- validation issues are still recorded

That means `strict` is currently closer to "preserve but mark invalid" than "reject the event".

## Example

```ts
const finale = createFinale({
  fields,
  sink,
  validation: 'soft',
});

await withScope(finale, async (scope) => {
  scope.event.add({
    'http.status_code': '201',
    'unknown.field': 'unexpected',
  });
});
```

If `http.status_code` uses `z.coerce.number()`, the parsed value is kept. If the field is unknown and mode is `soft`, it is dropped.

## Where dropped fields show up

Dropped fields appear in:

- `FlushReceipt.fieldsDropped`
- event metadata `droppedFields`
- `finale.metrics.fieldsDropped`

Validation issues also increment `finale.metrics.schemaViolations`.

## Why Zod is separate

Core does not depend on Zod directly. It depends on the minimal `SchemaType` contract so you can plug in adapters without coupling the engine to one validation library.

See [Schema Zod](../packages/schema-zod.md).
