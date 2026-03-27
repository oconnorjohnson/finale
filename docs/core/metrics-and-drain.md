---
title: "Metrics and Drain"
---

# Metrics and Drain

Finale emits asynchronously through a queue-backed sink runtime. That makes `drain()` and `metrics` part of the normal operational story.

## `finale.metrics`

Every `Finale` instance exposes counters:

- `eventsEmitted`
- `eventsDropped`
- `eventsSampledOut`
- `fieldsDropped`
- `redactionsApplied`
- `schemaViolations`
- `sinkFailures`
- `queueDrops`

You can also call `finale.metrics.snapshot()` to capture them at a point in time.

## `finale.drain()`

Use `await finale.drain()` when:

- shutting down a process
- finishing a CLI task
- finishing a test that expects sink writes to have completed

`drain()` waits for queued events to be processed. It accepts an optional timeout:

```ts
await finale.drain({ timeoutMs: 2000 });
```

## Queueing and backpressure

Finale normalizes queue config to:

- `maxSize`: default `1000`
- `dropPolicy`: default `drop-lowest-tier`

When the queue is full, events may be rejected based on policy. Those drops contribute to `queueDrops`.

## Sink failures

Sink write failures increment `sinkFailures`. A failed sink emission also counts as an event drop.

## Operational advice

- Always drain in tests that inspect sink output.
- Always drain during graceful process shutdown.
- Watch `queueDrops` and `sinkFailures` as operational signals that the sink path cannot keep up.
