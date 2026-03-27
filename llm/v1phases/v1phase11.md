# V1 Phase 11: Convex Extension
## Timeline
| Sequence | Agent 1 | Agent 2 | Agent 3 | Agent 4 |
| --- | --- | --- | --- | --- |
| 1 | P11.S1 Core portability surface | P11.S2 `@finalejs/convex` package scaffold and API contracts | WAIT for Agent 2 to finish P11.S2 | WAIT for Agent 2 to finish P11.S2 |
| 2 | WAIT for Agent 3 and Agent 4 | WAIT for Agent 1 to finish P11.S1 | P11.S3 Convex query/mutation/action wrappers | P11.S4 HTTP action wrapper and Convex field set |
| 3 | P11.S5 Cross-package verification and docs/examples | WAIT for Agent 1 to finish P11.S5 | WAIT for Agent 1 to finish P11.S5 | WAIT for Agent 1 to finish P11.S5 |

## Status
Completed

## Goal
Add first-party Convex instrumentation support through a new `@finalejs/convex` package that wraps Convex function handlers and emits finale events without forcing Convex users to rebuild the core instrumentation model themselves.

## Current State
This phase is implemented. The workspace now includes a dedicated `packages/convex` package published as `@finalejs/convex`, a portable core subpath at `@finalejs/core/portable`, canonical Convex field definitions, wrapper coverage for Convex function handlers and HTTP actions, and repository-local docs/tests proving the integration shape without requiring a live Convex deployment.

## Entry Criteria
- `P8.S5` completed so the public engine surface is stable.
- `P9.S5` completed so package/test patterns are stable.
- `P10.S5` completed so showcase expectations and documentation posture are stable.

## Exit Criteria
- `@finalejs/convex` exists as a workspace package under `packages/convex`.
- Core exposes a runtime-safe import path for non-Node integrations.
- Convex wrappers support queries, mutations, actions, internal variants via the same wrapped-definition pattern, plus HTTP actions.
- Canonical Convex field definitions and usage docs exist.
- Workspace `lint`, `typecheck`, `build`, and `test` pass with the new package enabled.

## Sprint Breakdown
### P11.S1 Core portability surface
- Sprint ID: `P11.S1`
- Owner: `Agent 1`
- Depends on: `P8.S5`, `P9.S5`
- Unblocks: `P11.S2`, `P11.S3`, `P11.S4`, `P11.S5`
- Objective: Make core importable from Convex-compatible runtimes without loading Node-only modules.
- Scope: Add a portable subpath such as `@finalejs/core/portable`; export `createFinale`, runtime-neutral types, and explicit lifecycle helpers from `packages/core/src/runtime/lifecycle.ts`; keep the existing Node-first root export behavior intact.
- Deliverables: Portable entrypoint, export-map updates, and tests proving the portable path does not pull `node:async_hooks`.
- Acceptance checks: `@finalejs/convex` can depend on the portable surface without Node builtin resolution failures.
- Completion note: Implemented by `packages/core/src/portable.ts`, `packages/core/package.json`, `packages/core/tsup.config.ts`, and `packages/core/src/portable.test.ts`.

### P11.S2 `@finalejs/convex` package scaffold and API contracts
- Sprint ID: `P11.S2`
- Owner: `Agent 2`
- Depends on: `P9.S5`, `P11.S1`
- Unblocks: `P11.S3`, `P11.S4`, `P11.S5`
- Objective: Establish the new package and lock its public API before wrapper implementation.
- Scope: `packages/convex/package.json`, `tsconfig.json`, `tsup.config.ts`, `src/index.ts`, shared option types, and peer dependency posture for `convex`.
- Deliverables: Buildable workspace package named `@finalejs/convex`.
- Acceptance checks: The package participates cleanly in workspace pipelines and exposes the agreed wrapper names and types.
- Completion note: Implemented by `packages/convex/package.json`, `packages/convex/tsconfig.json`, `packages/convex/tsup.config.ts`, `packages/convex/src/index.ts`, and `packages/convex/src/types.ts`.

