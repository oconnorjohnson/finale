import { describe, expect, it } from 'vitest';
import { assertFields, assertNoField } from '../assertions.js';
import { runApiRequestFlowShowcase } from './api-request-flow.fixture.js';
import { assertApiIncidentQueryability, assertSafetyGuardsHeld } from './queryability-contract.js';

describe('API request-flow showcase', () => {
  it('success_after_retry_emits_one_queryable_event', async () => {
    const result = await runApiRequestFlowShowcase({
      scenario: 'success_after_retry',
    });

    expect(result.response.status).toBe(201);
    expect(result.sink.allEvents()).toHaveLength(1);
    assertFields(result.event, {
      'request.id': 'req_showcase_123',
      'trace.id': 'trace_showcase_123',
      'span.id': 'span_showcase_123',
      'http.route': '/api/checkout',
      'http.method': 'POST',
      'http.status_code': 201,
      'user.id': 'user_123',
      'org.id': 'org_42',
      'checkout.cart_value_cents': 2599,
      'payment.provider': 'stripe',
      'payment.charge_id': 'ch_showcase_2',
      'retry.count': 1,
      'request.outcome': 'success',
    });
    expect(result.event?.timings['payment.authorize']).toBeGreaterThanOrEqual(0);
  });

  it('terminal_payment_failure_explains_the_outcome_from_one_event', async () => {
    const result = await runApiRequestFlowShowcase({
      scenario: 'payment_declined',
    });

    expect(result.response.status).toBe(402);
    expect(result.sink.allEvents()).toHaveLength(1);
    assertFields(result.event, {
      'payment.provider': 'stripe',
      'request.outcome': 'error',
      'failure.reason': 'payment_declined',
      'error.class': 'PaymentDeclinedError',
      'error.message': 'Card declined',
    });
    assertNoField(result.event, 'payment.charge_id');
  });

  it('hashed_idempotency_key_prevents_raw_sensitive_output', async () => {
    const rawIdempotencyKey = 'idem_sensitive_456';
    const result = await runApiRequestFlowShowcase({
      scenario: 'success_after_retry',
      body: {
        idempotencyKey: rawIdempotencyKey,
      },
    });

    expect(result.event?.fields['payment.idempotency_key']).toMatch(/^hash:/);
    expect(result.event?.fields['payment.idempotency_key']).not.toBe(rawIdempotencyKey);
  });

  it('http_and_runtime_context_are_present_without_handler_boilerplate', async () => {
    const result = await runApiRequestFlowShowcase({
      scenario: 'success_after_retry',
    });

    assertFields(result.event, {
      'service.name': 'checkout-api',
      'service.version': '1.0.0',
      'deployment.env': 'prod',
      'deployment.region': 'us-west-2',
      'http.route': '/api/checkout',
      'http.method': 'POST',
      'http.status_code': 201,
    });
    expect(result.event?.fields['http.duration_ms']).toBeGreaterThanOrEqual(0);
  });

  it('queryability_questions_are_answerable_from_event_shape_alone', async () => {
    const successResult = await runApiRequestFlowShowcase({
      scenario: 'success_after_retry',
    });
    const failureResult = await runApiRequestFlowShowcase({
      scenario: 'payment_declined',
      requestId: 'req_showcase_failure',
      traceId: 'trace_showcase_failure',
      spanId: 'span_showcase_failure',
    });

    assertApiIncidentQueryability({
      successEvent: successResult.event,
      failureEvent: failureResult.event,
    });
    assertSafetyGuardsHeld(successResult.event, {
      hashedField: 'payment.idempotency_key',
    });
  });
});
