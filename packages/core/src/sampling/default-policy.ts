import type { FinalizedEvent, SamplingPolicy } from '../types/index.js';

export interface DefaultSamplingPolicyOptions {
  slowThresholdMs?: number;
  successSampleRate?: number;
  random?: () => number;
}

const DEFAULT_SLOW_THRESHOLD_MS = 1500;
const DEFAULT_SUCCESS_SAMPLE_RATE = 0.01;

export function createDefaultSamplingPolicy(options: DefaultSamplingPolicyOptions = {}): SamplingPolicy {
  const slowThresholdMs = options.slowThresholdMs ?? DEFAULT_SLOW_THRESHOLD_MS;
  const successSampleRate = options.successSampleRate ?? DEFAULT_SUCCESS_SAMPLE_RATE;
  const random = options.random ?? Math.random;

  return {
    decide(event: FinalizedEvent) {
      if (event.fields['error.class']) {
        return { decision: 'KEEP_DEBUG', reason: 'error' };
      }

      const durationFromField = event.fields['http.duration_ms'];
      const slowByField = typeof durationFromField === 'number' && durationFromField > slowThresholdMs;
      const slowByTiming = Object.values(event.timings).some((timingMs) => timingMs > slowThresholdMs);
      if (slowByField || slowByTiming) {
        return { decision: 'KEEP_NORMAL', reason: 'slow' };
      }

      return random() < successSampleRate
        ? { decision: 'KEEP_MINIMAL', reason: 'sampled' }
        : { decision: 'DROP', reason: 'sampled_out' };
    },
  };
}
