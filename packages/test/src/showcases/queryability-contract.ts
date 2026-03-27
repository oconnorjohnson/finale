import type { FinalizedEvent } from '@finalejs/core';
import { expect } from 'vitest';
import { assertFields, assertNoField } from '../assertions.js';

export type ShowcaseTrack = 'api_request_flow' | 'llm_workflow' | 'interaction_journey';
export type QueryabilityTopology = 'single_event' | 'linked_events';

export type QueryabilityQuestionId =
  | 'incident_triage'
  | 'business_context_diagnosis'
  | 'dependency_or_tool_visibility'
  | 'retry_visibility'
  | 'llm_cost_and_token_visibility'
  | 'milestone_progression'
  | 'interaction_entry_frequency'
  | 'interaction_step_conversion'
  | 'interaction_drop_off_by_segment'
  | 'failure_localization'
  | 'safety_guards';

export interface QueryabilitySupport {
  supported: boolean;
  topology: QueryabilityTopology;
  canonicalFields: string[];
}

export interface QueryabilityRequirement {
  id: QueryabilityQuestionId;
  question: string;
  tracks: Record<ShowcaseTrack, QueryabilitySupport>;
}

export const QUERYABILITY_REQUIREMENTS: QueryabilityRequirement[] = [
  {
    id: 'incident_triage',
    question: 'Can an operator identify whether the request or workflow succeeded or failed?',
    tracks: {
      api_request_flow: {
        supported: true,
        topology: 'single_event',
        canonicalFields: [
          'request.id',
          'http.route',
          'http.method',
          'http.status_code',
          'request.outcome',
          'failure.reason',
          'error.class',
        ],
      },
      llm_workflow: {
        supported: true,
        topology: 'single_event',
        canonicalFields: [
          'workflow.id',
          'workflow.name',
          'workflow.outcome',
          'failure.reason',
          'error.class',
        ],
      },
      interaction_journey: {
        supported: true,
        topology: 'linked_events',
        canonicalFields: [
          'journey.id',
          'journey.step',
          'interaction.name',
          'interaction.outcome',
          'interaction.error',
          'error.class',
        ],
      },
    },
  },
  {
    id: 'business_context_diagnosis',
    question: 'Can the affected user, org, and feature cohort be identified from canonical fields?',
    tracks: {
      api_request_flow: {
        supported: true,
        topology: 'single_event',
        canonicalFields: ['user.id', 'org.id', 'feature.flags', 'checkout.cart_value_cents'],
      },
      llm_workflow: {
        supported: true,
        topology: 'single_event',
        canonicalFields: ['user.id', 'org.id', 'feature.flags', 'workflow.trigger'],
      },
      interaction_journey: {
        supported: true,
        topology: 'linked_events',
        canonicalFields: ['user.id', 'org.id', 'feature.flags', 'service.version'],
      },
    },
  },
  {
    id: 'dependency_or_tool_visibility',
    question: 'Can the dependent system or tool involved in the flow be identified?',
    tracks: {
      api_request_flow: {
        supported: true,
        topology: 'single_event',
        canonicalFields: ['payment.provider', 'payment.charge_id', 'timings.payment.authorize'],
      },
      llm_workflow: {
        supported: true,
        topology: 'single_event',
        canonicalFields: ['tool.name', 'tool.call_count', 'tool.result_count', 'tool.error_count'],
      },
      interaction_journey: {
        supported: false,
        topology: 'linked_events',
        canonicalFields: [],
      },
    },
  },
  {
    id: 'retry_visibility',
    question: 'Can the operator tell whether retries occurred?',
    tracks: {
      api_request_flow: {
        supported: true,
        topology: 'single_event',
        canonicalFields: ['retry.count'],
      },
      llm_workflow: {
        supported: false,
        topology: 'single_event',
        canonicalFields: [],
      },
      interaction_journey: {
        supported: false,
        topology: 'linked_events',
        canonicalFields: [],
      },
    },
  },
  {
    id: 'llm_cost_and_token_visibility',
    question: 'Can token and cost impact be queried from the primary event?',
    tracks: {
      api_request_flow: {
        supported: false,
        topology: 'single_event',
        canonicalFields: [],
      },
      llm_workflow: {
        supported: true,
        topology: 'single_event',
        canonicalFields: [
          'llm.provider',
          'llm.model',
          'llm.tokens_in',
          'llm.tokens_out',
          'llm.cost_usd',
        ],
      },
      interaction_journey: {
        supported: false,
        topology: 'linked_events',
        canonicalFields: [],
      },
    },
  },
  {
    id: 'milestone_progression',
    question: 'Can milestone progression be understood without separate thin logs?',
    tracks: {
      api_request_flow: {
        supported: false,
        topology: 'single_event',
        canonicalFields: [],
      },
      llm_workflow: {
        supported: true,
        topology: 'single_event',
        canonicalFields: [
          'sub_events',
          'timings.llm.plan',
          'timings.tool.search',
          'timings.llm.answer',
        ],
      },
      interaction_journey: {
        supported: true,
        topology: 'linked_events',
        canonicalFields: ['journey.id', 'journey.step', 'journey.parent_step'],
      },
    },
  },
  {
    id: 'interaction_entry_frequency',
    question: 'Can entry frequency for a product journey be counted from the event stream?',
    tracks: {
      api_request_flow: {
        supported: false,
        topology: 'single_event',
        canonicalFields: [],
      },
      llm_workflow: {
        supported: false,
        topology: 'single_event',
        canonicalFields: [],
      },
      interaction_journey: {
        supported: true,
        topology: 'linked_events',
        canonicalFields: ['interaction.name', 'journey.id', 'journey.step'],
      },
    },
  },
  {
    id: 'interaction_step_conversion',
    question: 'Can conversion between interaction steps be counted from canonical events?',
    tracks: {
      api_request_flow: {
        supported: false,
        topology: 'single_event',
        canonicalFields: [],
      },
      llm_workflow: {
        supported: false,
        topology: 'single_event',
        canonicalFields: [],
      },
      interaction_journey: {
        supported: true,
        topology: 'linked_events',
        canonicalFields: ['journey.id', 'journey.step', 'journey.parent_step'],
      },
    },
  },
  {
    id: 'interaction_drop_off_by_segment',
    question: 'Can drop-off be segmented by org, feature flag, and release cohort?',
    tracks: {
      api_request_flow: {
        supported: false,
        topology: 'single_event',
        canonicalFields: [],
      },
      llm_workflow: {
        supported: false,
        topology: 'single_event',
        canonicalFields: [],
      },
      interaction_journey: {
        supported: true,
        topology: 'linked_events',
        canonicalFields: [
          'org.id',
          'feature.flags',
          'service.version',
          'journey.id',
          'journey.step',
        ],
      },
    },
  },
  {
    id: 'failure_localization',
    question: 'Can the failing stage or step be identified from the canonical event model?',
    tracks: {
      api_request_flow: {
        supported: true,
        topology: 'single_event',
        canonicalFields: ['failure.reason', 'error.class', 'error.message'],
      },
      llm_workflow: {
        supported: true,
        topology: 'single_event',
        canonicalFields: ['failure.reason', 'error.class', 'error.message', 'sub_events'],
      },
      interaction_journey: {
        supported: true,
        topology: 'linked_events',
        canonicalFields: [
          'interaction.outcome',
          'interaction.error',
          'error.class',
          'error.message',
        ],
      },
    },
  },
  {
    id: 'safety_guards',
    question: 'Do high-risk fields remain useful while still protected by default?',
    tracks: {
      api_request_flow: {
        supported: true,
        topology: 'single_event',
        canonicalFields: ['payment.idempotency_key'],
      },
      llm_workflow: {
        supported: true,
        topology: 'single_event',
        canonicalFields: ['llm.prompt_fingerprint'],
      },
      interaction_journey: {
        supported: true,
        topology: 'linked_events',
        canonicalFields: ['interaction.target'],
      },
    },
  },
];

