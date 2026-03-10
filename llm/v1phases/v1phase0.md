# V1 Phase 0: Infrastructure Setup
## Timeline
| Sequence | Agent 1 | Agent 2 | Agent 3 | Agent 4 |
| --- | --- | --- | --- | --- |
| 1 | P0.S1 Root workspace/tooling | WAIT for Agent 1 to finish P0.S1 | IDLE | IDLE |
| 2 | P0.S2 Package scaffolding/build config | WAIT for Agent 1 to finish P0.S1 | P0.S3 Workspace verification gates prep | IDLE |
| 3 | IDLE | P0.S2 Package scaffolding/build config support | P0.S3 Workspace verification gates | WAIT for Agent 3 to finish P0.S3 |

## Status
Completed

## Goal
Establish the monorepo, package scaffolding, and workspace-level quality gates that every later V1 phase depends on.

## Current State
This phase was completed and the workspace-level tooling is in place. The repository now has `pnpm` workspaces, `turbo`, root TypeScript and ESLint configuration, package-level `tsup` and Vitest scripts, and passing root `lint`, `typecheck`, `build`, and `test` commands.

## Entry Criteria
- No prior phase dependency.
- Repository root was available for monorepo setup.
- Package set was defined as `core`, `schema-zod`, `sink-console`, `sink-pino`, and `test`.

## Exit Criteria
- Root workspace configuration exists and is valid.
- All five packages have package manifests and TypeScript build/test wiring.
- Root quality gates run successfully across the workspace.
- Phase 1 can rely on stable package boundaries and shared tooling.

## Sprint Breakdown
### P0.S1 Root workspace/tooling
- Sprint ID: `P0.S1`
- Owner: `Agent 1`
- Depends on: `None`
- Unblocks: `P0.S2`, `P0.S3`, `P1.S1`
- Objective: Establish the root monorepo and shared development toolchain.
- Scope: `pnpm-workspace.yaml`, `turbo.json`, root `package.json` scripts, root `tsconfig.json`, root ESLint and Prettier configuration.
- Deliverables: Workspace package discovery, turbo pipelines, shared scripts, strict TypeScript baseline, root lint formatting rules.
- Acceptance checks: Root `pnpm lint`, `pnpm typecheck`, `pnpm build`, and `pnpm test` are defined and executable.

### P0.S2 Package scaffolding/build config
- Sprint ID: `P0.S2`
- Owner: `Agent 1` with `Agent 2` support
- Depends on: `P0.S1`
- Unblocks: `P1.S1`, `P2.S1`, `P9.S1`, `P9.S2`, `P9.S3`, `P9.S4`
- Objective: Create the package layout and per-package build/test scaffolding.
- Scope: `packages/*/package.json`, package `tsconfig.json`, `tsup.config.ts`, source directories, export entrypoints.
- Deliverables: Five packages with consistent build and test scripts plus initial source entrypoints.
- Acceptance checks: Each package is discovered by the workspace and participates in turbo pipelines without missing-config failures.

### P0.S3 Workspace verification gates
- Sprint ID: `P0.S3`
- Owner: `Agent 3`
- Depends on: `P0.S1`, `P0.S2`
- Unblocks: `P1.S3`, all downstream implementation phases
- Objective: Prove the workspace can run cleanly before feature work begins.
- Scope: Validation of root scripts, package participation in turbo, and baseline no-test behavior.
- Deliverables: Passing verification run and documented baseline expectations for future phases.
- Acceptance checks: Root `lint`, `typecheck`, `build`, and `test` complete successfully across all packages.

## Risks and Handoffs
- Any inconsistency in package script names would have blocked later turbo-based verification, so the handoff to Phase 1 depended on script-name uniformity.
- Package scaffolding had to stabilize before downstream phases could add code without spending effort on tooling churn.

## Evidence / Validation
- Root workspace files exist: `pnpm-workspace.yaml`, `turbo.json`, `package.json`, `tsconfig.json`, `eslint.config.mjs`.
- Package scaffolding exists under `packages/core`, `packages/schema-zod`, `packages/sink-console`, `packages/sink-pino`, and `packages/test`.
- `llm/memory.md` records Phase 0 completion and passing workspace checks on 2026-02-28.
