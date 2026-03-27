import type { Finale } from '@finalejs/core/portable';
import { wrapConvexDefinition } from './function-wrapper.js';
import type {
  ConvexDefinition,
  ConvexFunctionInstrumentationOptions,
  WrappedConvexDefinition,
} from './types.js';

export function withFinaleQuery<Ctx, Args, Result>(
  finale: Finale,
  definition: ConvexDefinition<Ctx, Args, Result>,
  options: Omit<ConvexFunctionInstrumentationOptions<Ctx, Args, Result>, 'finale' | 'kind'> = {}
): WrappedConvexDefinition<Ctx, Args, Result> {
  return wrapConvexDefinition(definition, {
    finale,
    kind: 'query',
    ...options,
  });
}
