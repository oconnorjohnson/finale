import type { FinalizedEvent, FlushReceipt, SamplingTier } from '@finalejs/core';

/**
 * Assert that an event contains the expected field subset.
 * @throws If the event is missing, a field is absent, or a value differs.
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
 * Assert that an event does not contain a specific field in `event.fields`.
 * @throws If the event is missing or the field is present.
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
 * Assert the sampling tier stored on a previously captured flush receipt.
 * @throws If the receipt is missing or the tier does not match.
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
