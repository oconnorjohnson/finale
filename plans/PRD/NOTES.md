What the article is really saying (and what problem it’s attacking)

The core complaint in loggingsucks.com is not “your logger is slow” or “JSON vs text.” It’s that the unit of logging is wrong for modern systems: we still emit lots of tiny, context-poor lines optimized for writing, then try to debug by string searching across distributed services.

Their proposed shift is wide events / canonical log lines: build up a single, context-rich event over the lifetime of a request, then emit once at the end, so you can query production behavior like analytics (high cardinality + high dimensionality), not grep like an archaeologist.

They also argue OpenTelemetry is not a magic fix because it standardizes collection/export, but it doesn’t decide what business context you should capture.

And they address cost with tail sampling: decide what to keep after you know whether the request errored, was slow, involved VIPs, feature flags, etc.

State of logging libraries today
What’s “solved” (mostly table stakes now)

Structured logging (JSON/logfmt) and basic context/bindings exist everywhere (Node: pino child loggers; Go: zap fields; Java: MDC, etc.).

Request correlation patterns (request-id, trace-id) are common, and OTel’s logs spec formalizes correlation primitives (resource/span/trace context).

What’s still fractured (and matches the article’s pain)

Most ecosystems still encourage many small log statements, not “one event per request per service hop.”

Even when teams intend to add context, it’s inconsistent, risky (PII), or expensive (extra lookups), and no generic library can know what “business context” matters for your domain.

Wide events are a known idea (Brandur, Stripe canonical log lines, Honeycomb’s structured events pitch), but implementation is not a universal default.

Evidence that “library space” exists, but it’s niche

There are small OSS attempts that specifically implement canonical log lines by aggregating fields and emitting once (example: cannon for Go wrapping zap). That’s a hint that mainstream loggers don’t make this pattern effortless out of the box.

So… is there room for a new OSS library?
Yes, but only if it’s honest about what a library can and cannot fix

A new OSS library can credibly address:

An opinionated “wide-event builder” primitive

A request-scoped event object (per service hop) that’s easy to enrich throughout the lifecycle, then emitted once. This is basically what the article sketches in middleware form.

Tail sampling in-app (or integrated with the pipeline)

The article’s “keep errors/slow/VIP/flagged, sample the rest” logic is implementable as a reusable policy engine.

Schema governance

The hidden killer in “structured logs” is everyone naming fields differently. A library can enforce conventions (field registry, versioned schemas, compile-time typing in TS/Rust/Go, etc.).

PII + secrets guardrails

Automatic redaction/hashing policies, allowlists for high-cardinality identifiers, “no raw email ever” rules, and linting/CI checks.

Bridging to OpenTelemetry

Not “OTel will save you,” but: make the wide event map cleanly to OTel LogRecord attributes (and optionally link to trace/span) so you can export anywhere.

A new OSS library cannot actually solve (this is the part most projects lie about):

Choosing the right business context. The article explicitly says you have to decide what to capture; tooling won’t infer “subscription tier” or “cart value” for you.

Storage/query economics. Wide events only feel magical when you have a backend that can handle high-cardinality, high-dimensional data and querying well (the article name-drops columnar systems like ClickHouse/BigQuery conceptually). A library can’t pay your bill or redesign your org’s retention policy.

Org behavior. The biggest failure mode is social: people won’t maintain the schema, will sneak strings back in, will log PII in a hurry, or won’t instrument the important paths.

The real “gap” worth aiming at

If you build something new, the differentiator is not “yet another logger.”

It’s: a request-scoped event accumulator + schema/PII governance + tail-sampling policy engine + first-class OTel export.

Think of it as “wide events as a product surface,” with the boring parts automated:

field naming enforcement

safe high-cardinality IDs

one place to attach business context

one emission point

sane sampling defaults

That’s a real gap because mainstream loggers optimize for throughput and ergonomics of emitting lines, not for producing queryable events.

Bottom line

There is space for an OSS library, but it’s a narrow lane: you’re not competing with pino/zap/log4j as “logging.” You’re competing as an observability instrumentation pattern that happens to output logs/events.

If you market it as “fix logging,” it’ll die in the comments. If you market it as “make canonical log lines/wide events the default ergonomic path, with schema + safety + sampling,” you’ve got a plausible wedge.

I guess I should’ve mentioned, this would be specifically for typescript 
Got it. If this is TypeScript-first, the “space” isn’t for another logger (pino/winston already own that). The space is for a TS library that makes the wide-event / canonical log line pattern the default ergonomic path, because today that pattern is mostly a DIY architecture choice, not something your logger helps you do.

Where the TS ecosystem actually is right now

Structured logging is solved enough (pino is fast, supports bindings, serializers, redaction, transports). So “better JSON logging” is not a wedge.

Context propagation exists in Node via AsyncLocalStorage, and Node itself positions it as the preferred mechanism for request context.

