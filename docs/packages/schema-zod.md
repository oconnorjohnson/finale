---
title: "@finalejs/schema-zod"
---

# `@finalejs/schema-zod`

This package adapts Zod schemas to Finale's `SchemaType` interface.

## Exports

- `zodType(schema)`
- `zodAdapter`

## Recommended path: `zodType(...)`

Use `zodType(...)` for normal field definitions:

```ts
import { defineFields } from '@finalejs/core';
import { zodType } from '@finalejs/schema-zod';
import { z } from 'zod';

const fields = defineFields({
  'http.status_code': {
    type: zodType(z.coerce.number()),
    group: 'core',
    sensitivity: 'safe',
    cardinality: 'low',
    priority: 'must-keep',
  },
});
```

## Lower-level path: `zodAdapter.createType(...)`

`zodAdapter` exposes the adapter object directly:

```ts
import { zodAdapter } from '@finalejs/schema-zod';
import { z } from 'zod';

const stringType = zodAdapter.createType<string>(z.string());
```

This is useful when you want the adapter API explicitly, but most applications can just use `zodType(...)`.

## Typical schema patterns

Coercion:

```ts
zodType(z.coerce.number())
```

Enums:

```ts
zodType(z.enum(['success', 'error']))
```

Optional fields:

```ts
zodType(z.string().optional())
```

Arrays:

```ts
zodType(z.array(z.string()))
```

## Why it exists

`@finalejs/core` intentionally does not depend on Zod. This package keeps core decoupled while still making Zod the easiest adapter path for applications that already use it.
