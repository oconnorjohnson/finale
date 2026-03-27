import { setTimeout as delay } from 'node:timers/promises';
import type { FinalizedEvent, SamplingPolicy } from '@finalejs/core';
import { createFinale, defineFields, getScope, withScope } from '@finalejs/core';
import { zodType } from '@finalejs/schema-zod';
import { z } from 'zod';
import { createTestSink, type TestSink } from '../test-sink.js';

export type LlmWorkflowScenario = 'answer_with_search_success' | 'tool_timeout_failure';

interface LlmWorkflowInput {
  workflowId: string;
  userId: string;
  orgId: string;
  prompt: string;
  featureFlags: string[];
}

interface WorkflowPlan {
  searchQuery: string;
}

interface ToolSearchResult {
  snippets: string[];
}

interface WorkflowResponse {
  ok: boolean;
  answer?: string;
  reason?: string;
}

export interface LlmWorkflowShowcaseResult {
  workflow: WorkflowResponse;
  sink: TestSink;
  event: FinalizedEvent | undefined;
}

export interface RunLlmWorkflowShowcaseOptions {
  scenario: LlmWorkflowScenario;
  workflowId?: string;
  userId?: string;
  orgId?: string;
  prompt?: string;
  featureFlags?: string[];
  traceId?: string;
  spanId?: string;
}

const showcaseSamplingPolicy: SamplingPolicy = {
  decide() {
    return {
      decision: 'KEEP_DEBUG',
      reason: 'llm_workflow_showcase',
    };
  },
};

class ToolTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ToolTimeoutError';
  }
}