OpenTelemetry in JS is uneven: traces and metrics are stable, logs are still “development” in the JS language status docs, and the Logs Bridge API package is explicitly “unstable/alpha.” That means “just use OTel logs” is not a clean foundation for a brand-new TS logging library yet.

What a new TS OSS library could realistically deliver

If you build something new, it should be a request-scoped event accumulator + governance + sampling, with adapters to existing loggers.

Concretely, a credible TS wedge looks like:

A request “event bag” (wide event builder)

API like event.add({ userId, plan, featureFlag }) anywhere in the call stack

Emit once at end: event.flush({ level, outcome, durationMs })

This directly targets the article’s complaint: “logs are too many, too thin.” (That’s a real ergonomic gap in TS land.)

Tail sampling policies in-process

“Keep if error”, “keep if > p95 latency”, “keep if VIP”, “sample successes at 1%”

This is implementable as a library feature (even if you later mirror it in the pipeline).

Schema and naming enforcement (TS-native)

A typed field registry that prevents usr_id vs userId drift

Optional: versioning, field deprecations, and CI lint rules

PII guardrails

Default denylist, allowlist of safe identifiers, hashing/redaction helpers

This is where a TS library can add real safety value compared to “just log JSON.”

Adapters, not replacement

Output to pino (or console) as the sink. Keep the hot path fast and reuse transports.

Hard truth: what a library cannot solve (and the article admits this)

Even a perfect TS library cannot:

Decide your business context for you (what matters is domain-specific).

Fix your storage/query backend economics. Wide events shine only if your backend can query high-dimensional, high-cardinality data well.

Force organizational discipline (schema stewardship, PII hygiene, instrumentation coverage).

So yes, the pain is real, but it’s not “solvable” purely by shipping npm i better-logger.

The biggest TS-specific constraint you have to design around

If you want this to be broadly adopted, you must be honest about runtime support:

Node.js: great target. AsyncLocalStorage makes request scope feasible.

Edge runtimes (Next.js Edge, Cloudflare Workers, etc.): AsyncLocalStorage is often unavailable or different, so you need a fallback pattern (explicit context passing or platform-specific storage). This is where many “contextual logging” dreams go to die.

Performance: request-context tracking has overhead; you should assume users will ask “how much does this cost me?” and have an answer.

So is there room?

Yes, but only in a narrow, valuable lane:
Build a TS library that makes canonical log lines / wide events effortless, typed, and safe, and that plugs into pino/winston rather than trying to replace them. OTel logs can be an export target later, but today in JS it’s not stable enough to bet the entire design on it.

If you pitch it as “a new logger,” it’s dead on arrival.
If you pitch it as “a wide-event instrumentation layer for TS that outputs to your existing logger,” that’s real space. 🧩

Yes, if the goal is “address the article’s issues” in TypeScript, a good library bundles #1–#5 as one coherent system.

But the key is that it’s not five random features, it’s one pipeline:

Wide-event accumulator (request-scoped event bag)

Tail-sampling policy (decide keep/drop after outcome/latency/etc.)

Schema governance (typed fields, naming, versions)

PII/secret guardrails (redaction/hashing/allowlists)

Adapters/sinks (pino/winston/console now; OTel later)

If you ship only #1, people will reinvent #2–#4 badly and blame your library. If you ship #1–#4 but skip #5, you’re asking teams to replace their logger and they won’t.

One caveat: even with all #1–#5, you still can’t “solve logging” universally because the hardest part is choosing the right domain context to capture. What you can solve is making it cheap, safe, and consistent to capture whatever the team decides matters.

Goal

Build a TypeScript OSS library that makes wide events (canonical log lines) the default, with tail sampling, schema governance, PII guardrails, and sinks/adapters to existing logging stacks.

It is not “a logger.” It is an instrumentation layer that outputs one enriched event per request (per service hop), plus optional additional events for specific sub-operations.

Core concepts and primitives
1) Event (wide event)

A single, structured record representing “what happened” for a request in one service hop.

Event shape (conceptual):

Identity: service name, version, environment, host, region

Correlation: requestId, traceId, spanId (if present)

Outcome: status, error class, retry info, exit reason

Timing: start timestamp, duration, key phase timings (optional)

Domain context: userId, orgId, feature flags, plan tier, endpoint, query intent, etc.

Diagnostics: selected debug fields, counts, sampled payload metadata (never raw secrets)

Schema metadata: schema version, field set identifier

2) Request scope

A per-request container that:

stores the current Event

provides a safe API for adding fields

tracks timing

ensures one flush at end

Mechanism: Node AsyncLocalStorage when available; fallback to explicit context passing (for edge runtimes).

3) Policy

A pluggable decision system that controls:

tail sampling

redaction rules

field allowlists/denylists

cardinality limits

emission thresholds (only emit if meaningful)

High-level architecture
A) Runtime layer (Context and Lifecycle)

Responsibilities

Create a request scope at the edge of the app (HTTP middleware, job processor wrapper, queue consumer wrapper).

Provide a “current scope” getter for deep code paths.

Handle scope propagation safely through async boundaries.

Modules

