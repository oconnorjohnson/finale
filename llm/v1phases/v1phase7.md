# V1 Phase 7: Sink Layer
## Timeline
| Sequence | Agent 1 | Agent 2 | Agent 3 | Agent 4 |
| --- | --- | --- | --- | --- |
| 1 | P7.S1 Queue/sink orchestration design | WAIT for Agent 1 to finish P7.S1 | WAIT for Agent 1 to finish P7.S1 | IDLE |
| 2 | P7.S2 Async queue core | P7.S3 Backpressure/drop/drain behavior | WAIT for Agent 1 to finish P7.S2 | P7.S5 Integration tests prep |
| 3 | P7.S4 Emission wiring into runtime/finale | WAIT for Agent 1 to finish P7.S2 | WAIT for Agent 2 to finish P7.S3 | WAIT for Agent 1 to finish P7.S4 |
| 4 | IDLE | IDLE | IDLE | P7.S5 Integration tests |

## Status
Pending

## Goal
Finish the end-to-end emission path so finalized events can be queued, dropped according to policy, drained on shutdown, and delivered to sinks.

## Current State
This phase is pending. `packages/core/src/accumulation/scope.ts` currently finalizes the event, applies governance/safety/sampling, and returns a `FlushReceipt`, but it does not emit the filtered event to a sink and always reports `emitted: false`. There is no implemented async queue, no backpressure policy runtime, and no real drain path yet.

## Entry Criteria
- `P6.S4` completed and the finalize/decision pipeline is stable.
- Sink and drain types from `P1` are already defined.

## Exit Criteria
- Core has a bounded async queue with configurable drop policy.
- Backpressure, queue drops, sink failures, and drain behavior are implemented.
- Scope finalization can hand events to the sink path and return accurate `FlushReceipt.emitted` values.
- Integration tests cover emitted, sampled-out, queue-drop, and sink-failure behavior.

## Sprint Breakdown
### P7.S1 Queue/sink orchestration design
- Sprint ID: `P7.S1`
- Owner: `Agent 1`
- Depends on: `P6.S4`
- Unblocks: `P7.S2`, `P7.S3`, `P7.S4`, `P8.S1`
- Objective: Define the core sink-runtime architecture before writing queue or engine code.
- Scope: Queue ownership, emission lifecycle, sink invocation boundary, drain semantics, and how `FlushReceipt` maps to actual emit outcomes.
- Deliverables: Concrete module plan for `packages/core/src/sink/` and final flush/emission handoff contract.
- Acceptance checks: Design leaves no ambiguity about when events are dropped, counted, emitted, retried, or drained.

#### P7.S1 Implementation Plan
##### Summary
- Preserve the existing synchronous finalize pipeline in `AccumulationScope.flush()` and add an async sink runtime behind it.
- Redefine `flush()` semantics as finalize + attempt queue admission. `flush()` must never wait for sink I/O.
- Keep standalone `AccumulationScope` behavior unchanged when no runtime is attached: finalize locally, store `lastFinalizedEvent`, return `emitted: false`.

##### Locked decisions
- `FlushReceipt.emitted` means the finalized event was accepted by the sink runtime queue, not that the sink finished I/O.
- `FlushReceipt.decision` remains the sampling decision only. Queue pressure and sink failures do not rewrite sampling metadata.
- Core does not retry `sink.emit()` failures. Failures are counted, the record is dropped, and the worker continues.
- V1 sink runtime is single-worker and serial. One in-flight `sink.emit()` at a time keeps ordering and drain semantics deterministic.
- Sink runtime ownership is process-wide per `Finale` instance, not per `Scope`.
- `drain()` closes queue admission, waits for queued work and any in-flight emit to finish, then calls optional `sink.drain()`.
- `drain({ timeoutMs })` rejects on timeout or `sink.drain()` failure. If `timeoutMs` is omitted, drain waits indefinitely.

##### Public API and type notes
- No public type shape change is required in `P7.S1` for `Sink`, `QueueConfig`, `DrainOptions`, `Finale`, or `FlushReceipt`.
- Public comments/docs should clarify that `FlushReceipt.emitted` is queue-admission success.
- Public comments/docs should clarify that `QueueConfig.dropPolicy` defaults to `drop-lowest-tier`, with fallback behavior equivalent to `drop-newest` when no lower-priority queued candidate exists.
- Queue-drop and sink-failure diagnosis stays in runtime observers, metrics, and tests rather than widening `FlushReceipt` during Phase 7.

##### Internal architecture contract
- `AccumulationScope` gains an internal `emitFinalizedEvent` option with contract:

