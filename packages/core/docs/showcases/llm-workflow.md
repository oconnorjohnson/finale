# LLM Workflow Showcase

This showcase demonstrates the V1 LLM workflow story finale is meant to make routine: one enriched event for a support-answer workflow that still answers operational questions after planning, tool use, token spend, and final outcome are known.

## What this proves

- The same core API works for non-HTTP orchestration code started with `withScope()`.
- Step, tool, model, token, and cost visibility fit inside the canonical primary-event model without introducing a separate LLM product surface.
- Embedded `subEvents` preserve milestone-level workflow detail while keeping one primary event authoritative for the final outcome.
- Prompt content can stay useful for correlation while still being hashed before it reaches the sink payload.

## End-to-end example

```ts
import pino from 'pino';
import { createFinale, defineFields, getScope, withScope } from '@finalejs/core';
import { zodType } from '@finalejs/schema-zod';
import { pinoSink } from '@finalejs/sink-pino';
import { z } from 'zod';

const fields = defineFields({
  'service.name': {
    type: zodType(z.string()),
    group: 'core',
    sensitivity: 'safe',
    cardinality: 'low',
    priority: 'must-keep',
  },
  'workflow.id': {
    type: zodType(z.string()),
    group: 'core',
    sensitivity: 'safe',
    cardinality: 'medium',
    priority: 'must-keep',
  },
  'workflow.name': {
    type: zodType(z.string()),
    group: 'core',
    sensitivity: 'safe',
    cardinality: 'low',
    priority: 'must-keep',
  },
  'workflow.trigger': {
    type: zodType(z.enum(['chat_message'])),
    group: 'core',
    sensitivity: 'safe',
    cardinality: 'low',
    priority: 'must-keep',
  },
  'workflow.outcome': {
    type: zodType(z.enum(['success', 'error'])),
    group: 'core',
    sensitivity: 'safe',
    cardinality: 'low',
    priority: 'must-keep',
  },
  'user.id': {
    type: zodType(z.string()),
    group: 'domain',
    sensitivity: 'pii',
    cardinality: 'high',
    priority: 'important',
    transform: 'allow',
  },
  'org.id': {
    type: zodType(z.string()),
    group: 'domain',
    sensitivity: 'safe',
    cardinality: 'medium',
    priority: 'important',
  },
  'feature.flags': {
    type: zodType(z.array(z.string())),
    group: 'domain',
    sensitivity: 'safe',
    cardinality: 'medium',
    priority: 'optional',
  },
  'llm.provider': {
    type: zodType(z.enum(['openai'])),
    group: 'domain',
    sensitivity: 'safe',
    cardinality: 'low',
    priority: 'important',
  },
  'llm.model': {
    type: zodType(z.enum(['gpt-4.1-mini'])),
    group: 'domain',
    sensitivity: 'safe',
    cardinality: 'low',
    priority: 'important',
  },
  'llm.tokens_in': {
    type: zodType(z.number().int().nonnegative()),
    group: 'domain',
    sensitivity: 'safe',
    cardinality: 'medium',
    priority: 'important',
  },
  'llm.tokens_out': {
    type: zodType(z.number().int().nonnegative()),
    group: 'domain',
    sensitivity: 'safe',
    cardinality: 'medium',
    priority: 'important',
  },
  'llm.cost_usd': {
    type: zodType(z.number().nonnegative()),
    group: 'domain',
    sensitivity: 'safe',
    cardinality: 'medium',
    priority: 'important',
  },
  'llm.prompt_fingerprint': {
    type: zodType(z.string()),
    group: 'domain',
    sensitivity: 'pii',
    cardinality: 'high',
    priority: 'important',
    transform: 'hash',
  },
  'tool.name': {
    type: zodType(z.enum(['search'])),
    group: 'domain',
    sensitivity: 'safe',
    cardinality: 'low',
    priority: 'important',
  },
  'tool.call_count': {
    type: zodType(z.number().int().nonnegative()),
    group: 'domain',
    sensitivity: 'safe',
    cardinality: 'low',
    priority: 'important',
  },
  'tool.result_count': {
    type: zodType(z.number().int().nonnegative()),
    group: 'domain',
    sensitivity: 'safe',
    cardinality: 'low',
    priority: 'important',
  },
  'failure.reason': {
    type: zodType(z.enum(['tool_timeout']).optional()),
    group: 'error',
    sensitivity: 'safe',
    cardinality: 'low',
    priority: 'important',
  },
  'error.class': {
    type: zodType(z.string().optional()),
    group: 'error',
    sensitivity: 'safe',
    cardinality: 'low',
    priority: 'must-keep',
  },
  'error.message': {
    type: zodType(z.string().optional()),
    group: 'error',
    sensitivity: 'pii',
    cardinality: 'medium',
    priority: 'must-keep',
    transform: 'allow',
  },
});

const finale = createFinale({
  fields,
  sink: pinoSink(pino()),
  defaults: {
    'service.name': 'assistant-runtime',
    'deployment.env': 'prod',
  },
});

await withScope(finale, async () => {
  const scope = getScope();

  scope.event.add({
    'workflow.id': 'wf_showcase_123',
    'workflow.name': 'support_answer',
    'workflow.trigger': 'chat_message',
    'user.id': 'user_123',
    'org.id': 'org_42',
    'feature.flags': ['beta-assistant'],
    'llm.prompt_fingerprint': 'Summarize the latest refund policy changes.',
  });

  try {
    const plan = await scope.timers.measure('llm.plan', async () => {
      scope.event.add({
        'llm.provider': 'openai',
        'llm.model': 'gpt-4.1-mini',
        'llm.tokens_in': 1200,
        'llm.tokens_out': 80,
        'llm.cost_usd': 0.0024,
      });
      scope.event.subEvent('llm.plan.generated', {
        'workflow.step': 'plan',
        'llm.model': 'gpt-4.1-mini',
        'llm.tokens_in': 1200,
        'llm.tokens_out': 80,
      });

      return { searchQuery: 'refund policy changes 2026' };
    });

    const searchResult = await scope.timers.measure('tool.search', async () => {
      scope.event.add({
        'tool.name': 'search',
        'tool.call_count': 1,
        'tool.result_count': 3,
      });
      scope.event.subEvent('tool.call.completed', {
        'workflow.step': 'search',
        'tool.name': 'search',
        'tool.result_count': 3,
      });

      return {
        snippets: [
          'Refunds remain eligible within 30 days of purchase.',
          'Subscription cancellations stop future billing immediately.',
        ],
      };
    });

    await scope.timers.measure('llm.answer', async () => {
      scope.event.add({
        'llm.tokens_in': 450,
        'llm.tokens_out': 220,
        'llm.cost_usd': 0.0031,
      });
      scope.event.subEvent('llm.answer.generated', {
        'workflow.step': 'answer',
        'llm.model': 'gpt-4.1-mini',
        'llm.tokens_out': 220,
      });
    });

    scope.event.add({
      'workflow.outcome': 'success',
    });

    return `${plan.searchQuery}: ${searchResult.snippets.join(' ')}`;
  } catch (error) {
    scope.event.add({
      'workflow.outcome': 'error',
      'failure.reason': 'tool_timeout',
    });
    scope.event.error(error);
    return undefined;
  }
});
```