export interface OutcomeExpectation {
  outcomeField: string;
  expectedOutcome: string;
  failureReason?: string;
  errorClass?: string;
  errorMessage?: string;
}

export interface SafetyExpectation {
  hashedField?: string;
  rawValue?: string;
  absentFields?: string[];
}

export interface ApiQueryabilityEvidence {
  successEvent: FinalizedEvent | undefined;
  failureEvent: FinalizedEvent | undefined;
}

export interface LlmQueryabilityEvidence {
  successEvent: FinalizedEvent | undefined;
  failureEvent: FinalizedEvent | undefined;
}

export interface InteractionJourneyQueryabilityEvidence {
  datasetEvents: FinalizedEvent[];
  failureEvent: FinalizedEvent | undefined;
}

export function assertCanonicalIdentityFields(
  event: FinalizedEvent | undefined,
  expected: Record<string, unknown>
): void {
  assertFields(event, expected);
}

export function assertOutcomeExplainsResult(
  event: FinalizedEvent | undefined,
  expectation: OutcomeExpectation
): void {
  const expectedFields: Record<string, unknown> = {
    [expectation.outcomeField]: expectation.expectedOutcome,
  };

  if (expectation.failureReason) {
    expectedFields['failure.reason'] = expectation.failureReason;
  }
  if (expectation.errorClass) {
    expectedFields['error.class'] = expectation.errorClass;
  }
  if (expectation.errorMessage) {
    expectedFields['error.message'] = expectation.errorMessage;
  }

  assertFields(event, expectedFields);
}

