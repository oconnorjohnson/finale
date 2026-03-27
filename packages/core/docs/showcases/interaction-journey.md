# Interaction Journey Showcase

This showcase demonstrates the V1 product-interaction story finale is meant to make routine: linked primary events for a settings journey that still answer entry-frequency, conversion, and drop-off questions without switching to a separate analytics pipeline.

## What this proves

- The same core API works for product-interaction instrumentation started with `withScope()`.
- `journey.id` can link multiple primary events into one queryable user journey when the flow spans several interaction steps.
- Canonical interaction, screen, and journey fields stay bounded and normalized instead of depending on raw UI labels.
- Step failure remains diagnosable from the same event model by combining `interaction.outcome`, `interaction.error`, and normalized error capture.

## Why this showcase uses linked events

The API request and LLM workflow showcases focus on one authoritative primary event. This showcase intentionally uses one primary event per step, linked by `journey.id`, because drop-off is defined by the absence of later steps. That is the modeling guidance from the PRD for longer-running product journeys, and it still uses the same core scope, field-registry, safety, and sink pipeline.

## End-to-end example

```ts
import pino from 'pino';
import { createFinale, defineFields, getScope, withScope } from '@finalejs/core';
import { zodType } from '@finalejs/schema-zod';
import { pinoSink } from '@finalejs/sink-pino';
import { z } from 'zod';

const fields = defineFields({
  'service.name': { type: zodType(z.string()), group: 'core', sensitivity: 'safe', cardinality: 'low', priority: 'must-keep' },
  'service.version': { type: zodType(z.string()), group: 'core', sensitivity: 'safe', cardinality: 'low', priority: 'important' },
  'journey.id': { type: zodType(z.string()), group: 'core', sensitivity: 'safe', cardinality: 'high', priority: 'must-keep' },
  'journey.step': { type: zodType(z.enum(['settings_open', 'notification_select', 'settings_save'])), group: 'core', sensitivity: 'safe', cardinality: 'low', priority: 'must-keep' },
  'interaction.name': { type: zodType(z.enum(['settings.opened', 'settings.notifications.clicked', 'settings.preferences.saved'])), group: 'domain', sensitivity: 'safe', cardinality: 'medium', priority: 'must-keep' },
  'interaction.category': { type: zodType(z.enum(['navigation', 'selection', 'submission'])), group: 'domain', sensitivity: 'safe', cardinality: 'low', priority: 'must-keep' },
  'interaction.target': { type: zodType(z.enum(['settings_entry', 'notifications_email_toggle', 'settings_save'])), group: 'domain', sensitivity: 'safe', cardinality: 'medium', priority: 'important' },
  'screen.name': { type: zodType(z.enum(['settings'])), group: 'domain', sensitivity: 'safe', cardinality: 'low', priority: 'important' },
  'screen.section': { type: zodType(z.enum(['overview', 'notifications'])), group: 'domain', sensitivity: 'safe', cardinality: 'low', priority: 'important' },
  'ui.component': { type: zodType(z.enum(['settings_nav', 'notifications_toggle', 'save_button'])), group: 'domain', sensitivity: 'safe', cardinality: 'medium', priority: 'important' },
  'session.id': { type: zodType(z.string()), group: 'domain', sensitivity: 'safe', cardinality: 'high', priority: 'important' },
  'user.id': { type: zodType(z.string()), group: 'domain', sensitivity: 'pii', cardinality: 'high', priority: 'important', transform: 'allow' },
  'org.id': { type: zodType(z.string()), group: 'domain', sensitivity: 'safe', cardinality: 'medium', priority: 'important' },
  'feature.flags': { type: zodType(z.array(z.string())), group: 'domain', sensitivity: 'safe', cardinality: 'medium', priority: 'optional' },
  'interaction.outcome': { type: zodType(z.enum(['success', 'error'])), group: 'domain', sensitivity: 'safe', cardinality: 'low', priority: 'must-keep' },
  'interaction.error': { type: zodType(z.enum(['validation_failed']).optional()), group: 'error', sensitivity: 'safe', cardinality: 'low', priority: 'important' },
  'interaction.duration_ms': { type: zodType(z.number().int().nonnegative()), group: 'domain', sensitivity: 'safe', cardinality: 'low', priority: 'important' },
  'error.class': { type: zodType(z.string().optional()), group: 'error', sensitivity: 'safe', cardinality: 'low', priority: 'must-keep' },
  'error.message': { type: zodType(z.string().optional()), group: 'error', sensitivity: 'pii', cardinality: 'medium', priority: 'must-keep', transform: 'allow' },
});

const finale = createFinale({
  fields,
  sink: pinoSink(pino()),
  defaults: {
    'service.name': 'web-app',
    'deployment.env': 'prod',
    'deployment.region': 'us-west-2',
  },
});

async function recordInteractionStep(step: {
  serviceVersion: string;
  journeyId: string;
  journeyStep: 'settings_open' | 'notification_select' | 'settings_save';
  interactionName: 'settings.opened' | 'settings.notifications.clicked' | 'settings.preferences.saved';
  interactionCategory: 'navigation' | 'selection' | 'submission';
  interactionTarget: 'settings_entry' | 'notifications_email_toggle' | 'settings_save';
  screenSection: 'overview' | 'notifications';
  uiComponent: 'settings_nav' | 'notifications_toggle' | 'save_button';
  sessionId: string;
  userId: string;
  orgId: string;
  featureFlags: string[];
  outcome: 'success' | 'error';
}) {
  await withScope(finale, async () => {
    const scope = getScope();

    scope.event.add({
      'service.version': step.serviceVersion,
      'journey.id': step.journeyId,
      'journey.step': step.journeyStep,
      'interaction.name': step.interactionName,
      'interaction.category': step.interactionCategory,
      'interaction.target': step.interactionTarget,
      'screen.name': 'settings',
      'screen.section': step.screenSection,
      'ui.component': step.uiComponent,
      'session.id': step.sessionId,
      'user.id': step.userId,
      'org.id': step.orgId,
      'feature.flags': step.featureFlags,
      'interaction.outcome': step.outcome,
    });
  });
}
```

