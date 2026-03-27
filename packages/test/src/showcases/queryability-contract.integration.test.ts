import { describe, expect, it } from 'vitest';
import { runApiRequestFlowShowcase } from './api-request-flow.fixture.js';
import { runInteractionJourneyShowcase } from './interaction-journey.fixture.js';
import { runLlmWorkflowShowcase } from './llm-workflow.fixture.js';
import {
  QUERYABILITY_REQUIREMENTS,
  assertApiIncidentQueryability,
  assertInteractionJourneyQueryability,
  assertLlmWorkflowQueryability,
  assertSafetyGuardsHeld,
} from './queryability-contract.js';

describe('showcase queryability contract', () => {
  it('api_request_flow_satisfies_shared_queryability_contract', async () => {
    const successResult = await runApiRequestFlowShowcase({
      scenario: 'success_after_retry',
    });
    const failureResult = await runApiRequestFlowShowcase({
      scenario: 'payment_declined',
      requestId: 'req_showcase_failure',
      traceId: 'trace_showcase_failure',
      spanId: 'span_showcase_failure',
    });

    assertApiIncidentQueryability({
      successEvent: successResult.event,
      failureEvent: failureResult.event,
    });
    assertSafetyGuardsHeld(successResult.event, {
      hashedField: 'payment.idempotency_key',
    });
  });

  it('llm_workflow_satisfies_shared_queryability_contract', async () => {
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

  it('interaction_journey_satisfies_shared_queryability_contract', async () => {
    const datasetResult = await runInteractionJourneyShowcase({
      scenario: 'mixed_conversion_dataset',
    });
    const failureResult = await runInteractionJourneyShowcase({
      scenario: 'save_validation_error',
    });

    assertInteractionJourneyQueryability({
      datasetEvents: datasetResult.events,
      failureEvent: failureResult.events[failureResult.events.length - 1],
    });

    for (const event of datasetResult.events) {
      assertSafetyGuardsHeld(event, {
        absentFields: ['ui.label_raw'],
      });
    }
  });

  it('showcase_matrix_questions_map_cleanly_to_current_fixtures', () => {
    expect(QUERYABILITY_REQUIREMENTS.map((requirement) => requirement.id)).toEqual([
      'incident_triage',
      'business_context_diagnosis',
      'dependency_or_tool_visibility',
      'retry_visibility',
      'llm_cost_and_token_visibility',
      'milestone_progression',
      'interaction_entry_frequency',
      'interaction_step_conversion',
      'interaction_drop_off_by_segment',
      'failure_localization',
      'safety_guards',
    ]);

    const supportsInteractionDropOff = QUERYABILITY_REQUIREMENTS.find(
      (requirement) => requirement.id === 'interaction_drop_off_by_segment'
    );

    expect(supportsInteractionDropOff?.tracks.interaction_journey).toEqual({
      supported: true,
      topology: 'linked_events',
      canonicalFields: ['org.id', 'feature.flags', 'service.version', 'journey.id', 'journey.step'],
    });
    expect(
      QUERYABILITY_REQUIREMENTS.find((requirement) => requirement.id === 'retry_visibility')?.tracks
        .api_request_flow.supported
    ).toBe(true);
    expect(
      QUERYABILITY_REQUIREMENTS.find(
        (requirement) => requirement.id === 'llm_cost_and_token_visibility'
      )?.tracks.llm_workflow.supported
    ).toBe(true);
  });
});