### P11.S3 Convex query/mutation/action wrappers
- Sprint ID: `P11.S3`
- Owner: `Agent 3`
- Depends on: `P11.S1`, `P11.S2`
- Unblocks: `P11.S5`
- Objective: Instrument standard Convex function handlers without reimplementing Convex registration APIs.
- Scope: `withFinaleQuery`, `withFinaleMutation`, and `withFinaleAction`; wrapped definitions preserve Convex object syntax and validators; wrapped user handlers receive `(ctx, args, scope)` so Convex code can enrich events explicitly without relying on implicit AsyncLocalStorage.
- Deliverables: Wrapper implementations and tests for public and internal constructor compatibility.
- Acceptance checks: Wrapped definitions remain valid inputs to `query`, `internalQuery`, `mutation`, `internalMutation`, `action`, and `internalAction`, while emitting finale events on success and error.
- Completion note: Implemented by `packages/convex/src/function-wrapper.ts`, `packages/convex/src/query-wrapper.ts`, `packages/convex/src/mutation-wrapper.ts`, `packages/convex/src/action-wrapper.ts`, and `packages/convex/src/function-wrapper.test.ts`.

### P11.S4 HTTP action wrapper and Convex field set
- Sprint ID: `P11.S4`
- Owner: `Agent 4`
- Depends on: `P11.S1`, `P11.S2`
- Unblocks: `P11.S5`
- Objective: Cover Convex HTTP entrypoints and define the canonical Convex field family.
- Scope: `withFinaleHttpAction`, `convexFields`, and documentation for canonical fields such as `convex.function.name`, `convex.function.kind`, `http.method`, `http.route`, `http.status_code`, and `http.duration_ms`.
- Deliverables: HTTP action wrapper, field registry fragment, and usage snippets for `convex/http.ts`.
- Acceptance checks: HTTP actions preserve request/response behavior while automatically capturing route, method, status, duration, and error context.
- Completion note: Implemented by `packages/convex/src/http-wrapper.ts`, `packages/convex/src/fields.ts`, `packages/convex/src/route.ts`, `packages/convex/src/http-wrapper.test.ts`, and `packages/convex/src/fields.test.ts`.

### P11.S5 Cross-package verification and docs/examples
- Sprint ID: `P11.S5`
- Owner: `Agent 1`
- Depends on: `P11.S2`, `P11.S3`, `P11.S4`
- Unblocks: Post-V1 Convex extension readiness
- Objective: Prove the package is usable and documented, not just type-correct.
- Scope: Package-level integration tests, example snippets covering query/mutation/action/http action flows, and workspace verification updates.
- Deliverables: Passing tests, example coverage, and final validation notes in the phase doc.
- Acceptance checks: Root `lint`, `typecheck`, `build`, and `test` pass; examples show how Convex users create a finale engine, merge `convexFields`, and wrap handlers.
- Completion note: Implemented by `packages/convex/src/convex.integration.test.ts`, `packages/core/docs/showcases/convex-extension.md`, `packages/core/docs/showcases/convex-http.md`, and the verification notes below.

## Public APIs and Types
- New core subpath: `@finalejs/core/portable`
- New core exported helpers on the portable path: `createFinale`, runtime-neutral types, `startScope`, `endScope`
- New package: `@finalejs/convex`
- New wrapper exports: `withFinaleQuery`, `withFinaleMutation`, `withFinaleAction`, `withFinaleHttpAction`, `convexFields`
- New shared option types: `ConvexFunctionInstrumentationOptions`, `ConvexHttpInstrumentationOptions`
- Handler contract for wrapped Convex definitions:
  - query/mutation/action handlers receive `(ctx, args, scope)`
  - HTTP action handlers receive `(ctx, request, scope)`