ScopeManager

Implementations:

NodeScopeManager using AsyncLocalStorage

PortableScopeManager requiring explicit scope passing

LifecycleHooks

startScope: initialize event with base fields

endScope: finalize outcome, compute duration, call pipeline, flush

Key design choices

Scopes must be nestable or at least resilient to nested async calls.

Scope creation should be cheap and avoid heavy allocations.

B) Event accumulation layer (Write-time ergonomics)

Responsibilities

Let any part of the request add context without immediately emitting logs.

Preserve a consistent merge strategy.

Prevent runaway payload size.

Modules

EventStore

Merge semantics: last-write-wins for scalar fields, capped lists for repeated items, counters for metrics-like fields.

Limits: max keys, max total size estimate, max list length.

Timers

start/stop named spans (not full tracing), just phase timings for the final event.

ErrorCapture

Normalize thrown values into structured error fields.

Record stack traces only under policy control.

Design constraints

Accumulation must not encourage dumping huge objects. The library should prefer summaries, hashes, and counts.

C) Governance layer (Schema, typing, and correctness)

This is the “TS superpower” section.

Responsibilities

Make field naming and shapes consistent across a codebase.

Make it hard to introduce junk fields, typos, or inconsistent casing.

Modules

Field Registry

A central declaration of allowed fields and their types.

Supports “namespaces” (http., db., auth., billing., feature.*).

Schema Versioning

Version stamps on events.

Deprecation support: warn in dev/test when writing deprecated fields.

Validation modes

Dev mode: strict, loud warnings or throw (configurable).

Prod mode: soft fail, drop invalid fields, increment internal counters.

Important reality check

This does not decide what business context matters. It enforces whatever your team declares.

D) Safety layer (PII, secrets, and cardinality control)

Responsibilities

Prevent the two classic failures:

leaking sensitive data

blowing up costs due to high-cardinality chaos

Modules

Redaction Engine

Rule-based redaction and hashing for known fields.

Pattern-based scanners for values (emails, tokens) as a last line of defense.

Cardinality Guard

Rules per field: allowed, hashed, bucketed, dropped.

Example: userId allowed, but raw URL query strings dropped or normalized.

Budget Enforcer

Hard cap on event size.

Priority system: core fields always keep, optional fields drop first.

Principle

Default posture should be conservative: “safe by default, opt in to risky detail.”

E) Tail-sampling and decision layer (Read-time economics)

Responsibilities

Decide whether to emit the event, and at what “verbosity tier.”

Modules

Sampling Policy Engine

Inputs: outcome, duration, endpoint, user cohort, feature flags, error type.

Outputs:

DROP

KEEP_MINIMAL (core fields only)

KEEP_NORMAL

KEEP_DEBUG (includes extra diagnostics fields)

Rule composition

Deterministic rules first (errors, slow requests).

Probabilistic sampling second (successes).

Key idea

Tail sampling is not just keep/drop. It’s often “keep, but minimal.”

F) Sink layer (Adapters, not replacement)

Responsibilities

Convert final Event into a record and hand it off to an existing emitter.

Modules

Sink interface

Minimal contract: emit(record)

Built-in sinks

Pino sink

Winston sink

Console sink (dev/testing)

Optional sinks

OpenTelemetry log export (when the JS logs story is stable enough for your needs)

HTTP/Batch sink (send events to a collector) only if you want a batteries-included mode

Design constraint

Sinks must be asynchronous-safe and failure-tolerant. If a sink fails, the app should not.

Cross-cutting concerns
Performance budget

Hot path operations must be O(1) merges and avoid deep cloning.

Event size estimation must be approximate and cheap.

Provide internal counters for:

fields dropped

redactions applied

schema violations

sampling outcomes

Multi-runtime support

Tier 1: Node servers (Express, Fastify, Nest, Next.js Node runtime)

Tier 2: Edge runtimes with explicit scope passing

Do not pretend one mechanism works everywhere. Make runtime choice explicit.

Developer experience

“Drop-in” integrations: middleware wrappers for HTTP and jobs.

Local debugging: optional pretty-print view of the single wide event.

Testing utilities: assertions like “this request produced these fields” without parsing log streams.

Operational migration path

Install and wrap request entry points, emit a wide event with only core http fields.

Add domain fields gradually via registry, starting with the top 5 debugging questions.

Turn on PII guardrails early.

Turn on tail sampling once you trust the event contents.

What success looks like

Teams stop sprinkling 200 tiny logs per request.

Debugging becomes “query the one event” rather than grep across shards.

Cost becomes controllable via tail sampling and verbosity tiers.

Field consistency becomes enforceable via TS registry and schema checks.

What it will not magically fix

If a team refuses to decide what domain context matters, you cannot infer it.

If the org’s storage/query backend is bad at high-cardinality event querying, wide events still hurt.

If people insist on logging raw payloads, no library saves them without strict policy and enforcement.

If you want, I can also outline a “minimum lovable OSS v1” scope (what to ship first so it’s actually adoptable) without sliding into code.

