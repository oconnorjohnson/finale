import { describe, expect, it } from 'vitest';
import { assertFields, assertNoField } from '../assertions.js';
import { runInteractionJourneyShowcase } from './interaction-journey.fixture.js';
import {
  assertInteractionJourneyQueryability,
  assertSafetyGuardsHeld,
} from './queryability-contract.js';

describe('Interaction journey showcase', () => {
  it('notifications_success_emits_linked_primary_events_with_canonical_fields', async () => {
    const result = await runInteractionJourneyShowcase({
      scenario: 'notifications_success',
    });

    expect(result.events).toHaveLength(3);
    expect(result.events.map((event) => event.fields['journey.step'])).toEqual([
      'settings_open',
      'notification_select',
      'settings_save',
    ]);
    expect(new Set(result.events.map((event) => event.fields['journey.id']))).toEqual(
      new Set(['journey_settings_success_001'])
    );
    expect(new Set(result.events.map((event) => event.fields['session.id']))).toEqual(
      new Set(['session_settings_success_001'])
    );

    assertFields(result.events[0], {
      'service.name': 'web-app',
      'service.version': '1.1.0',
      'deployment.env': 'prod',
      'deployment.region': 'us-west-2',
      'interaction.name': 'settings.opened',
      'interaction.category': 'navigation',
      'interaction.target': 'settings_entry',
      'screen.name': 'settings',
      'screen.section': 'overview',
      'ui.component': 'settings_nav',
      'journey.id': 'journey_settings_success_001',
      'journey.step': 'settings_open',
      'session.id': 'session_settings_success_001',
      'user.id': 'user_123',
      'org.id': 'org_42',
      'interaction.outcome': 'success',
    });

    assertFields(result.events[1], {
      'interaction.name': 'settings.notifications.clicked',
      'interaction.category': 'selection',
      'interaction.target': 'notifications_email_toggle',
      'screen.section': 'notifications',
      'ui.component': 'notifications_toggle',
      'journey.step': 'notification_select',
      'journey.parent_step': 'settings_open',
      'interaction.outcome': 'success',
    });

    assertFields(result.events[2], {
      'interaction.name': 'settings.preferences.saved',
      'interaction.category': 'submission',
      'interaction.target': 'settings_save',
      'ui.component': 'save_button',
      'journey.step': 'settings_save',
      'journey.parent_step': 'notification_select',
      'interaction.outcome': 'success',
    });
  });

  it('save_validation_error_captures_step_failure_on_the_save_event', async () => {
    const result = await runInteractionJourneyShowcase({
      scenario: 'save_validation_error',
    });
    const finalEvent = result.events[result.events.length - 1];

    expect(result.events).toHaveLength(3);
    assertFields(finalEvent, {
      'service.version': '1.0.0',
      'interaction.name': 'settings.preferences.saved',
      'journey.id': 'journey_settings_validation_001',
      'journey.step': 'settings_save',
      'interaction.outcome': 'error',
      'interaction.error': 'validation_failed',
      'error.class': 'SettingsValidationError',
      'error.message': 'Notification email is required',
    });
  });

  it('normalized_targets_keep_interaction_fields_queryable_without_raw_ui_labels', async () => {
    const result = await runInteractionJourneyShowcase({
      scenario: 'notifications_success',
    });

    expect(result.events.map((event) => event.fields['interaction.target'])).toEqual([
      'settings_entry',
      'notifications_email_toggle',
      'settings_save',
    ]);

    for (const event of result.events) {
      assertNoField(event, 'ui.label_raw');
    }
  });

  it('queryability_questions_are_answerable_from_linked_event_shape_alone', async () => {
    const datasetResult = await runInteractionJourneyShowcase({
      scenario: 'mixed_conversion_dataset',
    });
    const failureResult = await runInteractionJourneyShowcase({
      scenario: 'save_validation_error',
    });

    expect(datasetResult.sink.allEvents()).toHaveLength(9);
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
});