```ts
type EmitFinalizedEvent = (
  event: FinalizedEvent,
  decision: SamplingDecision
) => { accepted: boolean; reason?: 'queue_full' | 'runtime_closed' };
```

- `AccumulationScope.flush()` contract becomes:
  1. Finalize the event.
  2. Run redaction, budget enforcement, sampling, and verbosity filtering exactly as today.
  3. If sampling decision is `DROP`, return `emitted: false` without touching the sink runtime.
  4. If an internal emitter exists, hand the filtered event plus sampling decision to it.
  5. Map `accepted: true` to `FlushReceipt.emitted = true`; otherwise `false`.
- Add internal `SinkRuntime` abstraction under `packages/core/src/sink/` with `enqueue(event, decision)` and `drain(options?)` plus optional observer hooks for queue drop, sink success, sink failure, and drain timeout.
- Add `packages/core/src/runtime/finale-internals.ts` with a `WeakMap<Finale, SinkRuntime>` registry so lifecycle code can resolve the runtime without widening the public `Finale` interface.
- `startScope(finale)` must create `AccumulationScope` with an emission callback when a sink runtime is registered; otherwise it should keep the current local-only behavior.

##### Module plan for `packages/core/src/sink/`
- `sink/types.ts`: internal queue item shape, runtime interface, enqueue result, observer types, and runtime state.
- `sink/async-queue.ts`: bounded FIFO queue primitive only. No sink I/O logic.
- `sink/drop-policy.ts`: pure policy helpers for `drop-newest`, `drop-oldest`, and `drop-lowest-tier`.
- `sink/runtime.ts`: queue ownership, worker loop, sink invocation boundary, runtime state machine, and drain logic.
- `sink/index.ts`: barrel exports for sink-runtime internals used by later phases.
- `runtime/finale-internals.ts`: `Finale` to `SinkRuntime` registry used by lifecycle/runtime wiring.

##### Queue and backpressure semantics
- Queue items must carry the finalized event, sampling tier, enqueue sequence number, and enqueue timestamp.
- `drop-newest`: reject the incoming event and leave the queue unchanged.
- `drop-oldest`: evict the oldest queued event and then append the incoming event.
- `drop-lowest-tier`: tier order is `KEEP_MINIMAL < KEEP_NORMAL < KEEP_DEBUG`.
- `drop-lowest-tier` algorithm:
  - If the queue contains a strictly lower-tier record than the incoming record, evict the oldest record from the lowest-tier cohort and accept the incoming record.
  - If all queued records are equal or higher tier than the incoming record, reject the incoming record.
  - This rejection path is the required fallback behavior equivalent to `drop-newest`.
- Sampling `DROP` records are never enqueued and never participate in backpressure selection.

##### Drain and failure semantics
- Runtime states are `running`, `draining`, and `drained`.
- Once `drain()` starts, new enqueue attempts must return `{ accepted: false, reason: 'runtime_closed' }`.
- Drain completion requires queue length `0`, no in-flight emit, and then successful resolution of optional `sink.drain()`.
- Normal `sink.emit()` failures are swallowed, reported through observer hooks, and must not crash the runtime worker.
- `sink.drain()` is only called during explicit runtime drain, never after every emitted event.
- Core keeps no retry buffer after `sink.emit()` failure.

##### Metrics and handoff contract
- `P7.S1` defines observer hook points so `P8.S2` can attach concrete metrics without redesign.
- Required event mapping:
  - sampled out: `eventsDropped++`, `eventsSampledOut++`
  - queue drop: `eventsDropped++`, `queueDrops++`
  - sink emit success: `eventsEmitted++`
  - sink emit failure: `eventsDropped++`, `sinkFailures++`
- `P7.S4` must wire `AccumulationScope.flush()` to this contract unchanged.

##### Agent handoff plan
- Agent 1 / `P7.S2`: implement `sink/types.ts`, `sink/async-queue.ts`, and the queue-facing portions of `sink/runtime.ts` to match the queue item and enqueue/drain contracts above.
- Agent 2 / `P7.S3`: implement drop-policy helpers, runtime observer callbacks, sink failure accounting, and drain timeout behavior without changing `FlushReceipt` semantics.
- Agent 1 / `P7.S4`: wire `AccumulationScope`, `runtime/lifecycle.ts`, and `runtime/finale-internals.ts` so successful queue admission sets `FlushReceipt.emitted = true` and sampled-out records remain `false`.
- Agent 4 / `P7.S5`: write integration coverage around queue admission, sampled-out events, queue overflow, sink failure swallowing, and drain shutdown behavior using the contracts above.