Hypothetical usage: 

```typescript
/**
 * Hypothetical usage example for a TS “wide event / canonical log line” library.
 * The library is an instrumentation layer that emits ONE enriched event per request,
 * then hands it off to your existing logger (pino here).
 */

import express from "express";
import pino from "pino";
import {
  createWideEvents,
  httpMiddleware,
  getScope,
  // optional helpers:
  // withScope,  // for non-HTTP entrypoints
} from "@wide-events/core";
import { pinoSink } from "@wide-events/sinks-pino";
import { z } from "zod";

// -----------------------------------------------------------------------------
// 1) Define schema and safety rules (typed + enforced)
// -----------------------------------------------------------------------------

const Fields = {
  // Core identity fields (often auto-populated by middleware)
  "service.name": z.string(),
  "deployment.env": z.enum(["dev", "staging", "prod"]),

  // Correlation
  "request.id": z.string(),
  "trace.id": z.string().optional(),

  // HTTP
  "http.route": z.string(),
  "http.method": z.string(),
  "http.status_code": z.number().int(),
  "http.duration_ms": z.number(),

  // Domain context
  "user.id": z.string().optional(),
  "user.is_vip": z.boolean().optional(),
  "org.id": z.string().optional(),
  "checkout.cart_value_cents": z.number().int().optional(),
  "feature.flags": z.array(z.string()).optional(),

  // Payment
  "payment.provider": z.enum(["stripe", "adyen"]).optional(),
  "payment.idempotency_key": z.string().optional(),
  "payment.charge_id": z.string().optional(),

  // Error normalization
  "error.class": z.string().optional(),
  "error.message": z.string().optional(),
  "error.stack": z.string().optional(), // often gated by policy
};

// Redaction policy: never allow raw secrets, and optionally hash certain fields.
const piiPolicy = {
  denyPatterns: [
    /authorization/i,
    /cookie/i,
    /set-cookie/i,
    /password/i,
    /token/i,
  ],
  fieldRules: {
    "user.id": { mode: "allow" }, // okay in your org
    "org.id": { mode: "allow" },
    "payment.idempotency_key": { mode: "hash" }, // reduce sensitivity + cardinality pain
  },
};

// Tail sampling policy: keep the interesting stuff, sample the boring stuff.
const samplingPolicy = {
  decide(record: any) {
    // Always keep errors
    if (record["error.class"]) return { decision: "KEEP_DEBUG" };

    // Keep slow requests
    if (record["http.duration_ms"] >= 1500) return { decision: "KEEP_NORMAL" };

    // Keep VIP traffic
    if (record["user.is_vip"]) return { decision: "KEEP_NORMAL" };

    // Otherwise sample successes at 1%
    return Math.random() < 0.01
      ? { decision: "KEEP_MINIMAL" }
      : { decision: "DROP" };
  },
  // Verbosity tiers control how much optional detail is included.
  tiers: {
    KEEP_MINIMAL: { include: ["core", "http", "correlation"] },
    KEEP_NORMAL: { include: ["core", "http", "correlation", "domain"] },
    KEEP_DEBUG: { include: ["core", "http", "correlation", "domain", "error", "diagnostics"] },
  },
};

// -----------------------------------------------------------------------------
// 2) Create the wide-event engine and attach a sink (adapters, not replacement)
// -----------------------------------------------------------------------------

const logger = pino({ level: "info" });

const wide = createWideEvents({
  schema: Fields,
  pii: piiPolicy,
  sampling: samplingPolicy,
  sink: pinoSink(logger),
  defaults: {
    "service.name": "web-api",
    "deployment.env": "prod",
  },
  validation: process.env.NODE_ENV === "production" ? "soft" : "strict",
});

// -----------------------------------------------------------------------------
// 3) Hook it into your HTTP framework
// -----------------------------------------------------------------------------

const app = express();
app.use(express.json());

// The middleware creates a request scope, starts the event, and flushes once at end.
app.use(
  httpMiddleware(wide, {
    // Add baseline fields from request early (still no emission).
    onRequest(scope, req) {
      scope.event.add({
        "http.route": req.path,
        "http.method": req.method,
        // request.id and trace.id could be inferred from headers too
      });

      // Optional: mark request start timers
      scope.timers.start("total");
    },

    // Called right before flush, after response status and duration are known.
    onResponse(scope, req, res) {
      scope.event.add({
        "http.status_code": res.statusCode,
        // duration is usually auto-computed, but you can also add explicit timing
      });
      scope.timers.end("total");
    },
  })
);

// -----------------------------------------------------------------------------
// 4) Example handler: adds domain context across layers, flush happens once
// -----------------------------------------------------------------------------

app.post("/api/checkout", async (req, res) => {
  const scope = getScope(); // pulls from AsyncLocalStorage (Node runtime)

  // Add “business context” as it becomes known.
  scope.event.add({
    "user.id": req.body.userId,
    "org.id": req.body.orgId,
    "checkout.cart_value_cents": req.body.cartValueCents,
    "feature.flags": req.body.featureFlags ?? [],
    "user.is_vip": Boolean(req.body.isVip),
  });

  // Time a sub-operation (stored in the final wide event under diagnostics)
  scope.timers.start("payment.authorize");

  try {
    // Imagine this calls Stripe, Adyen, etc.
    const charge = await authorizePayment({
      provider: "stripe",
      amountCents: req.body.cartValueCents,
      idempotencyKey: req.body.idempotencyKey,
    });

    scope.timers.end("payment.authorize");

    // Attach more details that you want queryable later.
    scope.event.add({
      "payment.provider": "stripe",
      "payment.idempotency_key": req.body.idempotencyKey, // hashed by policy
      "payment.charge_id": charge.id,
    });

    res.status(200).json({ ok: true, chargeId: charge.id });
  } catch (err: any) {
    scope.timers.end("payment.authorize");

    // Normalize errors into structured fields (policy may suppress stack in prod).
    scope.event.error(err, { includeStack: process.env.NODE_ENV !== "production" });

    // You can also add a domain reason code.
    scope.event.add({ "payment.provider": "stripe" });

    res.status(500).json({ ok: false });
  }

  // No logging call here.
  // The middleware flushes exactly once after the response is finished.
});

// -----------------------------------------------------------------------------
// 5) What gets emitted (conceptually)
// -----------------------------------------------------------------------------
// If sampled as KEEP_NORMAL/DEBUG, the sink gets one JSON record like:
//
// {
//   "service.name":"web-api",
//   "deployment.env":"prod",
//   "http.route":"/api/checkout",
//   "http.method":"POST",
//   "http.status_code":200,
//   "http.duration_ms":412,
//   "request.id":"...",
//   "trace.id":"...",
//   "user.id":"usr_123",
//   "user.is_vip":true,
//   "org.id":"org_9",
//   "checkout.cart_value_cents":2599,
//   "feature.flags":["new-checkout"],
//   "payment.provider":"stripe",
//   "payment.idempotency_key":"hash:...",
//   "payment.charge_id":"ch_...",
//   "timings":{"payment.authorize":153,"total":412}
// }
//
// If it’s a boring success and sampled DROP, nothing is emitted.
//
// -----------------------------------------------------------------------------

app.listen(3000, () => logger.info({ port: 3000 }, "listening"));

// Fake payment function for the example
async function authorizePayment(opts: {
  provider: "stripe" | "adyen";
  amountCents: number;
  idempotencyKey: string;
}) {
  // pretend external call
  return { id: `ch_${Math.random().toString(16).slice(2)}` };
}
```
Nice. .add() + .flush() is a clean mental model: “collect facts” then “commit the record.”

