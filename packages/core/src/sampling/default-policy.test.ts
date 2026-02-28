import { describe, expect, it, vi } from 'vitest';
import { createDefaultSamplingPolicy } from './default-policy.js';

describe('default sampling policy', () => {
  it('keeps error events at debug tier', () => {
    const policy = createDefaultSamplingPolicy();
    const decision = policy.decide({
      fields: { 'error.class': 'Error' },
      timings: {},
      metadata: {},
    });

    expect(decision).toEqual({ decision: 'KEEP_DEBUG', reason: 'error' });
  });

  it('keeps slow events at normal tier', () => {
    const policy = createDefaultSamplingPolicy({ slowThresholdMs: 1000 });
    const decision = policy.decide({
      fields: { 'http.duration_ms': 1500 },
      timings: {},
      metadata: {},
    });

    expect(decision).toEqual({ decision: 'KEEP_NORMAL', reason: 'slow' });
  });

  it('samples successful events using configured rate', () => {
    const random = vi.fn().mockReturnValue(0.01);
    const policy = createDefaultSamplingPolicy({ successSampleRate: 0.1, random });
    const decision = policy.decide({
      fields: { ok: true },
      timings: {},
      metadata: {},
    });

    expect(decision).toEqual({ decision: 'KEEP_MINIMAL', reason: 'sampled' });
  });
});
