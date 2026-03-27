import { endScope, startScope } from '@finalejs/core/portable';
import type { Finale } from '@finalejs/core/portable';
import { createConvexRoutePattern } from './route.js';
import type {
  ConvexHttpInstrumentationOptions,
  ConvexHttpWrapperConfig,
  WrappedConvexHttpHandler,
} from './types.js';

type ConvexHttpHandlerOptions<Ctx> = Omit<ConvexHttpInstrumentationOptions<Ctx>, 'finale'>;

export function withFinaleHttpAction<Ctx>(
  finale: Finale,
  handler: WrappedConvexHttpHandler<Ctx>,
  options: ConvexHttpHandlerOptions<Ctx>
): (ctx: Ctx, request: Request) => Promise<Response>;
export function withFinaleHttpAction<Ctx>(
  finale: Finale,
  config: ConvexHttpWrapperConfig<Ctx>
): (ctx: Ctx, request: Request) => Promise<Response>;
export function withFinaleHttpAction<Ctx>(
  finale: Finale,
  handlerOrConfig: WrappedConvexHttpHandler<Ctx> | ConvexHttpWrapperConfig<Ctx>,
  maybeOptions?: ConvexHttpHandlerOptions<Ctx>
): (ctx: Ctx, request: Request) => Promise<Response> {
  const config: ConvexHttpWrapperConfig<Ctx> =
    typeof handlerOrConfig === 'function'
      ? ({ ...maybeOptions, handler: handlerOrConfig } as ConvexHttpWrapperConfig<Ctx>)
      : handlerOrConfig;

  if (!config.route) {
    throw new Error('withFinaleHttpAction requires route metadata');
  }

  return async (ctx: Ctx, request: Request): Promise<Response> => {
    const runtime = startScope(finale);
    const { scope } = runtime;
    const startedAt = Date.now();

    scope.event.add({
      ...(config.defaults ?? {}),
      'convex.function.kind': 'httpAction',
      ...(config.name ? { 'convex.function.name': config.name } : {}),
      'http.method': config.route.method,
      'http.route': createConvexRoutePattern(config.route),
    });

    try {
      await config.onStart?.(scope, ctx, request);
      const response = await config.handler(ctx, request, scope);
      const durationMs = Date.now() - startedAt;

      scope.event.add({
        'convex.function.outcome': 'success',
        'http.status_code': response.status,
        'http.duration_ms': durationMs,
      });
      await config.onResponse?.(scope, ctx, request, response);
      return response;
    } catch (error) {
      scope.event.add({
        'convex.function.outcome': 'error',
      });
      scope.event.error(error);

      const fallback = await config.onError?.(scope, ctx, request, error);
      const durationMs = Date.now() - startedAt;

      if (fallback instanceof Response) {
        scope.event.add({
          'http.status_code': fallback.status,
          'http.duration_ms': durationMs,
        });
        return fallback;
      }

      scope.event.add({
        'http.duration_ms': durationMs,
      });
      throw error;
    } finally {
      endScope(runtime);
    }
  };
}
