---
title: "@finalejs/sink-pino"
---

# `@finalejs/sink-pino`

This package forwards finalized Finale records to a Pino-compatible logger.

## Export

- `pinoSink(logger, options?)`

## Logger requirements

The logger must provide Pino-like methods:

- `debug`
- `info`
- the configured fallback level, defaulting to `info`

The package validates the logger shape at runtime.

## Level mapping

Sampling decision to Pino level:

- `KEEP_DEBUG` => `debug`
- `KEEP_NORMAL` => `info`
- `KEEP_MINIMAL` => `info`
- `DROP` or missing decision => fallback level

## Example

```ts
import pino from 'pino';
import { pinoSink } from '@finalejs/sink-pino';

const logger = pino();
const sink = pinoSink(logger, { level: 'warn' });
```

In that example, a record with no recognized sampling decision falls back to `warn`.

## When to use it

Use `pinoSink(...)` when Pino is already your structured logging path and you want Finale records to flow through the same logger infrastructure.
