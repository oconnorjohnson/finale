---
title: "Field Definition Reference"
---

# Field Definition Reference

## Shape

```ts
interface FieldDefinition<T = unknown> {
  type: SchemaType<T>;
  group: 'core' | 'domain' | 'diagnostics' | 'error';
  sensitivity: 'safe' | 'pii' | 'secret';
  cardinality: 'low' | 'medium' | 'high' | 'unbounded';
  priority: 'must-keep' | 'important' | 'optional' | 'drop-first';
  transform?: 'allow' | 'hash' | 'mask' | 'bucket' | 'drop';
}
```

## Properties

### `type`

Runtime validator and parser for the field value.

### `group`

Controls whether the field survives lower verbosity tiers.

### `sensitivity`

Documents privacy sensitivity and should guide transform choice.

### `cardinality`

Documents expected uniqueness and query behavior. It does not directly change runtime behavior today.

### `priority`

Controls which fields are dropped first when the event exceeds budget.

### `transform`

Optional safety transform applied before emission.

## Recommended combinations

Stable core identifiers:

- `group: 'core'`
- `priority: 'must-keep'`

Business identifiers:

- `group: 'domain'`
- `priority: 'important'`

Debug-only payloads:

- `group: 'diagnostics'`
- `priority: 'drop-first'` or `optional`

Normalized error details:

- `group: 'error'`
- `priority: 'must-keep'` or `important`