## Test Cases and Validation
- Portable core import does not resolve `node:async_hooks`.
- `withFinaleQuery` preserves `args`, `returns`, and object-syntax handler structure.
- `withFinaleMutation` and `withFinaleAction` flush exactly once on success and on thrown error.
- Wrapped handlers can add custom fields through the explicit `scope` parameter.
- `withFinaleHttpAction` captures method, route, status, and duration correctly.
- `convexFields` merges cleanly with consumer-defined field registries.
- Root workspace checks pass with `packages/convex` included.

## Risks and Handoffs
- The core portability track is the highest-risk item because the current root core surface is Node-oriented.
- Convex support must remain additive and must not fork the core event model or introduce Convex-specific event semantics.
- Wrapper design must preserve official Convex patterns instead of shadowing or replacing Convex's own `query`, `mutation`, `action`, and `httpAction` APIs.

## Implementation Evidence
- Portable core entrypoint:
  - `packages/core/src/portable.ts`
  - `packages/core/src/portable.test.ts`
- Convex package scaffold and exports:
  - `packages/convex/package.json`
  - `packages/convex/src/index.ts`
  - `packages/convex/src/types.ts`
- Query/mutation/action instrumentation:
  - `packages/convex/src/function-wrapper.ts`
  - `packages/convex/src/query-wrapper.ts`
  - `packages/convex/src/mutation-wrapper.ts`
  - `packages/convex/src/action-wrapper.ts`
- HTTP instrumentation and field family:
  - `packages/convex/src/http-wrapper.ts`
  - `packages/convex/src/fields.ts`
  - `packages/convex/src/route.ts`
- Verification and examples:
  - `packages/convex/src/contracts.test.ts`
  - `packages/convex/src/function-wrapper.test.ts`
  - `packages/convex/src/http-wrapper.test.ts`
  - `packages/convex/src/fields.test.ts`
  - `packages/convex/src/convex.integration.test.ts`
  - `packages/core/docs/showcases/convex-extension.md`
  - `packages/core/docs/showcases/convex-http.md`

## Evidence / Validation
- `@finalejs/core/portable` exists and exposes runtime-neutral lifecycle helpers without root-export breakage.
- `packages/convex` now exists under `packages` and is wired into the workspace.
- Query/mutation/action wrappers preserve object syntax by returning wrapped definition objects rather than replacing Convex constructors.
- HTTP action wrapping captures route, method, status, duration, and core error fields while preserving `Response` behavior.
- Convex reference posture for this phase follows the official docs:
  - Functions overview: https://docs.convex.dev/functions
  - HTTP actions: https://docs.convex.dev/functions/http-actions
  - Best practices: https://docs.convex.dev/understanding/best-practices/

## Verification
- `pnpm install` passed on 2026-03-26 after adding the new workspace package.
- `pnpm --filter @finalejs/core test` passed on 2026-03-26 with 30 test files and 155 tests passing, including portable entrypoint coverage.
- `pnpm --filter @finalejs/convex typecheck` passed on 2026-03-26.
- `pnpm --filter @finalejs/convex test` passed on 2026-03-27 with 5 test files and 18 tests passing, including integration coverage for success and error paths.
- `pnpm --filter @finalejs/convex lint` passed on 2026-03-27.
- `pnpm lint` passed on 2026-03-27.
- `pnpm typecheck` passed on 2026-03-27.
- `pnpm build` passed on 2026-03-27.
- `pnpm test` passed on 2026-03-27.

## Assumptions and Defaults
- Default package name is `@finalejs/convex`.
- Phase 11 is post-V1 additive work, not part of the existing V1 critical path.
- The phase covers runtime instrumentation wrappers, not Convex-backed storage, sync, or query-helper products.
- Internal Convex functions are supported by returning wrapped definition objects that remain compatible with Convex's public and internal constructors.
- Core portability is additive through a portable subpath, not a breaking rewrite of the existing Node-first root surface.
