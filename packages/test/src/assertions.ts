import type { FinalizedEvent, FlushReceipt, SamplingTier } from '@finalejs/core';

/**
 * Assert that an event contains the expected fields.
 * @throws If any field is missing or has wrong value
 */
export function assertFields(
  event: FinalizedEvent | undefined,
  expected: Record<string, unknown>
): void {
  if (!event) {
    throw new Error('assertFields: expected an event but received undefined');
  }

  for (const [key, value] of Object.entries(expected)) {
    if (!(key in event.fields)) {
      throw new Error(`assertFields: missing field "${key}"`);
    }
    if (event.fields[key] !== value) {
      throw new Error(
        `assertFields: field "${key}" expected ${JSON.stringify(value)} but got ${JSON.stringify(event.fields[key])}`
      );
    }
  }
}

/**
 * Assert that an event does not contain a specific field (useful for PII checks).
 * @throws If the field is present
 */
export function assertNoField(event: FinalizedEvent | undefined, fieldName: string): void {
  if (!event) {
    throw new Error('assertNoField: expected an event but received undefined');
  }

  if (fieldName in event.fields) {
    throw new Error(`assertNoField: field "${fieldName}" should not be present`);
  }
}

/**
 * Assert the sampling decision in a flush receipt.
 * @throws If the decision doesn't match
 */
export function assertSamplingDecision(
  receipt: FlushReceipt | undefined,
  expected: SamplingTier
): void {
  if (!receipt) {
    throw new Error('assertSamplingDecision: expected a receipt but received undefined');
  }

  if (receipt.decision.decision !== expected) {
    throw new Error(
      `assertSamplingDecision: expected "${expected}" but got "${receipt.decision.decision}"`
    );
  }
}
