## 2026-02-28 12:03:59 PST

- Updated `plans/PRD/PLAN.md` to include embedded sub-events in V1 while preserving the one-primary-event emission model.
- Clarified sub-events are milestone-oriented, bounded, and budget-aware for long-running / LLM-heavy request lifecycles.
- Updated `plans/IMPL/PLAN.md` to include sub-event types, API surface (`event.subEvent()`), accumulation/storage, budget trimming, tier filtering, and verification updates.
- Kept out-of-band milestone emission as deferred work beyond V1.

## 2026-02-28 12:15:43 PST

- Rebalanced planning from OSS-process-heavy to product-first around rich logging outcomes and first-class LLM observability.
- Updated `plans/PRD/PLAN.md` with new appendices for product outcome contract, full V1 context taxonomy, LLM granularity contract (default embedded + optional out-of-band milestones), and compatibility/release/support commitments.
- Updated `plans/IMPL/PLAN.md` with new Phase 10-15 structure: dual showcase tracks (API + LLM), context taxonomy implementation, LLM granularity modes, OSS quality/docs/governance workstreams, release readiness, and maintenance policy.
- Expanded implementation verification to include queryability acceptance, full context-family assertions, and both LLM granularity paths.
- Added `plans/PRD/NOTES.md` appendix converting key decisions into explicit obligations to keep flexibility while preserving simplicity and self-hosted operator control.

## 2026-02-28 12:29:50 PST

- Completed Phase 0 infrastructure execution from `plans/IMPL/PLAN.md` with workspace-level lint/build/test/typecheck wiring validated.
- Added root ESLint flat config (`eslint.config.mjs`) and root lint dependencies (`eslint`, `@eslint/js`, `typescript-eslint`, `globals`) so existing package lint scripts now run successfully.
- Resolved initial lint blockers in placeholder files by removing/renaming unused symbols in `packages/test/src/test-sink.ts` and `packages/schema-zod/src/adapter.ts`.
- Updated package test scripts to `vitest run --passWithNoTests` across all five packages so Phase 0 CI-style verification can pass before Phase 1 test suites are introduced.
- Ran and passed: `pnpm lint`, `pnpm typecheck`, `pnpm build`, and `pnpm test` from the repository root after dependency install refresh.

## 2026-02-28 12:50:53 PST

- Completed Phase 1 + Phase 2 implementation in `@finalejs/core` by adding missing core type contracts and runtime scope management primitives.
- Extended `packages/core/src/types/index.ts` with `SubEvent` and `EventAPI.subEvent()` to align with the IMPL contract for embedded milestones.
- Added runtime modules under `packages/core/src/runtime/`:
  - `noop-scope.ts` for safe no-op fallback behavior
  - `lifecycle.ts` for `startScope()` / `endScope()` orchestration
  - `scope-manager.ts` for AsyncLocalStorage stack semantics with `getScope()`, `hasScope()`, and `withScope()`
- Exported runtime APIs through `packages/core/src/runtime/index.ts` and `packages/core/src/index.ts` so downstream phases can consume them directly.
- Added comprehensive Vitest coverage for Phase 1/2 in:
  - `packages/core/src/types/index.test.ts`
  - `packages/core/src/runtime/noop-scope.test.ts`
  - `packages/core/src/runtime/lifecycle.test.ts`
  - `packages/core/src/runtime/scope-manager.test.ts`
- Verified full workspace health with passing `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.

## 2026-02-28 12:58:47 PST

- Completed Phase 3 (Event Accumulation Layer) by adding `packages/core/src/accumulation/` modules for `EventStore`, `TimerManager`, `ErrorCapture`, and `AccumulationScope`.
- Implemented accumulation semantics and constraints:
  - scalar last-write behavior with additive numeric counters
  - array append with max-length caps
  - key/size/string limits and dropped-field tracking
  - embedded sub-event capture with count and per-sub-event field caps
- Wired runtime lifecycle to create `AccumulationScope` by default in `startScope()` while preserving explicit override support for test-controlled scopes.
- Exported accumulation API through `packages/core/src/accumulation/index.ts` and top-level `packages/core/src/index.ts`.
- Added comprehensive Phase 3 Vitest coverage:
  - `accumulation/event-store.test.ts`
  - `accumulation/timer-manager.test.ts`
  - `accumulation/error-capture.test.ts`
  - `accumulation/scope.test.ts`
  - plus runtime lifecycle coverage update for real-scope default behavior
- Verified workspace checks pass after implementation: `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.