A high-level API shape that keeps that vibe (and stays TS-friendly) could look like this:

Core objects

event (request-scoped)

event.add(fields)
Adds typed fields into the wide event (with schema + PII + size/cardinality rules enforced).

event.flush(meta?)
Finalizes outcome/timings, runs tail-sampling, then emits (or drops) via the configured sink.

How it fits into real apps

In HTTP middleware you’d typically:

event.add(...) at request start (route/method/request id)

event.add(...) throughout the call chain (domain context)

event.flush(...) once at the end (status/duration/error)

Two ergonomic variants (both keep .add/.flush)

Implicit flush (middleware does it automatically)

You still call event.add() anywhere, and flush happens for you at response end.

Explicit flush (jobs/CLI/edge or special flows)

You create an event scope manually and call event.flush() yourself.

Small extra that pairs well with .add/.flush

event.error(err) as a convenience that just translates an exception into structured error fields (then you still flush once).

If you want, I can propose a “minimal lovable v1” public surface area (literally the few methods you expose and everything else stays internal) that preserves the simplicity of .add/.flush while still enabling schema, PII, sampling, and sinks.
Alright, let’s treat this like you’re designing a developer-facing product with an opinionated, low-friction API. I’m going to describe everything the library needs to provide and, where I’m confident, the shape of the interfaces (you’ll name them).

The north star is still the same: one wide event per request (per service hop), built incrementally via .add(), emitted once via .flush() (explicitly or by middleware).

0) The mental model you’re selling to devs
The promise

“Stop spraying 200 thin logs. Build one event that answers: who, what, where, why, how long, did it fail, and what mattered.”

The primitive

A request-scoped Event that behaves like:

a mutable map with strict rules (schema, redaction, budgets)

a lifecycle (start → accumulate → finalize → flush/drop)

a policy engine (sampling, verbosity tiers)

a bridge to existing sinks (pino/winston/console now, others later)

1) Core public surface area (what devs actually touch)

You want the smallest possible public API that still feels powerful. Everything else should be configurable but not constantly present in the hot path.

A) “Engine” / “Runtime” object

This is the configured instance devs install once at startup.

It should expose:

integration helpers (HTTP middleware, job wrappers)

scope access (get current event/scope)

configuration hooks (policies, schema registry, sinks)

