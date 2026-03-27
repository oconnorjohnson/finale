---
title: "Portable Core"
---

# Portable Core

`@finalejs/core/portable` exists for runtime environments that should not depend on the Node-first root surface.

## Why it exists

Some integrations need Finale's core model without ambient Node runtime assumptions. The portable subpath exposes the runtime-neutral pieces needed to create a Finale instance and manage scopes explicitly.

## Exports

`@finalejs/core/portable` exports:

- `createFinale`
- `defineFields`
- public runtime-neutral types
- `startScope`
- `endScope`

## What it does not replace

The portable subpath is not just an alias of `@finalejs/core`.

Use the root package when you want:

- `withScope(...)`
- `getScope()`
- `hasScope()`
- `expressMiddleware(...)`

Use the portable subpath when you want:

- explicit lifecycle control
- explicit `Scope` passing
- compatibility with integration layers that should avoid the Node-first root surface

## Example

```ts
import { createFinale, defineFields, endScope, startScope } from '@finalejs/core/portable';
import { createTestSink } from '@finalejs/test';

const finale = createFinale({
  fields: defineFields({}),
  sink: createTestSink(),
});

const runtime = startScope(finale);
const { scope } = runtime;

scope.event.add({
  'workflow.id': 'wf_portable_123',
});

const receipt = endScope(runtime);
await finale.drain();
```

## When to use it

- Convex wrappers
- integration layers that pass `scope` explicitly
- runtimes where ambient scope access is not the right model

## Related docs

- [Mental model](./mental-model.md)
- [Scopes, events, and timers](./scopes-events-timers.md)
- [Convex package](../packages/convex.md)
