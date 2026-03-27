import { describe, expect, it } from 'vitest';
import { assertFields } from '../assertions.js';
import { runLlmWorkflowShowcase } from './llm-workflow.fixture.js';
import { assertLlmWorkflowQueryability, assertSafetyGuardsHeld } from './queryability-contract.js';

describe('LLM workflow showcase', () => {
  it('success_emits_one_queryable_llm_workflow_event', async () => {
    const result = await runLlmWorkflowShowcase({
      scenario: 'answer_with_search_success',
      traceId: 'trace_llm_showcase_123',
      spanId: 'span_llm_showcase_123',
    });

    expect(result.workflow).toEqual({
      ok: true,
      answer: expect.stringContaining('Summary for org_42'),
    });
    expect(result.sink.allEvents()).toHaveLength(1);
    assertFields(result.event, {
      'service.name': 'assistant-runtime',
      'service.version': '1.0.0',
      'deployment.env': 'prod',
      'deployment.region': 'us-west-2',
      'trace.id': 'trace_llm_showcase_123',
      'span.id': 'span_llm_showcase_123',
      'workflow.id': 'wf_showcase_123',
      'workflow.name': 'support_answer',
      'workflow.trigger': 'chat_message',
      'workflow.outcome': 'success',
      'user.id': 'user_123',
      'org.id': 'org_42',
      'llm.provider': 'openai',
      'llm.model': 'gpt-4.1-mini',
      'llm.temperature': 0.2,
      'llm.tokens_in': 1650,
      'llm.tokens_out': 300,
      'tool.name': 'search',
      'tool.call_count': 1,
      'tool.result_count': 3,
    });
    expect(result.event?.fields['llm.cost_usd']).toBeCloseTo(0.0055, 10);
    expect(result.event?.timings['llm.plan']).toBeGreaterThanOrEqual(0);
    expect(result.event?.timings['tool.search']).toBeGreaterThanOrEqual(0);
    expect(result.event?.timings['llm.answer']).toBeGreaterThanOrEqual(0);
    expect(result.event?.subEvents?.map((subEvent) => subEvent.name)).toEqual([
      'llm.plan.generated',
      'tool.call.completed',
      'llm.answer.generated',
    ]);
  });

  it('tool_timeout_failure_captures_failure_location_from_one_event', async () => {
    const result = await runLlmWorkflowShowcase({
      scenario: 'tool_timeout_failure',
    });

    expect(result.workflow).toEqual({
      ok: false,
      reason: 'tool_timeout',
    });
    expect(result.sink.allEvents()).toHaveLength(1);
    assertFields(result.event, {
      'workflow.outcome': 'error',
      'failure.reason': 'tool_timeout',
      'tool.name': 'search',
      'tool.call_count': 1,
      'tool.error_count': 1,
      'error.class': 'ToolTimeoutError',
      'error.message': 'Search tool timed out for query "refund policy changes 2026"',
    });
    expect(result.event?.timings['llm.plan']).toBeGreaterThanOrEqual(0);
    expect(result.event?.timings['tool.search']).toBeGreaterThanOrEqual(0);
    expect(result.event?.timings['llm.answer']).toBeUndefined();
    expect(result.event?.subEvents?.map((subEvent) => subEvent.name)).toEqual([
      'llm.plan.generated',
      'tool.call.failed',
    ]);
    expect(result.event?.subEvents?.[1]?.fields).toEqual(
      expect.objectContaining({
        'tool.name': 'search',
        'failure.reason': 'tool_timeout',
      })
    );
    expect(
      result.event?.subEvents?.some((subEvent) => subEvent.name === 'llm.answer.generated')
    ).toBe(false);
  });

  it('prompt_text_is_hashed_before_reaching_the_sink', async () => {
    const rawPrompt = 'Summarize the release notes for the refund policy change.';
    const result = await runLlmWorkflowShowcase({
      scenario: 'answer_with_search_success',
      prompt: rawPrompt,
    });

    expect(result.event?.fields['llm.prompt_fingerprint']).toMatch(/^hash:/);
    expect(result.event?.fields['llm.prompt_fingerprint']).not.toBe(rawPrompt);
  });

  it('nested_helpers_can_enrich_the_same_scope_without_manual_scope_threading', async () => {
    const result = await runLlmWorkflowShowcase({
      scenario: 'answer_with_search_success',
    });

    assertFields(result.event, {
      'llm.provider': 'openai',
      'tool.name': 'search',
      'tool.call_count': 1,
      'tool.result_count': 3,
    });
    expect(result.event?.subEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'llm.plan.generated',
          fields: expect.objectContaining({ 'workflow.step': 'plan' }),
        }),
        expect.objectContaining({
          name: 'tool.call.completed',
          fields: expect.objectContaining({ 'workflow.step': 'search' }),
        }),
        expect.objectContaining({
          name: 'llm.answer.generated',
          fields: expect.objectContaining({ 'workflow.step': 'answer' }),
        }),
      ])
    );
  });

  it('queryability_questions_are_answerable_from_event_shape_alone', async () => {
    const successResult = await runLlmWorkflowShowcase({
      scenario: 'answer_with_search_success',
    });
    const failureResult = await runLlmWorkflowShowcase({
      scenario: 'tool_timeout_failure',
      workflowId: 'wf_showcase_failure',
      userId: 'user_456',
      orgId: 'org_77',
      featureFlags: ['enterprise-assistant'],
    });

    assertLlmWorkflowQueryability({
      successEvent: successResult.event,
      failureEvent: failureResult.event,
    });
    assertSafetyGuardsHeld(successResult.event, {
      hashedField: 'llm.prompt_fingerprint',
    });
  });
});