diagnostics (internal counters, debug snapshots)

Think of it as: “the thing you pass around to integrate the system”.

B) Event object (request-scoped)

This is what people love: .add() + .flush().

At minimum, it needs:

add(fields, options?)

flush(meta?)

But developer-friendly means a few additional high leverage verbs:

Must-haves

add(fields)
Merge fields into the event, running schema + safety rules.

flush(meta?)
Finalize duration/outcome, run sampling decision, emit or drop.

Strongly recommended

error(err, options?)
Convert thrown values to structured error fields (class/message/stack/causes), respecting policy.

annotate(tagOrReason)
A tiny “breadcrumb” list (capped). Useful for telling a story without spamming logs.

metric(name, deltaOrValue) or “counter”/“gauge” semantics
Lets you keep “counts” inside the event without creating a metrics system.

timer.start(name) / timer.end(name)
Adds phase timings to the final event.

Advanced but worth it

child(namespaceOrPrefix)
Returns a view that auto-prefixes keys (db.*, auth.*) so devs don’t type string keys all day and don’t invent field names.

C) Scope (optional concept, but helpful)

Some teams like distinguishing “Event” vs “Scope” (scope includes timers, baggage, debug).

A developer-friendly pattern:

scope.event.add(...)

scope.timers.start(...)

…but you can also make event contain timers and keep scope invisible. Your call.

D) Scope access

Developers need two ways to get the current event:

Implicit (Node runtime)

getCurrent() returns the request’s event/scope (powered by AsyncLocalStorage).

Works anywhere in the call stack without thread-passing.

Explicit (Edge / constrained runtimes)

A withScope(ctx, fn) pattern (or similar) where the event is passed explicitly.

Developer-friendly means the library supports both without a philosophical war.

2) Schema and typing (the part that makes TS worth doing)

This is the backbone of “queryable logs” and “no random field chaos.”

A) Field registry

You need a single place to define:

allowed keys

types

semantic hints (PII risk, cardinality expectations, whether it’s “core” vs “optional”)

“namespace” ownership (http., db., payment.*, etc.)

Why it matters: without a registry, .add() becomes “accept anything,” which turns into a junk drawer.

B) Field groups / tiers

This is key for sampling/verbosity:

Core: always present (service/env/route/status/duration/requestId/traceId)

Domain: business context (userId/orgId/plan/feature flags)

Diagnostics: timings, breadcrumbs, small debug facts

Error: structured error fields

Sampling policies should be able to say:

“KEEP_MINIMAL = core only”

“KEEP_NORMAL = core + domain”

“KEEP_DEBUG = everything”

C) Validation modes

Make it ergonomic:

strict (dev/test): throw or loudly warn on unknown keys / wrong types

soft (prod): drop invalid fields, increment internal counters

D) Namespacing strategy (high confidence)

Let devs avoid key bikeshedding by giving them rails:

Encourage namespace.field_name keys (dot notation)

Offer helpers: event.http.add({ route, method }) or event.child("http").add(...)

You can keep the internal representation as a flat map; namespacing is mostly for human discipline and backend query sanity.

3) Safety and guardrails (PII + cost control)

This is the difference between “cool demo” and “something teams can ship to prod.”

A) Redaction and secrets defense

You need layers:

Field-level rules (best)

specific keys are: allow, drop, hash, mask, bucket

Pattern scanners (last resort)

detect likely tokens/emails/authorization headers in string values and redact

should be configurable because false positives happen

Value shaping helpers

“safe string” utilities: trim length, normalize whitespace, drop binary junk

B) Cardinality governance

If you don’t do this, the library will be blamed for exploding bills.

Per-field cardinality expectations:

user.id: allowed (but maybe hashed depending on org)

url.full: dangerous, should be normalized or dropped

http.route: good (low cardinality)

error.message: keep but length cap

arbitrary “payload”: never

C) Budget enforcement

Event payload must have a “budget”:

max keys

max string length

max list length

max estimated serialized size

And a priority system:

core fields never dropped

domain fields dropped before core

diagnostics dropped first

When drops happen, record a small internal marker like:

event.dropped_fields_count

event.drop_reason = "budget_exceeded"

So developers can see they’re hitting limits.

4) Tail sampling (your strongest “this is different” lever)
A) Sampling should happen at flush time

Sampling decisions need final knowledge:

did it error?

how long did it take?

is it VIP?

did it hit a risky feature flag?

did it trigger a retry?

So: accumulate freely, decide at the end.

B) Sampling outputs should not be just KEEP/DROP

Have decisions that map to verbosity tiers:

DROP

KEEP_MINIMAL

KEEP_NORMAL

KEEP_DEBUG

This is how you keep cost down without losing signal.

C) Sampling policy API (high confidence structure)

Developers should be able to write policies as:

a list of rules (first match wins)

with a default rule

Rules should have access to:

finalized event fields

computed duration

error presence and class

route name / operation

env

Rule outputs:

decision tier

optional “reason” recorded in event (for auditability)