## Representative success event

```json
{
  "fields": {
    "service.name": "assistant-runtime",
    "service.version": "1.0.0",
    "deployment.env": "prod",
    "deployment.region": "us-west-2",
    "trace.id": "trace_llm_showcase_123",
    "span.id": "span_llm_showcase_123",
    "workflow.id": "wf_showcase_123",
    "workflow.name": "support_answer",
    "workflow.trigger": "chat_message",
    "workflow.outcome": "success",
    "user.id": "user_123",
    "org.id": "org_42",
    "feature.flags": ["beta-assistant"],
    "llm.provider": "openai",
    "llm.model": "gpt-4.1-mini",
    "llm.temperature": 0.2,
    "llm.tokens_in": 1650,
    "llm.tokens_out": 300,
    "llm.cost_usd": 0.0055,
    "llm.prompt_fingerprint": "hash:...",
    "tool.name": "search",
    "tool.call_count": 1,
    "tool.result_count": 3
  },
  "timings": {
    "llm.plan": 5,
    "tool.search": 4,
    "llm.answer": 6
  },
  "subEvents": [
    {
      "name": "llm.plan.generated",
      "fields": {
        "workflow.step": "plan",
        "llm.model": "gpt-4.1-mini",
        "llm.tokens_in": 1200
      }
    },
    {
      "name": "tool.call.completed",
      "fields": {
        "workflow.step": "search",
        "tool.name": "search",
        "tool.result_count": 3
      }
    },
    {
      "name": "llm.answer.generated",
      "fields": {
        "workflow.step": "answer",
        "llm.model": "gpt-4.1-mini",
        "llm.tokens_out": 220
      }
    }
  ]
}
```

## Representative failure event

```json
{
  "fields": {
    "service.name": "assistant-runtime",
    "workflow.id": "wf_showcase_123",
    "workflow.name": "support_answer",
    "workflow.trigger": "chat_message",
    "workflow.outcome": "error",
    "user.id": "user_123",
    "org.id": "org_42",
    "feature.flags": ["beta-assistant"],
    "llm.provider": "openai",
    "llm.model": "gpt-4.1-mini",
    "llm.temperature": 0.2,
    "llm.tokens_in": 1200,
    "llm.tokens_out": 80,
    "llm.cost_usd": 0.0024,
    "llm.prompt_fingerprint": "hash:...",
    "tool.name": "search",
    "tool.call_count": 1,
    "tool.error_count": 1,
    "failure.reason": "tool_timeout",
    "error.class": "ToolTimeoutError",
    "error.message": "Search tool timed out for query \"refund policy changes 2026\""
  },
  "timings": {
    "llm.plan": 5,
    "tool.search": 4
  },
  "subEvents": [
    {
      "name": "llm.plan.generated",
      "fields": {
        "workflow.step": "plan",
        "llm.model": "gpt-4.1-mini",
        "llm.tokens_in": 1200
      }
    },
    {
      "name": "tool.call.failed",
      "fields": {
        "workflow.step": "search",
        "tool.name": "search",
        "failure.reason": "tool_timeout"
      }
    }
  ]
}
```

## Questions this one event answers

| Question | Fields to query |
| --- | --- |
| What happened for this workflow, and did it succeed? | `workflow.id`, `workflow.name`, `workflow.outcome`, `failure.reason`, `error.class`, `error.message` |
| Which user, org, or cohort was affected? | `user.id`, `org.id`, `feature.flags` |
| Which model and provider were involved? | `llm.provider`, `llm.model`, `llm.temperature` |
| Which step or tool consumed tokens and cost? | `llm.tokens_in`, `llm.tokens_out`, `llm.cost_usd`, `tool.name`, `tool.call_count`, `tool.result_count`, `subEvents` |
| Where did failure occur? | `subEvents[].name`, `subEvents[].fields.workflow.step`, `failure.reason`, `error.class` |

The default mode remains one primary event with embedded milestones. Teams get step-aware LLM visibility without switching to a separate workflow telemetry model, and prompt content remains out of the sink payload except for the hashed fingerprint.
