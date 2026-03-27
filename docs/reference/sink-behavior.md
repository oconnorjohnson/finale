---
title: "Sink Behavior"
---

# Sink Behavior

Sinks receive `FinalizedEvent` objects after the scope has already been validated, redacted, budgeted, and filtered by sampling tier.

## Sink interface

```ts
interface Sink {
  emit(record: FinalizedEvent): void | Promise<void>;
  drain?(): Promise<void>;
}
```

## Queueing model

Finale does not call sinks inline from normal application code. It enqueues finalized events into a sink runtime backed by an async queue.

Implications:

- sink writes can fail independently of application logic
- queue admission can fail under backpressure
- `finale.drain()` is required when you need shutdown guarantees

## Queue drop policies

Supported queue policies:

- `drop-newest`
- `drop-oldest`
- `drop-lowest-tier`

The default is `drop-lowest-tier`.

## Guarantees

- Finalization happens before sink admission.
- If an event is sampled out, it is not enqueued.
- If an event is admitted, sink emission is attempted asynchronously.
- `drain()` waits for queued work and optional sink drain logic.

## Failure semantics

- sink emit failure => `sinkFailures` increments and the event counts as dropped
- queue rejection => `queueDrops` increments when caused by backpressure
- drain failure => `sinkFailures` increments

## Design advice

Keep sinks thin. Finale should do schema and safety work before the sink path, while the sink should focus on transport and serialization.