##### Required test scenarios
- A `KEEP_*` event with a registered runtime returns `emitted: true` immediately after queue admission, before sink I/O completes.
- A `DROP` sampling decision never touches the runtime and returns `emitted: false`.
- `drop-newest` rejects the incoming record when the queue is full.
- `drop-oldest` evicts the oldest queued record and admits the new record.
- `drop-lowest-tier` preserves a higher-tier incoming record and rejects equal/lower-tier incoming records when no strictly worse queued candidate exists.
- Sink `emit()` rejection increments failure accounting and does not stop later queued events from processing.
- `drain()` blocks new admissions, waits for queued work and one in-flight emit, then calls `sink.drain()`.
- `drain({ timeoutMs })` rejects on timeout and remaining queued events are considered lost by contract.
- `startScope(finale)` without a registered runtime preserves the current local-only finalize behavior.

##### Assumptions and defaults
- Default queue size remains `1000`.
- Default drop policy remains `drop-lowest-tier`.
- An array-backed queue is acceptable in V1 because `maxSize = 1000` keeps linear scans for tier selection reasonable.
- Ordering is deterministic only within one runtime worker, not across requests or multiple `Finale` instances.
- Durability remains out of scope for core. Users who need retries or stronger delivery guarantees should use stdout/collector-oriented sinks.

### P7.S2 Async queue core
- Sprint ID: `P7.S2`
- Owner: `Agent 1`
- Depends on: `P7.S1`
- Unblocks: `P7.S4`, `P8.S1`, `P8.S2`
- Objective: Implement the bounded async queue used by the sink layer.
- Scope: Queue data structure, enqueue/dequeue flow, async emit loop, and queue lifecycle management.
- Deliverables: `packages/core/src/sink/async-queue.ts` plus queue-focused tests.
- Acceptance checks: Events can be enqueued, processed asynchronously, and drained deterministically.

### P7.S3 Backpressure/drop/drain behavior
- Sprint ID: `P7.S3`
- Owner: `Agent 2`
- Depends on: `P7.S1`
- Unblocks: `P7.S4`, `P8.S2`, `P7.S5`
- Objective: Implement queue-full behavior and graceful shutdown semantics.
- Scope: `drop-newest`, `drop-oldest`, `drop-lowest-tier`, queue drop accounting, sink failure accounting, and drain timeout behavior.
- Deliverables: Backpressure policy logic, drain support, and related tests.
- Acceptance checks: Queue saturation and sink failures update metrics and receipts predictably without crashing callers.

### P7.S4 Emission wiring into runtime/finale
- Sprint ID: `P7.S4`
- Owner: `Agent 1`
- Depends on: `P7.S2`, `P7.S3`
- Unblocks: `P7.S5`, `P8.S1`, `P8.S2`, `P8.S3`, `P8.S4`
- Objective: Connect finalized events to the sink runtime so flush means more than local finalization.
- Scope: Scope-to-queue handoff, sink invocation, accurate `FlushReceipt.emitted`, sampled-out handling, and lifecycle integration.
- Deliverables: Emission-aware flush path and runtime/sink barrel exports.
- Acceptance checks: Successful keeps reach the sink path, dropped events do not, and receipts distinguish the two cases correctly.

### P7.S5 Integration tests
- Sprint ID: `P7.S5`
- Owner: `Agent 4`
- Depends on: `P7.S3`, `P7.S4`
- Unblocks: `P8.S5`, `P9.S5`, `P10.S4`
- Objective: Prove the sink layer works under real end-to-end scenarios.
- Scope: Queue success, sampled-out events, sink failure behavior, queue overflow, and drain/shutdown tests.
- Deliverables: Integration-oriented core tests that exercise queue plus flush plus sink behavior together.
- Acceptance checks: Tests cover success and failure modes, and root workspace checks continue to pass.

## Risks and Handoffs
- This is the first phase that turns `finale` from a pipeline of pure transforms into a runtime with real asynchronous delivery semantics.
- `P7.S4` is the hard handoff to Phase 8 because `createFinale`, metrics, and middleware are not credible until the engine can actually emit.

## Evidence / Validation
- Current gap is visible in `packages/core/src/accumulation/scope.ts`, where flush finalizes and filters but does not call a sink.
- The `Sink` and `Finale` contracts already exist in `packages/core/src/types/index.ts`, so this phase is implementation work rather than type-definition work.
- `pnpm test`, `pnpm typecheck`, and `pnpm lint` currently pass without any sink-layer runtime implementation, confirming the gap is still open.
