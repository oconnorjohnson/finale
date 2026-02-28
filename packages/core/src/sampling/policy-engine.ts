import type { FinalizedEvent, SamplingDecision, SamplingPolicy } from '../types/index.js';
import { createDefaultSamplingPolicy, type DefaultSamplingPolicyOptions } from './default-policy.js';

export interface PolicyEngineOptions {
  policy?: SamplingPolicy;
  defaultPolicy?: DefaultSamplingPolicyOptions;
}

export function decideSampling(event: FinalizedEvent, options: PolicyEngineOptions = {}): SamplingDecision {
  if (!options.policy && !options.defaultPolicy) {
    // Preserve pre-sampling behavior for callers that have not configured sampling yet.
    return {
      decision: 'KEEP_NORMAL',
      reason: 'accumulated_not_emitted',
    };
  }

  const policy = options.policy ?? createDefaultSamplingPolicy(options.defaultPolicy);
  const decision = policy.decide(event);

  return {
    decision: decision.decision,
    ...(decision.reason ? { reason: decision.reason } : {}),
  };
}
