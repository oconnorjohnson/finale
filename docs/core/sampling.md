---
title: "Sampling"
---

# Sampling

Sampling decides whether the finalized event is emitted and how much detail survives.

## Current default behavior

If you do not configure sampling, Finale currently keeps events at `KEEP_NORMAL` with reason `accumulated_not_emitted`.

That means there is no probabilistic drop by default today.

## Default sampling policy

If you pass a sampling policy or default-policy options, Finale uses the sampling pipeline.

The built-in default policy behaves like this:

- events with `error.class` => `KEEP_DEBUG`
- slow events => `KEEP_NORMAL`
- successful events => `KEEP_MINIMAL` at the configured sample rate, otherwise `DROP`

## Tiers

- `DROP`: event is not emitted
- `KEEP_MINIMAL`: keep core fields and only critical sub-events
- `KEEP_NORMAL`: keep core and domain fields
- `KEEP_DEBUG`: keep the full event

## Verbosity filtering

After a sampling decision, Finale filters fields by `group`.

- `KEEP_MINIMAL` keeps `core` fields
- `KEEP_NORMAL` keeps `core` and `domain`
- `KEEP_DEBUG` keeps all groups

Sub-events are also filtered:

- `KEEP_MINIMAL` keeps only critical-looking sub-events
- `KEEP_NORMAL` keeps sub-events
- `KEEP_DEBUG` keeps everything

## Custom sampling policy

```ts
import type { SamplingPolicy } from '@finalejs/core';

const sampling: SamplingPolicy = {
  decide(event) {
    if (event.fields['workflow.outcome'] === 'error') {
      return { decision: 'KEEP_DEBUG', reason: 'workflow_error' };
    }

    return { decision: 'KEEP_MINIMAL', reason: 'steady_state' };
  },
};
```

## Examples

Successful steady-state request:

- outcome: keep or drop, depending on configured policy

Slow request:

- keep at `KEEP_NORMAL`

Erroring workflow:

- keep at `KEEP_DEBUG`

## Important distinction

Sampling decides retention tier. Sink queue backpressure is separate and may still drop events after sampling. See [sink behavior](../reference/sink-behavior.md).
