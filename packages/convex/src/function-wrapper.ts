import { endScope, startScope } from '@finalejs/core/portable';
import type {
  ConvexDefinition,
  ConvexFunctionInstrumentationOptions,
  WrappedConvexDefinition,
} from './types.js';

export function wrapConvexDefinition<Ctx, Args, Result>(
  definition: ConvexDefinition<Ctx, Args, Result>,
  options: ConvexFunctionInstrumentationOptions<Ctx, Args, Result>
): WrappedConvexDefinition<Ctx, Args, Result> {
  const originalHandler = definition.handler;

  return {
    ...definition,
    async handler(ctx: Ctx, args: Args): Promise<Result> {
      const runtime = startScope(options.finale);
      const { scope } = runtime;

      scope.event.add({
        'convex.function.kind': options.kind,
        ...(options.name ? { 'convex.function.name': options.name } : {}),
        ...(options.defaults ?? {}),
      });

      try {
        await options.onStart?.(scope, ctx, args);
        const result = await originalHandler(ctx, args as Args, scope);
        await options.onSuccess?.(scope, ctx, args, result);
        scope.event.add({
          'convex.function.outcome': 'success',
        });
        return result;
      } catch (error) {
        scope.event.add({
          'convex.function.outcome': 'error',
        });
        scope.event.error(error);

        try {
          await options.onError?.(scope, ctx, args, error);
        } catch {
          // Preserve the original user-function error.
        }

        throw error;
      } finally {
        endScope(runtime);
      }
    },
  };
}
