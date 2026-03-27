import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import express from 'express';
import type { Request, Response } from 'express';
import type { FinalizedEvent, SamplingPolicy, Scope } from '@finalejs/core';
import { createFinale, defineFields, expressMiddleware, getScope } from '@finalejs/core';
import { zodType } from '@finalejs/schema-zod';
import { z } from 'zod';
import { createTestSink, type TestSink } from '../test-sink.js';

export type ApiRequestFlowScenario = 'success_after_retry' | 'payment_declined';

interface CheckoutRequestBody {
  userId: string;
  orgId: string;
  cartValueCents: number;
  featureFlags: string[];
  isVip: boolean;
  idempotencyKey: string;
}

interface Charge {
  id: string;
}

interface CheckoutResponseBody {
  ok: boolean;
  chargeId?: string;
  reason?: string;
}

export interface ApiRequestFlowShowcaseResult {
  response: {
    status: number;
    body: CheckoutResponseBody;
  };
  sink: TestSink;
  event: FinalizedEvent | undefined;
}

export interface RunApiRequestFlowShowcaseOptions {
  scenario: ApiRequestFlowScenario;
  body?: Partial<CheckoutRequestBody>;
  requestId?: string;
  traceId?: string;
  spanId?: string;
}

const showcaseSamplingPolicy: SamplingPolicy = {
  decide() {
    return {
      decision: 'KEEP_DEBUG',
      reason: 'api_request_flow_showcase',
    };
  },
};

class GatewayTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GatewayTimeoutError';
  }
}

class PaymentDeclinedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentDeclinedError';
  }
}

function createShowcaseFields() {
  return defineFields({
    'service.name': {
      type: zodType(z.string()),
      group: 'core',
      sensitivity: 'safe',
      cardinality: 'low',
      priority: 'must-keep',
    },
    'service.version': {
      type: zodType(z.string()),
      group: 'core',
      sensitivity: 'safe',
      cardinality: 'low',
      priority: 'important',
    },
    'deployment.env': {
      type: zodType(z.enum(['dev', 'staging', 'prod'])),
      group: 'core',
      sensitivity: 'safe',
      cardinality: 'low',
      priority: 'must-keep',
    },
    'deployment.region': {
      type: zodType(z.string()),
      group: 'core',
      sensitivity: 'safe',
      cardinality: 'low',
      priority: 'important',
    },
    'request.id': {
      type: zodType(z.string()),
      group: 'core',
      sensitivity: 'safe',
      cardinality: 'medium',
      priority: 'must-keep',
    },
    'trace.id': {
      type: zodType(z.string().optional()),
      group: 'core',
      sensitivity: 'safe',
      cardinality: 'medium',
      priority: 'important',
    },
    'span.id': {
      type: zodType(z.string().optional()),
      group: 'core',
      sensitivity: 'safe',
      cardinality: 'medium',
      priority: 'important',
    },
    'http.route': {
      type: zodType(z.string()),
      group: 'core',
      sensitivity: 'safe',
      cardinality: 'low',
      priority: 'must-keep',
    },
    'http.method': {
      type: zodType(z.string()),
      group: 'core',
      sensitivity: 'safe',
      cardinality: 'low',
      priority: 'must-keep',
    },
    'http.status_code': {
      type: zodType(z.number().int()),
      group: 'core',
      sensitivity: 'safe',
      cardinality: 'low',
      priority: 'must-keep',
    },
    'http.duration_ms': {
      type: zodType(z.number()),
      group: 'core',
      sensitivity: 'safe',
      cardinality: 'low',
      priority: 'must-keep',
    },
    'user.id': {
      type: zodType(z.string()),
      group: 'domain',
      sensitivity: 'pii',
      cardinality: 'high',
      priority: 'important',
      transform: 'allow',
    },
    'org.id': {
      type: zodType(z.string()),
      group: 'domain',
      sensitivity: 'safe',
      cardinality: 'medium',
      priority: 'important',
    },
    'user.is_vip': {
      type: zodType(z.boolean()),
      group: 'domain',
      sensitivity: 'safe',
      cardinality: 'low',
      priority: 'optional',
    },
    'checkout.cart_value_cents': {
      type: zodType(z.number().int()),
      group: 'domain',
      sensitivity: 'safe',
      cardinality: 'medium',
      priority: 'important',
    },
    'feature.flags': {
      type: zodType(z.array(z.string())),
      group: 'domain',
      sensitivity: 'safe',
      cardinality: 'medium',
      priority: 'optional',
    },
    'payment.provider': {
      type: zodType(z.enum(['stripe'])),
      group: 'domain',
      sensitivity: 'safe',
      cardinality: 'low',
      priority: 'important',
    },
    'payment.idempotency_key': {
      type: zodType(z.string()),
      group: 'domain',
      sensitivity: 'pii',
      cardinality: 'high',
      priority: 'important',
      transform: 'hash',
    },
    'payment.charge_id': {
      type: zodType(z.string().optional()),
      group: 'domain',
      sensitivity: 'safe',
      cardinality: 'high',
      priority: 'important',
    },
    'retry.count': {
      type: zodType(z.number().int().nonnegative()),
      group: 'domain',
      sensitivity: 'safe',
      cardinality: 'low',
      priority: 'important',
    },
    'request.outcome': {
      type: zodType(z.enum(['success', 'error'])),
      group: 'core',
      sensitivity: 'safe',
      cardinality: 'low',
      priority: 'must-keep',
    },
    'failure.reason': {
      type: zodType(z.enum(['payment_declined', 'gateway_timeout']).optional()),
      group: 'error',
      sensitivity: 'safe',
      cardinality: 'low',
      priority: 'important',
    },
    'error.class': {
      type: zodType(z.string().optional()),
      group: 'error',
      sensitivity: 'safe',
      cardinality: 'low',
      priority: 'must-keep',
    },
    'error.message': {
      type: zodType(z.string().optional()),
      group: 'error',
      sensitivity: 'pii',
      cardinality: 'medium',
      priority: 'must-keep',
      transform: 'allow',
    },
  });
}

