import type { FieldRegistry, Finale, Scope } from '@finalejs/core/portable';

export type ConvexFunctionKind =
  | 'query'
  | 'mutation'
  | 'action'
  | 'internalQuery'
  | 'internalMutation'
  | 'internalAction';

export interface ConvexRouteDescriptor {
  path?: string;
  pathPrefix?: string;
  method: string;
}

export type WrappedConvexQueryHandler<Ctx, Args, Result> = (
  ctx: Ctx,
  args: Args,
  scope: Scope
) => Result | Promise<Result>;

export type WrappedConvexMutationHandler<Ctx, Args, Result> = (
  ctx: Ctx,
  args: Args,
  scope: Scope
) => Result | Promise<Result>;

export type WrappedConvexActionHandler<Ctx, Args, Result> = (
  ctx: Ctx,
  args: Args,
  scope: Scope
) => Result | Promise<Result>;

export type WrappedConvexHttpHandler<Ctx> = (
  ctx: Ctx,
  request: Request,
  scope: Scope
) => Response | Promise<Response>;

export interface ConvexFunctionInstrumentationOptions<Ctx, Args, Result> {
  finale: Finale;
  kind: ConvexFunctionKind;
  name?: string;
  defaults?: Record<string, unknown>;
  onStart?: (scope: Scope, ctx: Ctx, args: Args) => void | Promise<void>;
  onSuccess?: (scope: Scope, ctx: Ctx, args: Args, result: Result) => void | Promise<void>;
  onError?: (scope: Scope, ctx: Ctx, args: Args, error: unknown) => void | Promise<void>;
}

export interface ConvexHttpInstrumentationOptions<Ctx> {
  finale: Finale;
  route: ConvexRouteDescriptor;
  name?: string;
  defaults?: Record<string, unknown>;
  onStart?: (scope: Scope, ctx: Ctx, request: Request) => void | Promise<void>;
  onResponse?: (
    scope: Scope,
    ctx: Ctx,
    request: Request,
    response: Response
  ) => void | Promise<void>;
  onError?: (
    scope: Scope,
    ctx: Ctx,
    request: Request,
    error: unknown
  ) => Response | void | Promise<Response | void>;
}

export interface ConvexHttpWrapperConfig<Ctx> extends Omit<ConvexHttpInstrumentationOptions<Ctx>, 'finale'> {
  handler: WrappedConvexHttpHandler<Ctx>;
}

export interface ConvexDefinition<Ctx, Args, Result> {
  handler:
    | WrappedConvexQueryHandler<Ctx, Args, Result>
    | WrappedConvexMutationHandler<Ctx, Args, Result>
    | WrappedConvexActionHandler<Ctx, Args, Result>;
  [key: string]: unknown;
}

export interface WrappedConvexDefinition<Ctx, Args, Result>
  extends Omit<ConvexDefinition<Ctx, Args, Result>, 'handler'> {
  handler: (ctx: Ctx, args: Args) => Promise<Result>;
}

export type FieldRegistryLike = FieldRegistry;