export function assertSafetyGuardsHeld(
  event: FinalizedEvent | undefined,
  expectation: SafetyExpectation
): void {
  if (!event) {
    throw new Error('assertSafetyGuardsHeld: expected an event but received undefined');
  }

  if (expectation.hashedField) {
    const value = event.fields[expectation.hashedField];

    if (typeof value !== 'string') {
      throw new Error(
        `assertSafetyGuardsHeld: expected "${expectation.hashedField}" to be a hashed string`
      );
    }
    if (!value.startsWith('hash:')) {
      throw new Error(
        `assertSafetyGuardsHeld: expected "${expectation.hashedField}" to start with "hash:"`
      );
    }
    if (expectation.rawValue && value === expectation.rawValue) {
      throw new Error(
        `assertSafetyGuardsHeld: expected "${expectation.hashedField}" not to equal the raw value`
      );
    }
  }

  for (const fieldName of expectation.absentFields ?? []) {
    assertNoField(event, fieldName);
  }
}

export function assertApiIncidentQueryability(evidence: ApiQueryabilityEvidence): void {
  assertCanonicalIdentityFields(evidence.successEvent, {
    'request.id': 'req_showcase_123',
    'user.id': 'user_123',
    'org.id': 'org_42',
    'request.outcome': 'success',
    'payment.provider': 'stripe',
    'retry.count': 1,
  });
  expectArrayField(evidence.successEvent, 'feature.flags', ['new-checkout']);
  expectTiming(evidence.successEvent, 'payment.authorize');

  assertOutcomeExplainsResult(evidence.failureEvent, {
    outcomeField: 'request.outcome',
    expectedOutcome: 'error',
    failureReason: 'payment_declined',
    errorClass: 'PaymentDeclinedError',
  });
  assertCanonicalIdentityFields(evidence.failureEvent, {
    'request.id': 'req_showcase_failure',
  });
}

export function assertLlmWorkflowQueryability(evidence: LlmQueryabilityEvidence): void {
  assertCanonicalIdentityFields(evidence.successEvent, {
    'workflow.id': 'wf_showcase_123',
    'workflow.name': 'support_answer',
    'workflow.outcome': 'success',
    'user.id': 'user_123',
    'org.id': 'org_42',
    'llm.provider': 'openai',
    'llm.model': 'gpt-4.1-mini',
    'tool.name': 'search',
    'tool.call_count': 1,
    'tool.result_count': 3,
    'llm.tokens_in': 1650,
    'llm.tokens_out': 300,
  });
  expectArrayField(evidence.successEvent, 'feature.flags', ['beta-assistant']);
  expectNumericFieldCloseTo(evidence.successEvent, 'llm.cost_usd', 0.0055, 10);
  expectSubEventNames(evidence.successEvent, [
    'llm.plan.generated',
    'tool.call.completed',
    'llm.answer.generated',
  ]);

  assertOutcomeExplainsResult(evidence.failureEvent, {
    outcomeField: 'workflow.outcome',
    expectedOutcome: 'error',
    failureReason: 'tool_timeout',
    errorClass: 'ToolTimeoutError',
  });
  assertCanonicalIdentityFields(evidence.failureEvent, {
    'workflow.id': 'wf_showcase_failure',
    'user.id': 'user_456',
    'org.id': 'org_77',
    'tool.name': 'search',
  });
  expectArrayField(evidence.failureEvent, 'feature.flags', ['enterprise-assistant']);

  const failedSubEvent = evidence.failureEvent?.subEvents?.[1];

  if (!failedSubEvent) {
    throw new Error('assertLlmWorkflowQueryability: expected a failed tool sub-event');
  }

  expect(failedSubEvent.fields).toEqual(
    expect.objectContaining({
      'tool.name': 'search',
      'failure.reason': 'tool_timeout',
    })
  );
}

