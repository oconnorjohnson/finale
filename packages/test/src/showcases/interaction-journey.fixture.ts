import type { FinalizedEvent, SamplingPolicy } from '@finalejs/core';
import { createFinale, defineFields, getScope, withScope } from '@finalejs/core';
import { zodType } from '@finalejs/schema-zod';
import { z } from 'zod';
import { createTestSink, type TestSink } from '../test-sink.js';

export type InteractionJourneyScenario =
  | 'notifications_success'
  | 'save_validation_error'
  | 'mixed_conversion_dataset';

type InteractionName =
  | 'settings.opened'
  | 'settings.notifications.clicked'
  | 'settings.preferences.saved';
type InteractionCategory = 'navigation' | 'selection' | 'submission';
type InteractionTarget = 'settings_entry' | 'notifications_email_toggle' | 'settings_save';
type ScreenSection = 'overview' | 'notifications';
type UiComponent = 'settings_nav' | 'notifications_toggle' | 'save_button';
type JourneyStepName = 'settings_open' | 'notification_select' | 'settings_save';
type InteractionOutcome = 'success' | 'error';
type InteractionError = 'validation_failed';

interface JourneyIdentity {
  journeyId: string;
  sessionId: string;
  userId: string;
  orgId: string;
  featureFlags: string[];
  serviceVersion: string;
}

interface JourneyStepDefinition {
  interactionName: InteractionName;
  interactionCategory: InteractionCategory;
  interactionTarget: InteractionTarget;
  screenSection: ScreenSection;
  uiComponent: UiComponent;
  journeyStep: JourneyStepName;
  journeyParentStep?: Exclude<JourneyStepName, 'settings_save'>;
  interactionOutcome: InteractionOutcome;
  interactionDurationMs: number;
  interactionError?: InteractionError;
  error?: Error;
}

export interface RunInteractionJourneyShowcaseOptions {
  scenario: InteractionJourneyScenario;
}

export interface InteractionJourneyShowcaseResult {
  sink: TestSink;
  events: FinalizedEvent[];
}

const showcaseSamplingPolicy: SamplingPolicy = {
  decide() {
    return {
      decision: 'KEEP_DEBUG',
      reason: 'interaction_journey_showcase',
    };
  },
};

class SettingsValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SettingsValidationError';
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
    'interaction.name': {
      type: zodType(
        z.enum([
          'settings.opened',
          'settings.notifications.clicked',
          'settings.preferences.saved',
        ])
      ),
      group: 'domain',
      sensitivity: 'safe',
      cardinality: 'medium',
      priority: 'must-keep',
    },
    'interaction.category': {
      type: zodType(z.enum(['navigation', 'selection', 'submission'])),
      group: 'domain',
      sensitivity: 'safe',
      cardinality: 'low',
      priority: 'must-keep',
    },
    'interaction.target': {
      type: zodType(
        z.enum(['settings_entry', 'notifications_email_toggle', 'settings_save'])
      ),
      group: 'domain',
      sensitivity: 'safe',
      cardinality: 'medium',
      priority: 'important',
    },
    'screen.name': {
      type: zodType(z.enum(['settings'])),
      group: 'domain',
      sensitivity: 'safe',
      cardinality: 'low',
      priority: 'important',
    },
    'screen.section': {
      type: zodType(z.enum(['overview', 'notifications'])),
      group: 'domain',
      sensitivity: 'safe',
      cardinality: 'low',
      priority: 'important',
    },
    'ui.component': {
      type: zodType(z.enum(['settings_nav', 'notifications_toggle', 'save_button'])),
      group: 'domain',
      sensitivity: 'safe',
      cardinality: 'medium',
      priority: 'important',
    },
    'journey.id': {
      type: zodType(z.string()),
      group: 'core',
      sensitivity: 'safe',
      cardinality: 'high',
      priority: 'must-keep',
    },
    'journey.step': {
      type: zodType(z.enum(['settings_open', 'notification_select', 'settings_save'])),
      group: 'core',
      sensitivity: 'safe',
      cardinality: 'low',
      priority: 'must-keep',
    },
    'journey.parent_step': {
      type: zodType(z.enum(['settings_open', 'notification_select']).optional()),
      group: 'core',
      sensitivity: 'safe',
      cardinality: 'low',
      priority: 'important',
    },
    'session.id': {
      type: zodType(z.string()),
      group: 'domain',
      sensitivity: 'safe',
      cardinality: 'high',
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
    'interaction.outcome': {
      type: zodType(z.enum(['success', 'error'])),
      group: 'domain',
      sensitivity: 'safe',
      cardinality: 'low',
      priority: 'must-keep',
    },
    'interaction.error': {
      type: zodType(z.enum(['validation_failed']).optional()),
      group: 'error',
      sensitivity: 'safe',
      cardinality: 'low',
      priority: 'important',
    },
    'interaction.duration_ms': {
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

function createSuccessSteps(): JourneyStepDefinition[] {
  return [
    {
      interactionName: 'settings.opened',
      interactionCategory: 'navigation',
      interactionTarget: 'settings_entry',
      screenSection: 'overview',
      uiComponent: 'settings_nav',
      journeyStep: 'settings_open',
      interactionOutcome: 'success',
      interactionDurationMs: 18,
    },
    {
      interactionName: 'settings.notifications.clicked',
      interactionCategory: 'selection',
      interactionTarget: 'notifications_email_toggle',
      screenSection: 'notifications',
      uiComponent: 'notifications_toggle',
      journeyStep: 'notification_select',
      journeyParentStep: 'settings_open',
      interactionOutcome: 'success',
      interactionDurationMs: 12,
    },
    {
      interactionName: 'settings.preferences.saved',
      interactionCategory: 'submission',
      interactionTarget: 'settings_save',
      screenSection: 'notifications',
      uiComponent: 'save_button',
      journeyStep: 'settings_save',
      journeyParentStep: 'notification_select',
      interactionOutcome: 'success',
      interactionDurationMs: 44,
    },
  ];
}

function createValidationErrorSteps(): JourneyStepDefinition[] {
  const [openStep, clickStep, saveStep] = createSuccessSteps();

  if (!openStep || !clickStep || !saveStep) {
    throw new Error('Expected settings journey success steps to be defined');
  }

  return [
    openStep,
    clickStep,
    {
      ...saveStep,
      interactionOutcome: 'error',
      interactionDurationMs: 51,
      interactionError: 'validation_failed',
      error: new SettingsValidationError('Notification email is required'),
    },
  ];
}

function createDropOffAfterOpenSteps(): JourneyStepDefinition[] {
  const [openStep] = createSuccessSteps();

  if (!openStep) {
    throw new Error('Expected settings open step to be defined');
  }

  return [openStep];
}

function createDropOffAfterClickSteps(): JourneyStepDefinition[] {
  const [openStep, clickStep] = createSuccessSteps();

  if (!openStep || !clickStep) {
    throw new Error('Expected settings open and click steps to be defined');
  }

  return [openStep, clickStep];
}

function createScenarioJourneys(
  scenario: InteractionJourneyScenario
): Array<{ identity: JourneyIdentity; steps: JourneyStepDefinition[] }> {
  if (scenario === 'notifications_success') {
    return [
      {
        identity: {
          journeyId: 'journey_settings_success_001',
          sessionId: 'session_settings_success_001',
          userId: 'user_123',
          orgId: 'org_42',
          featureFlags: ['settings-redesign'],
          serviceVersion: '1.1.0',
        },
        steps: createSuccessSteps(),
      },
    ];
  }

  if (scenario === 'save_validation_error') {
    return [
      {
        identity: {
          journeyId: 'journey_settings_validation_001',
          sessionId: 'session_settings_validation_001',
          userId: 'user_456',
          orgId: 'org_77',
          featureFlags: ['legacy-settings'],
          serviceVersion: '1.0.0',
        },
        steps: createValidationErrorSteps(),
      },
    ];
  }

  return [
    {
      identity: {
        journeyId: 'journey_settings_dataset_a',
        sessionId: 'session_settings_dataset_a',
        userId: 'user_101',
        orgId: 'org_42',
        featureFlags: ['settings-redesign'],
        serviceVersion: '1.1.0',
      },
      steps: createSuccessSteps(),
    },
    {
      identity: {
        journeyId: 'journey_settings_dataset_b',
        sessionId: 'session_settings_dataset_b',
        userId: 'user_102',
        orgId: 'org_42',
        featureFlags: ['settings-redesign'],
        serviceVersion: '1.1.0',
      },
      steps: createDropOffAfterOpenSteps(),
    },
    {
      identity: {
        journeyId: 'journey_settings_dataset_c',
        sessionId: 'session_settings_dataset_c',
        userId: 'user_201',
        orgId: 'org_77',
        featureFlags: ['legacy-settings'],
        serviceVersion: '1.0.0',
      },
      steps: createDropOffAfterClickSteps(),
    },
    {
      identity: {
        journeyId: 'journey_settings_dataset_d',
        sessionId: 'session_settings_dataset_d',
        userId: 'user_202',
        orgId: 'org_77',
        featureFlags: ['legacy-settings'],
        serviceVersion: '1.0.0',
      },
      steps: createValidationErrorSteps(),
    },
  ];
}

async function emitJourneyStep(
  finale: ReturnType<typeof createFinale>,
  identity: JourneyIdentity,
  step: JourneyStepDefinition
): Promise<void> {
  await withScope(finale, async () => {
    const scope = getScope();

    scope.event.add({
      'service.version': identity.serviceVersion,
      'interaction.name': step.interactionName,
      'interaction.category': step.interactionCategory,
      'interaction.target': step.interactionTarget,
      'screen.name': 'settings',
      'screen.section': step.screenSection,
      'ui.component': step.uiComponent,
      'journey.id': identity.journeyId,
      'journey.step': step.journeyStep,
      'session.id': identity.sessionId,
      'user.id': identity.userId,
      'org.id': identity.orgId,
      'feature.flags': identity.featureFlags,
      'interaction.outcome': step.interactionOutcome,
      'interaction.duration_ms': step.interactionDurationMs,
      ...(step.journeyParentStep ? { 'journey.parent_step': step.journeyParentStep } : {}),
      ...(step.interactionError ? { 'interaction.error': step.interactionError } : {}),
    });

    if (step.error) {
      scope.event.error(step.error);
    }
  });
}

export async function runInteractionJourneyShowcase(
  options: RunInteractionJourneyShowcaseOptions
): Promise<InteractionJourneyShowcaseResult> {
  const sink = createTestSink();
  const finale = createFinale({
    fields: createShowcaseFields(),
    sink,
    sampling: showcaseSamplingPolicy,
    validation: 'strict',
    defaults: {
      'service.name': 'web-app',
      'deployment.env': 'prod',
      'deployment.region': 'us-west-2',
    },
  });

  for (const journey of createScenarioJourneys(options.scenario)) {
    for (const step of journey.steps) {
      await emitJourneyStep(finale, journey.identity, step);
    }
  }

  await finale.drain();

  return {
    sink,
    events: sink.allEvents(),
  };
}