function createShowcaseFields() {
  return defineFields({
    'service.name': {
      type: zodType(z.string()),
      group: 'core',
      sensitivity: 'safe',
      cardinality: 'low',
      priority: 'must-keep',
    },
    'service.version': {
      type: zodType(z.string()),
      group: 'core',
      sensitivity: 'safe',
      cardinality: 'low',
      priority: 'important',
    },
    'deployment.env': {
      type: zodType(z.enum(['dev', 'staging', 'prod'])),
      group: 'core',
      sensitivity: 'safe',
      cardinality: 'low',
      priority: 'must-keep',
    },
    'deployment.region': {
      type: zodType(z.string()),
      group: 'core',
      sensitivity: 'safe',
      cardinality: 'low',
      priority: 'important',
    },
    'trace.id': {
      type: zodType(z.string().optional()),
      group: 'core',
      sensitivity: 'safe',
      cardinality: 'medium',
      priority: 'important',
    },
    'span.id': {
      type: zodType(z.string().optional()),
      group: 'core',
      sensitivity: 'safe',
      cardinality: 'medium',
      priority: 'important',
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
    'failure.reason': {
      type: zodType(z.enum(['tool_timeout']).optional()),
      group: 'error',
      sensitivity: 'safe',
      cardinality: 'low',
      priority: 'important',
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
    'llm.temperature': {
      type: zodType(z.number()),
      group: 'domain',
      sensitivity: 'safe',
      cardinality: 'low',
      priority: 'optional',
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
    'tool.error_count': {
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
}

function createWorkflowInput(options: RunLlmWorkflowShowcaseOptions): LlmWorkflowInput {
  return {
    workflowId: options.workflowId ?? 'wf_showcase_123',
    userId: options.userId ?? 'user_123',
    orgId: options.orgId ?? 'org_42',
    prompt: options.prompt ?? 'Summarize the latest refund policy changes for the customer.',
    featureFlags: options.featureFlags ?? ['beta-assistant'],
  };
}

function failureReasonFromError(error: unknown): 'tool_timeout' {
  if (error instanceof ToolTimeoutError) {
    return 'tool_timeout';
  }

  return 'tool_timeout';
}

async function generatePlan(_input: LlmWorkflowInput): Promise<WorkflowPlan> {
  const scope = getScope();

  return scope.timers.measure('llm.plan', async () => {
    await delay(5);

    scope.event.add({
      'llm.provider': 'openai',
      'llm.model': 'gpt-4.1-mini',
      'llm.temperature': 0.2,
      'llm.tokens_in': 1200,
      'llm.tokens_out': 80,
      'llm.cost_usd': 0.0024,
    });
    scope.event.subEvent('llm.plan.generated', {
      'workflow.step': 'plan',
      'llm.model': 'gpt-4.1-mini',
      'llm.tokens_in': 1200,
      'llm.tokens_out': 80,
      'llm.cost_usd': 0.0024,
    });

    return {
      searchQuery: 'refund policy changes 2026',
    };
  });
}

async function runSearchTool(
  plan: WorkflowPlan,
  scenario: LlmWorkflowScenario
): Promise<ToolSearchResult> {
  const scope = getScope();

  return scope.timers.measure('tool.search', async () => {
    scope.event.add({
      'tool.name': 'search',
      'tool.call_count': 1,
    });

    const startedAt = Date.now();
    await delay(4);

    if (scenario === 'tool_timeout_failure') {
      const durationMs = Math.max(0, Date.now() - startedAt);

      scope.event.add({
        'tool.error_count': 1,
      });
      scope.event.subEvent('tool.call.failed', {
        'workflow.step': 'search',
        'tool.name': 'search',
        'tool.duration_ms': durationMs,
        'failure.reason': 'tool_timeout',
      });

      throw new ToolTimeoutError(`Search tool timed out for query "${plan.searchQuery}"`);
    }

    const snippets = [
      'Refunds remain eligible within 30 days of purchase.',
      'Subscription cancellations stop future billing immediately.',
      'Enterprise exceptions require support approval.',
    ];
    const durationMs = Math.max(0, Date.now() - startedAt);

    scope.event.add({
      'tool.result_count': snippets.length,
    });
    scope.event.subEvent('tool.call.completed', {
      'workflow.step': 'search',
      'tool.name': 'search',
      'tool.duration_ms': durationMs,
      'tool.result_count': snippets.length,
    });

    return { snippets };
  });
}

async function generateAnswer(
  input: LlmWorkflowInput,
  searchResult: ToolSearchResult
): Promise<string> {
  const scope = getScope();

  return scope.timers.measure('llm.answer', async () => {
    await delay(6);

    scope.event.add({
      'llm.provider': 'openai',
      'llm.model': 'gpt-4.1-mini',
      'llm.tokens_in': 450,
      'llm.tokens_out': 220,
      'llm.cost_usd': 0.0031,
    });
    scope.event.subEvent('llm.answer.generated', {
      'workflow.step': 'answer',
      'llm.model': 'gpt-4.1-mini',
      'llm.tokens_in': 450,
      'llm.tokens_out': 220,
      'llm.cost_usd': 0.0031,
    });

    return `Summary for ${input.orgId}: ${searchResult.snippets.join(' ')}`;
  });
}

export async function runLlmWorkflowShowcase(
  options: RunLlmWorkflowShowcaseOptions
): Promise<LlmWorkflowShowcaseResult> {
  const sink = createTestSink();
  const finale = createFinale({
    fields: createShowcaseFields(),
    sink,
    sampling: showcaseSamplingPolicy,
    validation: 'strict',
    defaults: {
      'service.name': 'assistant-runtime',
      'service.version': '1.0.0',
      'deployment.env': 'prod',
      'deployment.region': 'us-west-2',
    },
  });
  const input = createWorkflowInput(options);

  const workflow = await withScope(finale, async () => {
    const scope = getScope();

    scope.event.add({
      'workflow.id': input.workflowId,
      'workflow.name': 'support_answer',
      'workflow.trigger': 'chat_message',
      'user.id': input.userId,
      'org.id': input.orgId,
      'feature.flags': input.featureFlags,
      'llm.prompt_fingerprint': input.prompt,
      ...(options.traceId ? { 'trace.id': options.traceId } : {}),
      ...(options.spanId ? { 'span.id': options.spanId } : {}),
    });

    try {
      const plan = await generatePlan(input);
      const toolResult = await runSearchTool(plan, options.scenario);
      const answer = await generateAnswer(input, toolResult);

      scope.event.add({
        'workflow.outcome': 'success',
      });

      return {
        ok: true,
        answer,
      } satisfies WorkflowResponse;
    } catch (error) {
      scope.event.add({
        'workflow.outcome': 'error',
        'failure.reason': failureReasonFromError(error),
      });
      scope.event.error(error);

      return {
        ok: false,
        reason: failureReasonFromError(error),
      } satisfies WorkflowResponse;
    }
  });

  await finale.drain();

  return {
    workflow,
    sink,
    event: sink.lastEvent(),
  };
}
