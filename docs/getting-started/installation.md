---
title: "Installation"
---

# Installation

## Base package

Install the core engine first:

```sh
pnpm add @finalejs/core
```

## Common optional packages

Zod field types:

```sh
pnpm add @finalejs/schema-zod zod
```

Console sink for local development:

```sh
pnpm add @finalejs/sink-console
```

Pino sink:

```sh
pnpm add @finalejs/sink-pino pino
```

Testing utilities:

```sh
pnpm add -D @finalejs/test
```

Express integration:

```sh
pnpm add express
```

Convex integration:

```sh
pnpm add @finalejs/convex convex
```

## Peer dependency notes

- `@finalejs/schema-zod` expects `zod`
- `@finalejs/sink-pino` expects `pino`
- `@finalejs/core` supports `express` as an optional peer for middleware use
- `@finalejs/convex` expects `convex`

## Runtime assumptions

- Node.js `>=18`
- TypeScript `>=5` is the intended environment across packages

## Typical stacks

Minimal local setup:

```sh
pnpm add @finalejs/core @finalejs/schema-zod @finalejs/sink-console zod
```

Backend API setup:

```sh
pnpm add @finalejs/core @finalejs/schema-zod @finalejs/sink-pino express pino zod
```

Convex setup:

```sh
pnpm add @finalejs/core @finalejs/convex convex
```

For Convex integrations, use `@finalejs/core/portable` imports in code even though the package dependency remains `@finalejs/core`.

Testing setup:

```sh
pnpm add -D @finalejs/test
```