function createCheckoutBody(
  overrides: Partial<CheckoutRequestBody> = {}
): CheckoutRequestBody {
  return {
    userId: 'user_123',
    orgId: 'org_42',
    cartValueCents: 2599,
    featureFlags: ['new-checkout'],
    isVip: true,
    idempotencyKey: 'idem_showcase_123',
    ...overrides,
  };
}

function createPaymentAuthorizer(scenario: ApiRequestFlowScenario) {
  let attempts = 0;

  return async function authorizePayment(_body: CheckoutRequestBody): Promise<Charge> {
    attempts += 1;
    await delay(5);

    if (scenario === 'success_after_retry' && attempts === 1) {
      throw new GatewayTimeoutError('Upstream gateway timed out');
    }

    if (scenario === 'payment_declined') {
      throw new PaymentDeclinedError('Card declined');
    }

    return {
      id: `ch_showcase_${attempts}`,
    };
  };
}

async function authorizePaymentWithRetry(
  scope: Scope,
  body: CheckoutRequestBody,
  scenario: ApiRequestFlowScenario
): Promise<Charge> {
  const authorizePayment = createPaymentAuthorizer(scenario);
  let attempts = 0;

  while (true) {
    attempts += 1;

    try {
      return await authorizePayment(body);
    } catch (error) {
      if (error instanceof GatewayTimeoutError && attempts < 2) {
        scope.event.add({ 'retry.count': 1 });
        continue;
      }

      throw error;
    }
  }
}

function failureReasonFromError(error: unknown): 'payment_declined' | 'gateway_timeout' {
  if (error instanceof PaymentDeclinedError) {
    return 'payment_declined';
  }

  return 'gateway_timeout';
}

async function listen(app: express.Express): Promise<{ server: Server; baseUrl: string }> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const address = server.address();

      if (!address || typeof address === 'string') {
        reject(new Error('Failed to resolve showcase server port'));
        return;
      }

      resolve({
        server,
        baseUrl: `http://127.0.0.1:${(address as AddressInfo).port}`,
      });
    });

    server.once('error', reject);
  });
}

async function close(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

export async function runApiRequestFlowShowcase(
  options: RunApiRequestFlowShowcaseOptions
): Promise<ApiRequestFlowShowcaseResult> {
  const sink = createTestSink();
  const finale = createFinale({
    fields: createShowcaseFields(),
    sink,
    sampling: showcaseSamplingPolicy,
    validation: 'strict',
    defaults: {
      'service.name': 'checkout-api',
      'service.version': '1.0.0',
      'deployment.env': 'prod',
      'deployment.region': 'us-west-2',
    },
  });
  const app = express();
  const body = createCheckoutBody(options.body);

  app.use(express.json());
  app.use(
    expressMiddleware(finale, {
      onRequest(scope, req) {
        scope.event.add({
          'request.id': req.header('x-request-id') ?? randomUUID(),
          'http.route': req.path,
          'http.method': req.method,
        });
      },
      onResponse(scope, _req, res) {
        scope.event.add({
          'http.status_code': res.statusCode,
        });
      },
      extractTraceContext(req) {
        const traceId = req.header('x-trace-id');
        const spanId = req.header('x-span-id');

        if (!traceId && !spanId) {
          return undefined;
        }

        return {
          ...(traceId ? { traceId } : {}),
          ...(spanId ? { spanId } : {}),
        };
      },
    })
  );

  app.post('/api/checkout', async (req: Request, res: Response) => {
    const scope = getScope();
    const requestBody = req.body as CheckoutRequestBody;

    scope.event.add({
      'user.id': requestBody.userId,
      'org.id': requestBody.orgId,
      'user.is_vip': requestBody.isVip,
      'checkout.cart_value_cents': requestBody.cartValueCents,
      'feature.flags': requestBody.featureFlags,
      'payment.provider': 'stripe',
      'payment.idempotency_key': requestBody.idempotencyKey,
    });

    try {
      const charge = await scope.timers.measure('payment.authorize', async () =>
        authorizePaymentWithRetry(scope, requestBody, options.scenario)
      );

      scope.event.add({
        'payment.charge_id': charge.id,
        'request.outcome': 'success',
      });

      res.status(201).json({
        ok: true,
        chargeId: charge.id,
      } satisfies CheckoutResponseBody);
    } catch (error) {
      scope.event.add({
        'request.outcome': 'error',
        'failure.reason': failureReasonFromError(error),
      });
      scope.event.error(error);

      res.status(error instanceof PaymentDeclinedError ? 402 : 502).json({
        ok: false,
        reason: failureReasonFromError(error),
      } satisfies CheckoutResponseBody);
    }
  });

  const { server, baseUrl } = await listen(app);

  try {
    const response = await fetch(`${baseUrl}/api/checkout`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-request-id': options.requestId ?? 'req_showcase_123',
        'x-trace-id': options.traceId ?? 'trace_showcase_123',
        'x-span-id': options.spanId ?? 'span_showcase_123',
      },
      body: JSON.stringify(body),
    });
    const responseBody = (await response.json()) as CheckoutResponseBody;

    await finale.drain();

    return {
      response: {
        status: response.status,
        body: responseBody,
      },
      sink,
      event: sink.lastEvent(),
    };
  } finally {
    await close(server);
  }
}