5) Integrations (this is where adoption lives or dies)
A) HTTP integration (Express/Fastify/Nest/Next API routes)

A good integration does:

create scope + start event

attach base http fields

ensure flush even on thrown errors

capture status code

compute duration

bind request id / trace id if present

optionally support request-id generation

Also important:

do not require devs to manually flush in typical HTTP cases

but still allow manual flush if they want “early emit” (rare)

B) Background jobs (BullMQ, Temporal-ish, queue consumers, cron)

You need a wrapper that:

creates a new scope per job

adds job metadata (queue name, job id, attempt count)

flushes once per job execution

handles retries and marks attempts clearly

C) RPC / GraphQL

Provide hooks that understand operations:

operation name

resolver path (but watch cardinality)

client name/version if provided

D) “Manual scope” for libraries and CLIs

Offer a simple “run a function within a scope” helper:

create scope

set base identity fields

call user function

flush in finally

This makes it useful beyond web servers.

6) Sinks and adapters (5c done right)
A) Sink interface (minimal contract)

You want this tiny:

accept a finalized record (plus maybe a level)

return void or a promise

never throw into the app

B) Built-in sinks

At minimum:

pino adapter

winston adapter

console adapter (dev)

C) Transport decisions belong to the host logger

Do not rebuild transport ecosystems. Your record is the payload, not the transport.

D) Failure behavior

Sink failures must be non-fatal by default:

swallow with internal counters

optionally allow “fail open” vs “fail closed” in dev/test

7) Developer experience features (the glue that makes it pleasant)

These aren’t “nice to have.” They’re what makes devs feel safe adopting it.

A) Introspection/debugging mode

A way to see “what would this event look like” locally:

pretty-print the final event at flush

show drop/redaction summaries

show sampling decision + reason

show schema violations

B) Testing utilities

People will want to assert:

“this handler emitted fields X and did not emit PII”

“errors always produce error.class”

“VIP requests are kept”

So: a test sink that captures emitted records in memory, plus helper assertions.

C) Linting / build-time enforcement (huge UX win)

Because TS can help, but humans still type strings.

Options:

a lint rule that flags unknown keys in .add({ ... })

a “field registry export” that IDE autocomplete can use

warnings on ad-hoc string keys when a typed helper exists

D) Documentation generated from schema

If you keep a registry, you can auto-generate:

field dictionary

sample events

list of deprecated fields

This helps teams align.

8) Sharp edges you must design for (so the API doesn’t feel “haunted”)
A) Multiple flushes

What happens if dev calls .flush() twice?

best behavior: first flush wins, second is a no-op (with dev warning)

or: allow “flush checkpoints” but that complicates the promise of “one event”

I’d keep it strict: one flush per scope.

B) Partial / early flush

Sometimes you want early emit (e.g., streaming responses).
If you support it, make it explicit and rare:

flushPartial(reason) that emits a record flagged as partial and keeps scope open
But this is complexity. You can punt this to v2.

C) Nested scopes

Background job triggers HTTP call within same process, etc.
You need a policy:

either one scope at a time (last created wins)

or allow stack-like nesting
Nesting is safer, but more work.

D) Async context loss

Node AsyncLocalStorage is good but not magic across every boundary (certain libraries, edge runtimes).
You need:

escape hatch to pass scope explicitly

clear errors when getCurrent() is called without a scope (return a no-op event rather than throwing)

E) Privacy defaults

Default stance should be conservative:

no request/response bodies

no headers except allowlisted

no query string by default

Make “risky detail” an explicit opt-in.

9) A “developer friendly API binding” checklist

If you want devs to like it, the API should feel like:

Two things to learn: .add() and “it flushes once”

No mandatory plumbing in business logic: no passing loggers around

Autocompletion helps: namespaces/registry means fewer typos

Safe by default: PII and budgets protect them from themselves

Works with what they already use: pino/winston sinks

Debuggable: show why something was dropped/sampled/redacted

Testable: in-memory sink + assertions

10) Suggested “minimal lovable v1” (so you don’t boil the ocean)

If you want the smallest version that still “feels complete”:

Event: add, flush, error, timer, annotate

Node scope propagation (AsyncLocalStorage)

HTTP middleware for one framework (Express or Fastify)

Schema registry + strict/soft validation

PII field rules + basic budgets

Tail sampling tiers (DROP/MINIMAL/NORMAL/DEBUG)

Pino sink

Test sink + a couple of helper assertions

Debug mode that prints sampling + redaction + drop summaries

Everything else (edge runtime explicit scoping, extra sinks, lint rules, docs generation) can follow.

If you tell me which environment you want to optimize for first (Express/Fastify vs Next.js API routes vs workers), I can map this into a very clean “public API surface proposal” that shows exactly what objects exist, what methods they expose, and what configuration blocks you’ll want, still with zero code.
Yes. In fact, if this library adds latency by doing synchronous console writes in your request path, it failed the vibe check.

The way to make this work cleanly is to treat “where the event goes” as a sink/transport problem, and keep the library’s core job as “build one wide event and decide whether it’s worth keeping.”

