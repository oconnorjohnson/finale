---
title: "Queryability"
---

# Queryability

Finale is designed around operational questions, not just event emission. The point of the schema and field-governance model is that different workloads should still answer concrete questions with canonical fields.

## Two topologies

### Single-event topology

Use one authoritative primary event when the operation has one final outcome.

Examples:

- backend request flow
- LLM workflow
- Convex function execution

### Linked-event topology

Use multiple primary events linked by a stable key when the absence of later events is meaningful.

Example:

- interaction journeys linked by `journey.id`

## Queryability matrix

| Operational question | API request flow | LLM workflow | Interaction journey |
| --- | --- | --- | --- |
| Incident triage | `request.id`, `http.route`, `http.status_code`, `request.outcome`, `error.class` | `workflow.id`, `workflow.name`, `workflow.outcome`, `failure.reason`, `error.class` | `journey.id`, `journey.step`, `interaction.name`, `interaction.outcome`, `interaction.error` |
| Business-context diagnosis | `user.id`, `org.id`, `feature.flags` | `user.id`, `org.id`, `feature.flags`, `workflow.trigger` | `user.id`, `org.id`, `feature.flags`, `service.version` |
| Dependency or tool visibility | `payment.provider`, `payment.charge_id`, `timings.payment.authorize` | `tool.name`, `tool.call_count`, `tool.result_count`, `tool.error_count` | not the primary purpose of this topology |
| Retry visibility | `retry.count` | not modeled in the current fixture | not modeled in the current fixture |
| Milestone progression | not the primary purpose of this showcase | `subEvents`, `timings.llm.plan`, `timings.tool.search` | `journey.id`, `journey.step`, `journey.parent_step` |
| Interaction conversion or drop-off | not applicable | not applicable | `journey.id`, `journey.step`, `journey.parent_step`, `interaction.name` |
| Failure localization | `failure.reason`, `error.class`, `error.message` | `failure.reason`, `error.class`, `error.message`, `subEvents` | `interaction.outcome`, `interaction.error`, `error.class`, `error.message` |

## Why the topology matters

Backend requests and LLM workflows have one final authoritative answer. Interaction journeys do not. For journeys, missing later steps are part of the answer, so linked primary events are the right shape.

## Related docs

- [Backend request flow](./backend-request-flow.md)
- [LLM workflows](./llm-workflows.md)
- [Interaction journeys](./interaction-journeys.md)
