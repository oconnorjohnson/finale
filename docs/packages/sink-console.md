---
title: "@finalejs/sink-console"
---

# `@finalejs/sink-console`

The console sink is the simplest way to inspect Finale output during development.

## Export

- `consoleSink(options?)`

## Purpose

Use it when you want:

- local debugging
- readable pretty output
- no logger dependency

## Options

- `pretty?: boolean`
- `stream?: NodeJS.WritableStream`
- `colors?: boolean`
- `includeMetadata?: 'auto' | 'always' | 'never'`

## Example

```ts
import { consoleSink } from '@finalejs/sink-console';

const sink = consoleSink({
  pretty: true,
  includeMetadata: 'auto',
});
```

## Pretty vs compact

Pretty mode:

- emits labeled sections
- sorts object keys for stable output
- optionally uses ANSI colors

Compact mode:

- emits a single JSON line
- easier to pipe or snapshot

## Metadata inclusion

- `auto`: include metadata only when there are defined metadata entries
- `always`: always include metadata
- `never`: omit metadata from sink output

## Recommendation

Use `pretty: true` for interactive local debugging and `pretty: false` when you want stable JSON output for tests or scripts.