## Representative completed-journey event

This is the final save event for a completed settings journey. The earlier open and click events share the same `journey.id`.

```json
{
  "fields": {
    "service.name": "web-app",
    "service.version": "1.1.0",
    "deployment.env": "prod",
    "deployment.region": "us-west-2",
    "journey.id": "journey_settings_success_001",
    "journey.step": "settings_save",
    "journey.parent_step": "notification_select",
    "session.id": "session_settings_success_001",
    "user.id": "user_123",
    "org.id": "org_42",
    "feature.flags": ["settings-redesign"],
    "interaction.name": "settings.preferences.saved",
    "interaction.category": "submission",
    "interaction.target": "settings_save",
    "screen.name": "settings",
    "screen.section": "notifications",
    "ui.component": "save_button",
    "interaction.outcome": "success",
    "interaction.duration_ms": 44
  }
}
```

## Representative failed-save event

```json
{
  "fields": {
    "service.name": "web-app",
    "service.version": "1.0.0",
    "deployment.env": "prod",
    "deployment.region": "us-west-2",
    "journey.id": "journey_settings_validation_001",
    "journey.step": "settings_save",
    "journey.parent_step": "notification_select",
    "session.id": "session_settings_validation_001",
    "user.id": "user_456",
    "org.id": "org_77",
    "feature.flags": ["legacy-settings"],
    "interaction.name": "settings.preferences.saved",
    "interaction.category": "submission",
    "interaction.target": "settings_save",
    "screen.name": "settings",
    "screen.section": "notifications",
    "ui.component": "save_button",
    "interaction.outcome": "error",
    "interaction.error": "validation_failed",
    "interaction.duration_ms": 51,
    "error.class": "SettingsValidationError",
    "error.message": "Notification email is required"
  }
}
```

## Questions this linked event set answers

| Question | Fields to query |
| --- | --- |
| How often was `settings.opened` triggered? | `interaction.name = 'settings.opened'` |
| Of those sessions, how often was `settings.notifications.clicked` triggered? | `journey.id`, `session.id`, `interaction.name` |
| What are step conversion and drop-off rates by cohort, release, or tenant? | `journey.id`, `journey.step`, `feature.flags`, `service.version`, `org.id`, `interaction.outcome`, `interaction.error` |

The key idea is that `journey.id` is the join key and missing later steps are meaningful. Operators can compute drop-off by finding journeys with `journey.step = 'settings_open'` but no later `notification_select`, or journeys with `notification_select` but no `settings_save`, without introducing a separate event schema or analytics SDK.
