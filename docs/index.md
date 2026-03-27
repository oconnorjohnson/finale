---
title: "Finale Docs"
---

# Finale Docs

Finale is a schema-governed instrumentation layer for TypeScript. It helps you accumulate one authoritative event for a request, workflow, or interaction instead of emitting many thin log lines and reconstructing meaning later.

## What Finale solves

- Normalize event fields through a registry instead of ad hoc string keys.
- Accumulate context over time inside a scope.
- Validate, redact, sample, and emit through a consistent pipeline.
- Support backend requests, long-running workflows, and linked interaction journeys with the same core API.

## Packages

- `@finalejs/core`: engine, scopes, validation, safety, sampling, Express middleware
- `@finalejs/schema-zod`: Zod adapter for field types
- `@finalejs/sink-console`: development console sink
- `@finalejs/sink-pino`: Pino sink adapter
- `@finalejs/test`: test sink and assertion helpers
- `@finalejs/convex`: Convex wrappers and canonical Convex field helpers

## Runtime surfaces

- `@finalejs/core`: Node-first root package with scope helpers and Express middleware
- `@finalejs/core/portable`: runtime-neutral subpath for explicit lifecycle integrations such as Convex

## Start here

- [Getting started overview](./getting-started/overview.md)
- [Installation](./getting-started/installation.md)
- [Quickstart](./getting-started/quickstart.md)
- [Mental model](./core/mental-model.md)

## Core topics

- [Field registry](./core/field-registry.md)
- [Scopes, events, and timers](./core/scopes-events-timers.md)
- [Validation](./core/validation.md)
- [Safety and redaction](./core/safety-redaction.md)
- [Sampling](./core/sampling.md)
- [Express integration](./core/express.md)
- [Metrics and drain](./core/metrics-and-drain.md)
- [Error capture](./core/error-capture.md)
- [Portable core](./core/portable.md)

## Package guides

- [Schema Zod](./packages/schema-zod.md)
- [Console sink](./packages/sink-console.md)
- [Pino sink](./packages/sink-pino.md)
- [Test utilities](./packages/test-utils.md)
- [Convex](./packages/convex.md)

## Workflow guides

- [Backend request flow](./guides/backend-request-flow.md)
- [Interaction journeys](./guides/interaction-journeys.md)
- [LLM workflows](./guides/llm-workflows.md)
- [Testing instrumentation](./guides/testing-instrumentation.md)
- [Convex functions](./guides/convex-functions.md)
- [Convex HTTP actions](./guides/convex-http-actions.md)
- [Queryability](./guides/queryability.md)
- [Release acceptance](./guides/release-acceptance.md)

## Reference

- [Core API](./reference/core-api.md)
- [Field definition reference](./reference/field-definition-reference.md)
- [Sampling tiers](./reference/sampling-tiers.md)
- [Sink behavior](./reference/sink-behavior.md)
- [Config gotchas](./reference/config-gotchas.md)

## Source of truth

The repo-level `docs/` tree is the primary user-facing documentation source. Older files under `packages/core/docs/showcases/` remain as legacy evidence and source material.