export function assertInteractionJourneyQueryability(
  evidence: InteractionJourneyQueryabilityEvidence
): void {
  const org42Segment = (event: FinalizedEvent) =>
    matchesSegment(event, 'org_42', 'settings-redesign', '1.1.0');
  const org77Segment = (event: FinalizedEvent) =>
    matchesSegment(event, 'org_77', 'legacy-settings', '1.0.0');

  if (evidence.datasetEvents.length !== 9) {
    throw new Error(
      `assertInteractionJourneyQueryability: expected 9 dataset events but got ${evidence.datasetEvents.length}`
    );
  }

  expect(countEventsByName(evidence.datasetEvents, 'settings.opened')).toEqual(4);
  expect(journeyIdsForStep(evidence.datasetEvents, 'notification_select').size).toEqual(3);
  expect(journeyIdsForStep(evidence.datasetEvents, 'settings_save').size).toEqual(2);
  expect(
    countDropOffBetweenSteps(evidence.datasetEvents, 'settings_open', 'notification_select')
  ).toEqual(1);
  expect(
    countDropOffBetweenSteps(evidence.datasetEvents, 'notification_select', 'settings_save')
  ).toEqual(1);

  expect(
    evidence.datasetEvents.filter(
      (event) => event.fields['interaction.name'] === 'settings.opened' && org42Segment(event)
    )
  ).toHaveLength(2);
  expect(
    journeyIdsForStep(evidence.datasetEvents, 'notification_select', org42Segment).size
  ).toEqual(1);
  expect(journeyIdsForStep(evidence.datasetEvents, 'settings_save', org42Segment).size).toEqual(1);

  expect(
    evidence.datasetEvents.filter(
      (event) => event.fields['interaction.name'] === 'settings.opened' && org77Segment(event)
    )
  ).toHaveLength(2);
  expect(
    journeyIdsForStep(evidence.datasetEvents, 'notification_select', org77Segment).size
  ).toEqual(2);
  expect(journeyIdsForStep(evidence.datasetEvents, 'settings_save', org77Segment).size).toEqual(1);

  assertOutcomeExplainsResult(evidence.failureEvent, {
    outcomeField: 'interaction.outcome',
    expectedOutcome: 'error',
    errorClass: 'SettingsValidationError',
    errorMessage: 'Notification email is required',
  });
  assertCanonicalIdentityFields(evidence.failureEvent, {
    'journey.id': 'journey_settings_validation_001',
    'journey.step': 'settings_save',
    'interaction.error': 'validation_failed',
  });
}

function countEventsByName(events: FinalizedEvent[], interactionName: string): number {
  return events.filter((event) => event.fields['interaction.name'] === interactionName).length;
}

function journeyIdsForStep(
  events: FinalizedEvent[],
  step: string,
  predicate: (event: FinalizedEvent) => boolean = () => true
): Set<string> {
  return new Set(
    events
      .filter((event) => event.fields['journey.step'] === step)
      .filter(predicate)
      .map((event) => String(event.fields['journey.id']))
  );
}

function countDropOffBetweenSteps(
  events: FinalizedEvent[],
  currentStep: string,
  nextStep: string,
  predicate: (event: FinalizedEvent) => boolean = () => true
): number {
  const currentJourneys = journeyIdsForStep(events, currentStep, predicate);
  const nextJourneys = journeyIdsForStep(events, nextStep, predicate);

  return [...currentJourneys].filter((journeyId) => !nextJourneys.has(journeyId)).length;
}

function matchesSegment(
  event: FinalizedEvent,
  orgId: string,
  featureFlag: string,
  serviceVersion: string
): boolean {
  return (
    event.fields['org.id'] === orgId &&
    Array.isArray(event.fields['feature.flags']) &&
    event.fields['feature.flags'].includes(featureFlag) &&
    event.fields['service.version'] === serviceVersion
  );
}

function expectArrayField(
  event: FinalizedEvent | undefined,
  fieldName: string,
  expected: string[]
): void {
  if (!event) {
    throw new Error(`expectArrayField: expected an event for "${fieldName}"`);
  }

  expect(event.fields[fieldName]).toEqual(expected);
}

function expectTiming(event: FinalizedEvent | undefined, timingName: string): void {
  if (!event) {
    throw new Error(`expectTiming: expected an event for "${timingName}"`);
  }

  expect(event.timings[timingName]).toBeGreaterThanOrEqual(0);
}

function expectNumericFieldCloseTo(
  event: FinalizedEvent | undefined,
  fieldName: string,
  expected: number,
  precision: number
): void {
  if (!event) {
    throw new Error(`expectNumericFieldCloseTo: expected an event for "${fieldName}"`);
  }

  expect(event.fields[fieldName]).toBeCloseTo(expected, precision);
}

function expectSubEventNames(event: FinalizedEvent | undefined, expectedNames: string[]): void {
  if (!event) {
    throw new Error('expectSubEventNames: expected an event');
  }

  expect(event.subEvents?.map((subEvent) => subEvent.name)).toEqual(expectedNames);
}
