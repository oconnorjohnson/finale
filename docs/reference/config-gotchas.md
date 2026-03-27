---
title: "Config Gotchas"
---

# Config Gotchas

This page documents behavior that is easy to assume incorrectly from the public types alone.

## Typed but not active yet

`FinaleConfig` includes these fields in the public types:

- `schemaAdapter`
- `scopeMode`
- `debug`

At current runtime, these are not wired into `createFinale(...)` behavior. Do not depend on them as active features unless the implementation changes.

`FinaleConfig.errors` is active and should be treated as a real supported option.

## Validation `strict` does not throw

The current `strict` mode preserves unknown or invalid fields while still recording validation issues. It is not a throwing mode today.

See:

- [Validation](../core/validation.md)

## No repo-level docs app yet

This repo-level `docs/` directory is the source material for a future Next.js documentation site. The site itself does not exist yet in this phase.

## Portable imports are intentional

Some integrations, especially Convex, intentionally use `@finalejs/core/portable` instead of the root package. That is not an internal workaround. It is part of the current public surface.

## Sampling is not probabilistic by default

If you do not configure sampling, Finale currently keeps events at `KEEP_NORMAL`. You only get default-policy tail-sampling behavior once sampling is explicitly configured.

See:

- [Sampling](../core/sampling.md)

## Drain is part of normal operation

Because sink emission is queued, `finale.drain()` is not just a test helper. It is part of graceful shutdown and deterministic completion.

## Phase docs may lag code

Use package exports and implementation as the source of truth for user-facing docs. Phase-tracking markdown may be ahead of or behind the current public surface.
