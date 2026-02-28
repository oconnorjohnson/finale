import type { FieldRegistry, FinalizedEvent, SamplingTier, SubEvent } from '../types/index.js';

export interface VerbosityFilterOptions {
  fieldRegistry?: FieldRegistry;
}

function isCriticalSubEvent(subEvent: SubEvent): boolean {
  return /(error|fail|critical)/i.test(subEvent.name);
}

export function applyVerbosityFilter(
  event: FinalizedEvent,
  tier: SamplingTier,
  options: VerbosityFilterOptions = {}
): FinalizedEvent {
  if (tier === 'DROP') {
    return {
      ...event,
      fields: {},
      ...(event.subEvents ? { subEvents: [] } : {}),
    };
  }

  if (!options.fieldRegistry) {
    return { ...event };
  }

  if (tier === 'KEEP_DEBUG') {
    return { ...event };
  }

  const allowedGroups = tier === 'KEEP_MINIMAL' ? new Set(['core']) : new Set(['core', 'domain']);
  const filteredFields = Object.fromEntries(
    Object.entries(event.fields).filter(([key]) => {
      const definition = options.fieldRegistry?.[key];
      if (!definition) {
        // Without metadata we keep unknown fields except at minimal tier.
        return tier !== 'KEEP_MINIMAL';
      }

      return allowedGroups.has(definition.group);
    })
  );

  let filteredSubEvents: SubEvent[] | undefined = event.subEvents;
  if (event.subEvents) {
    if (tier === 'KEEP_MINIMAL') {
      filteredSubEvents = event.subEvents.filter(isCriticalSubEvent);
    } else if (tier === 'KEEP_NORMAL') {
      filteredSubEvents = [...event.subEvents];
    }
  }

  return {
    ...event,
    fields: filteredFields,
    ...(filteredSubEvents !== undefined ? { subEvents: filteredSubEvents } : {}),
  };
}