## 2026-02-28 13:04:33 PST

- Verified and fixed a merge asymmetry bug in `packages/core/src/accumulation/event-store.ts`: scalar-to-array updates previously replaced the scalar and could drop historical context, while array-to-scalar accumulated.
- Updated `mergeValues()` so any array/scalar transition now normalizes both sides to arrays and appends consistently with max-length capping.
- Added regression coverage in `packages/core/src/accumulation/event-store.test.ts` (`preserves prior scalar value when incoming value is an array`) to lock expected accumulation semantics.
- Ran targeted verification with `pnpm --filter @finalejs/core test` (all core tests passing).

## 2026-02-28 13:10:03 PST

- Completed Phase 4 (Governance Layer) by adding `packages/core/src/governance/` with `field-registry.ts`, `schema-adapter.ts`, `validation.ts`, and module exports.
- Implemented `defineFields()` and `FieldRegistryStore` with `has/get/keys/queryNamespace` to enforce centralized field governance and namespace discovery.
- Implemented validation engine with strict/soft modes:
  - strict keeps values but reports unknown/type issues
  - soft drops invalid/unknown fields and reports dropped keys
- Integrated validation into `AccumulationScope.event.add()` (and namespaced `child().add()`), with backward-compatible pass-through when no field registry is configured.
- Added optional governance integration hooks in `ScopeOptions` (`fieldRegistry`, `validationMode`, `onValidationIssue`) and merged governance drops into flush receipts.
- Exported governance API from `packages/core/src/index.ts` for downstream phases/packages.
- Added comprehensive governance tests:
  - `governance/field-registry.test.ts`
  - `governance/schema-adapter.test.ts`
  - `governance/validation.test.ts`
  - updated `accumulation/scope.test.ts` for strict/soft/backward-compat integration behavior
- Verified workspace checks all pass: `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.

## 2026-02-28 13:28:41 PST

- Reviewed and addressed `setField` rollback concern in `packages/core/src/accumulation/event-store.ts`.
- Simplified `setField` to capture prior field state once (`previous`) and use it both for merge calculation and rollback, removing duplicate reads and making rollback intent explicit.
- Added explicit rollback regression tests in `packages/core/src/accumulation/event-store.test.ts`:
  - restores prior value when an existing key update exceeds `maxTotalSize`
  - deletes newly-added key when insert exceeds `maxTotalSize`
- Ran focused validation: `pnpm --filter @finalejs/core test` (all core tests passing).

## 2026-02-28 13:02:04 PST

- Reviewed whether planning docs should add helper support for custom or pre-existing logging platforms to improve extraction, prettification, and search of finale events.
- Confirmed current plans already cover core sink adapters and queryability outcomes, but do not yet explicitly define platform-focused DX helpers/playbooks for easier operator adoption.
- Recommendation direction: add a scoped “integration/query helper” track (formatters, field extraction recipes, query templates) without expanding core V1 runtime contracts.

## 2026-02-28 13:04:32 PST

- Applied the deferred package strategy to both plans by introducing `@finalejs/query-helpers` as post-V1 work that starts after core surface area is stable.
- Added explicit V1 forward-compatibility constraints now (stable canonical envelope, stable `_finale.*` metadata keys, sink preservation of canonical event structure) to reduce future migration risk when helpers launch.
- Updated implementation planning to include platform-oriented query fixtures and roadmap gating so future helper APIs can be additive instead of forcing instrumentation rewrites.
