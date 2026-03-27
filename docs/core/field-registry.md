---
title: "Field Registry"
---

# Field Registry

The field registry is the contract for your event schema. Every field you intend to emit should be defined once with validation and metadata.

## Defining fields

Use `defineFields(...)` to create a typed registry:

```ts
import { defineFields } from '@finalejs/core';
import { zodType } from '@finalejs/schema-zod';
import { z } from 'zod';

const fields = defineFields({
  'request.id': {
    type: zodType(z.string()),
    group: 'core',
    sensitivity: 'safe',
    cardinality: 'medium',
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
});
```

## `FieldDefinition`

Each field definition has:

- `type`: schema adapter value implementing `SchemaType`
- `group`: `core | domain | diagnostics | error`
- `sensitivity`: `safe | pii | secret`
- `cardinality`: `low | medium | high | unbounded`
- `priority`: `must-keep | important | optional | drop-first`
- `transform`: optional `allow | hash | mask | bucket | drop`

## Why the metadata matters

- `group` affects verbosity filtering under sampling.
- `priority` affects which fields are removed first when the event exceeds budget.
- `transform` affects safety processing before sink emission.
- `type` controls runtime validation of incoming values.

## Recommended taxonomy

- Use `core` for fields required to reason about the operation itself.
- Use `domain` for application-specific business fields.
- Use `diagnostics` for high-detail debugging fields.
- Use `error` for normalized failure information.

Prefer canonical dotted keys:

- `request.id`
- `http.status_code`
- `workflow.id`
- `payment.charge_id`

Avoid unstable UI labels or free-form keys:

- `clickedButton`
- `data`
- `payload`
- `misc.info`

## Good vs bad field names

Good:

- `journey.id`
- `interaction.name`
- `tool.result_count`
- `llm.prompt_fingerprint`

Bad:

- `journeyThing`
- `buttonText`
- `extra`
- `metadataBlob`

## Namespace conventions

Keep namespaces semantic and bounded:

- identity: `user.id`, `org.id`
- HTTP: `http.method`, `http.route`
- workflow: `workflow.id`, `workflow.outcome`
- payments: `payment.provider`, `payment.charge_id`

If a field will be queried, versioned, or governed, give it a stable canonical name up front.
