---
title: "LLM Workflows"
---

# LLM Workflows

This pattern uses one authoritative workflow event with embedded `subEvents` for milestones such as planning and tool use.

## When to use it

Use this shape for orchestration code where:

- the workflow has one final outcome
- you want model, token, and tool metrics on the final event
- milestone detail should stay attached to the same primary record

## Useful fields

- `workflow.id`
- `workflow.name`
- `workflow.trigger`
- `workflow.outcome`
- `llm.provider`
- `llm.model`
- `llm.tokens_in`
- `llm.tokens_out`
- `llm.cost_usd`
- `tool.name`
- `tool.call_count`
- `tool.result_count`
- `failure.reason`

## Recommended pattern

1. start the workflow with `withScope(...)`
2. add stable workflow and identity fields
3. use timers around planning and tools
4. use `subEvent(...)` for milestone markers
5. add final outcome and error fields
6. let Finale flush once at the end

## Prompt handling

Do not emit raw prompt text unless that is an intentional policy decision. A safer pattern is a hashed field such as `llm.prompt_fingerprint`.

## Representative shape

```json
{
  "fields": {
    "workflow.id": "wf_123",
    "workflow.outcome": "success",
    "llm.provider": "openai",
    "llm.model": "gpt-4.1-mini",
    "tool.call_count": 1,
    "tool.result_count": 3
  },
  "subEvents": [
    {
      "name": "llm.plan.generated"
    },
    {
      "name": "tool.call.completed"
    }
  ]
}
```

## Related docs

- [Mental model](../core/mental-model.md)
- [Safety and redaction](../core/safety-redaction.md)
- [Sampling](../core/sampling.md)
