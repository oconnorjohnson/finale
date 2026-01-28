# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**finale** is a TypeScript library that makes wide events (canonical log lines) the default ergonomic path for backend observability. It is an **instrumentation layer**, not a logger replacement—it accumulates context throughout a request lifecycle and outputs one enriched event per request to existing loggers (pino, winston, etc.).

## Current Status

This project is in the **pre-implementation planning phase**. Comprehensive design documentation exists but no source code infrastructure has been created yet.

## Key Documentation

- **`plans/PRD/PLAN.md`** - Authoritative product requirements document (1,195 lines). Contains API surface, architecture, operational contracts, and V1 scope.
- **`plans/PRD/NOTES.md`** - Design rationale and decision log (1,415 lines). Contains context for why decisions were made.

Always reference PLAN.md for API design questions and NOTES.md for understanding design tradeoffs.

## Architecture

The library uses a 6-layer pipeline architecture:

1. **Runtime Layer** - Scope management via AsyncLocalStorage (Node) or explicit passing (edge)
2. **Event Accumulation Layer** - EventStore with merge semantics, timers, error capture
3. **Governance Layer** - Field registry with metadata, schema adapter interface, validation modes
4. **Safety Layer** - Redaction engine, cardinality guards, budget enforcement
5. **Tail-Sampling Layer** - 4-tier decisions: DROP / KEEP_MINIMAL / KEEP_NORMAL / KEEP_DEBUG
6. **Sink Layer** - Async queue with backpressure, adapters to pino/winston/console

## Planned Package Structure

```
@finalejs/core           # Core library (no validation runtime)
@finalejs/schema-zod     # Zod schema adapter
@finalejs/sink-pino      # Pino adapter
@finalejs/sink-console   # Dev/debug pretty-print
@finalejs/test           # Testing utilities
```

## Key Design Decisions

- **Scope failure mode**: Returns no-op scope by default (no crash). Optional strict mode throws.
- **Nesting**: Scopes are stackable. `getScope()` returns top of stack (innermost scope).
- **Schema validation**: Decoupled via adapter interface. Core has no Zod dependency.
- **Field metadata**: Each field declares group, sensitivity, cardinality, priority, transform rules.
- **Flush receipt**: `flush()` returns receipt with sampling decision, dropped/redacted fields.
- **Emission guarantee**: Best-effort, non-blocking. Durability is the sink's responsibility.

## Core API Pattern

```typescript
const scope = getScope();
scope.event.add({ 'user.id': userId, 'org.id': orgId });
scope.timers.start('payment');
// ... work ...
scope.timers.end('payment');
// Middleware auto-flushes ONE event at request end
```

## What This Library Is NOT

- Not a logger replacement (outputs to your existing logger)
- Not choosing business context for you (domain fields are your decision)
- Not solving storage economics (wide events need good backends)
- Not a durable queue (durability comes from sink/agent)
