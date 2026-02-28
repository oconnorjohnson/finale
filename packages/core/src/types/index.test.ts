import { describe, expect, it } from 'vitest';
import type { EventAPI, SubEvent } from './index.js';

describe('phase 1 type contracts', () => {
  it('defines SubEvent with required shape', () => {
    const milestone: SubEvent = {
      name: 'llm.step.completed',
      timestamp: Date.now(),
      fields: {
        'llm.tokens_out': 320,
      },
    };

    expect(milestone.name).toBe('llm.step.completed');
    expect(typeof milestone.timestamp).toBe('number');
  });

  it('requires subEvent on EventAPI', () => {
    const api: EventAPI = {
      add(): void {},
      child() {
        return {
          add(): void {},
        };
      },
      error(): void {},
      annotate(): void {},
      subEvent(): void {},
      flush() {
        return {
          emitted: true,
          decision: { decision: 'KEEP_NORMAL' },
          fieldsDropped: [],
          fieldsRedacted: [],
          finalSize: 1,
        };
      },
    };

    expect(typeof api.subEvent).toBe('function');
  });
});
