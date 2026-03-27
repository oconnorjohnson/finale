---
title: "Safety and Redaction"
---

# Safety and Redaction

Finale applies safety processing before sink emission so records can remain useful without leaking raw sensitive data.

## Transform rules

Each field definition can specify a `transform`:

- `allow`: keep the value as-is
- `hash`: replace with a deterministic SHA-256 hash string
- `mask`: replace with `[REDACTED]`
- `bucket`: coarsen numeric values into ranges
- `drop`: remove the field entirely

Example:

```ts
'payment.idempotency_key': {
  type: zodType(z.string()),
  group: 'domain',
  sensitivity: 'pii',
  cardinality: 'high',
  priority: 'important',
  transform: 'hash',
}
```

Representative result:

```json
{
  "payment.idempotency_key": "hash:2f4d..."
}
```

## Pattern scanning

After transform rules, Finale scans string values for a small set of sensitive patterns such as:

- bearer tokens
- email addresses
- password assignments

If a string matches one of those patterns, the emitted value becomes `[REDACTED]`.

Example:

```ts
scope.event.add({
  'debug.note': 'Authorization: Bearer abc123',
});
```

Representative result:

```json
{
  "debug.note": "[REDACTED]"
}
```

## Budget enforcement

Finale also keeps events within size limits.

The event store and safety pipeline enforce constraints such as:

- `maxKeys`
- `maxTotalSize`
- `maxArrayLength`
- `maxStringLength`

If the event is still too large at finalization time, Finale drops lower-priority fields first:

1. `drop-first`
2. `optional`
3. `important`

`must-keep` fields are preserved as long as possible.

If needed, Finale also truncates embedded `subEvents`.

## Dropped vs redacted

- Dropped: the field is removed from the emitted record.
- Redacted: the field remains present, but the value is transformed or masked.

These are tracked separately in event metadata and flush receipts.

## Recommendation

- Define `transform` explicitly for fields with privacy risk.
- Use hashing for correlatable secrets such as idempotency keys and prompt fingerprints.
- Reserve `allow` for PII only when downstream handling is intentional and controlled.