On a backend server: how you avoid console-log latency

You support multiple emission strategies via sinks:

1) Stdout sink (classic)

Your library emits to pino/winston, which writes to stdout.

Shipping happens out-of-process (agent/sidecar/runtime) so your request thread doesn’t pay network latency.

This is the default for most production setups and it’s usually the lowest-friction.

2) Async network sink (direct-to-service, but non-blocking)

If someone wants “don’t touch stdout, ship to X directly,” you provide a sink that:

pushes records into a bounded in-memory queue

a background loop batches + sends (HTTP/gRPC/UDP) out-of-band

backpressure policy is explicit: drop newest, drop oldest, or drop low-priority tiers first

Key point: .flush() does not mean “do network I/O now.” It means “finalize and enqueue.”

3) Collector sink (best of both worlds)

The sink sends to a local collector (OTel Collector, vector, fluent-bit, etc.) over localhost.

Still async and low-latency, but more reliable than blasting the public internet from app code.

Tail sampling makes this much more practical

Because you’re emitting one event per request, you can do:

emit only errors, slow requests, VIP, flagged features

sample the rest hard
So even a network sink stays sane.

Client-side: yes, but it’s a separate mode

On the client, you typically do not want to “log” like a server. But you can support it with a client runtime that:

buffers events

applies aggressive sampling + PII rules

ships via sendBeacon/background fetch to your ingestion endpoint

never blocks UI

Also: client logs tend to be a privacy minefield, so “safe-by-default” needs to be even stricter.

What the library must provide to make this real

Sink interface that supports async + batching

Internal queue with bounded memory + drop policy

Flush semantics that mean “finalize + enqueue,” not “sync write”

Failure behavior (timeouts, retries, circuit breaker, fail-open)

Lifecycle hooks for serverless/edge shutdown (best-effort drain)

So: yes, it can absolutely work for people piping logs to a different service. You just design sinks so the expensive part happens off the hot path, and you make dropping/que
one important nuance: it’s less “cache before logging” and more “accumulate per-request, then enqueue for emission.”

The two storage layers

Per-request accumulation (in-memory, request-scoped)

While the request is running, your code calls .add() many times.

Those writes go into a request-local event bag (not a global cache).

Nothing is emitted yet.

Post-request emission buffer (process-wide queue)

On .flush(), the event is finalized (duration/outcome/error), tail-sampled, redacted, budgeted, and then:

either dropped, or

put onto a bounded queue for the sink to drain asynchronously (stdout, local collector, HTTP batch, etc.)

So the “cache” is really:

a short-lived request bag

plus an optional async shipping queue

Why this distinction matters

The request bag is what enables wide events and tail sampling (you can’t tail-sample if you emit immediately).

The shipping queue is what avoids latency (you don’t want network I/O or slow stdout on the hot path).

What it is not

It’s not a durable cache. If the process dies, queued logs can be lost unless the user chooses a durable transport (agent/sidecar or local collector).

It’s not a full “log pipeline.” It’s the app-side front end: capture → decide → hand off.

The punchline

Your library’s job is to make it trivially easy for app code to conglomerate context into one event, and then make emission cheap and policy-driven. Where it ultimately lands (console, vector, OTel Collector, Honeycomb, Datadog, etc.) is just a sink choice.

---

## Appendix: Decision-to-Obligation (Product Simplicity + LLM Flexibility)

This appendix converts design intent into delivery obligations so planning stays aligned with product essence.

### 1) Rich context is a product contract, not an implementation detail

Decision:
- finale should produce events that explain business outcomes, not only technical status.

Obligation:
- V1 planning and implementation must include first-class coverage for HTTP, identity/tenant, dependency operations, feature/release, LLM, error/retry, and runtime/deploy context.

### 2) LLM observability should be first-class and self-hostable

Decision:
- finale should be a go-to option for simple, infra-owned LLM observability.

Obligation:
- V1 must ship an LLM workflow showcase equal to the classic API showcase and include tests for step, tool, and token/cost visibility.
- The design should avoid hosted-platform coupling and preserve local operator control.

### 3) Simplicity-first default with explicit flexibility

Decision:
- one primary event remains the default mental model.
- teams can opt into out-of-band milestones when operationally necessary.

Obligation:
- optional milestone emission must be clearly opt-in and should not complicate base API ergonomics.
- docs must provide clear criteria for when to remain embedded versus when to emit milestones.

### 4) Queryability is the acceptance test

Decision:
- the success bar is whether operators can answer high-value questions without log archaeology.

Obligation:
- PRD and IMPL should define canonical query scenarios for both API and LLM workflows.
- verification should assert these scenarios directly (not only internal unit behavior).

### 5) Safety defaults are release-critical

Decision:
- PII and cardinality guardrails are part of the core value proposition.

Obligation:
- regressions in redaction, field safety posture, or budget controls should be treated as release-blocking defects.
- optional flexibility should never bypass safety by default.