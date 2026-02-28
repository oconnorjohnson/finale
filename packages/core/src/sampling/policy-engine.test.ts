import { describe, expect, it, vi } from 'vitest';
import type { FinalizedEvent, SamplingPolicy } from '../types/index.js';
import { decideSampling } from './policy-engine.js';

function makeEvent(fields: Record<string, unknown> = {}, timings: Record<string, number> = {}): FinalizedEvent {
  return {
    fields,
    timings,
    metadata: {},
  };
}

describe('policy engine', () => {
  it('uses provided sampling policy', () => {
    const policy: SamplingPolicy = {
      decide: () => ({ decision: 'KEEP_DEBUG', reason: 'custom' }),
    };

    const decision = decideSampling(makeEvent(), { policy });
    expect(decision).toEqual({ decision: 'KEEP_DEBUG', reason: 'custom' });
  });

  it('keeps normal by default when sampling is not configured', () => {
    const decision = decideSampling(makeEvent());
    expect(decision).toEqual({ decision: 'KEEP_NORMAL', reason: 'accumulated_not_emitted' });
  });

  it('falls back to default policy when custom policy is absent and config is provided', () => {
    const random = vi.fn().mockReturnValue(0.9);
    const decision = decideSampling(makeEvent({ ok: true }), {
      defaultPolicy: { successSampleRate: 0.5, random },
    });

    expect(decision).toEqual({ decision: 'DROP', reason: 'sampled_out' });
  });
});
