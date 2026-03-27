import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { Scope, Finale, FlushReceipt, NamespacedEventAPI } from '../../types/index.js';
import { endScope, startScope } from '../../runtime/lifecycle.js';
import { runWithScope } from '../../runtime/scope-manager.js';

export interface ExpressTraceContext {
  traceId?: string;
  spanId?: string;
}

export interface ExpressMiddlewareOptions {
  onRequest?: (scope: Scope, req: Request) => void;
  onResponse?: (scope: Scope, req: Request, res: Response) => void;
  extractTraceContext?: (req: Request) => ExpressTraceContext | undefined;
}

type FinalizeTrigger = 'manual' | 'finish' | 'close' | 'aborted' | 'error';

interface ManagedScopeState {
  finalized: boolean;
  finalizing: boolean;
  receipt?: FlushReceipt;
}

function isManagedScopeWritable(state: ManagedScopeState): boolean {
  return !state.finalized || state.finalizing;
}

function createManagedScope(
  scope: Scope,
  state: ManagedScopeState,
  finalize: () => FlushReceipt
): Scope {
  const eventApi = {
    add(fields: Record<string, unknown>): void {
      if (!isManagedScopeWritable(state)) {
        return;
      }

      scope.event.add(fields);
    },
    child(namespace: string): NamespacedEventAPI {
      return {
        add(fields): void {
          if (!isManagedScopeWritable(state)) {
            return;
          }

          scope.event.child(namespace).add(fields);
        },
      };
    },
    error(err: unknown, options?: { includeStack?: boolean }): void {
      if (!isManagedScopeWritable(state)) {
        return;
      }

      scope.event.error(err, options);
    },
    annotate(tag: string): void {
      if (!isManagedScopeWritable(state)) {
        return;
      }

      scope.event.annotate(tag);
    },
    subEvent(name: string, fields?: Record<string, unknown>): void {
      if (!isManagedScopeWritable(state)) {
        return;
      }

      scope.event.subEvent(name, fields);
    },
    flush(): FlushReceipt {
      return finalize();
    },
  } satisfies Scope['event'];

  return {
    event: eventApi,
    timers: {
      start(name: string): void {
        if (!isManagedScopeWritable(state)) {
          return;
        }

        scope.timers.start(name);
      },
      end(name: string): void {
        if (!isManagedScopeWritable(state)) {
          return;
        }

        scope.timers.end(name);
      },
      measure<T>(name: string, fn: () => T | Promise<T>): T | Promise<T> {
        if (!isManagedScopeWritable(state)) {
          return fn();
        }

        return scope.timers.measure(name, fn);
      },
    },
  };
}

function addDefinedFields(scope: Scope, fields: Record<string, unknown>): void {
  const definedFields = Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined)
  );

  if (Object.keys(definedFields).length === 0) {
    return;
  }

  scope.event.add(definedFields);
}

export function expressMiddleware(
  finale: Finale,
  options: ExpressMiddlewareOptions = {}
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const runtimeScope = startScope(finale);
    const state: ManagedScopeState = {
      finalized: false,
      finalizing: false,
    };
    const startedAt = Date.now();

    const detachListeners = (): void => {
      req.off('aborted', handleAborted);
      req.off('error', handleRequestError);
      res.off('finish', handleFinish);
      res.off('close', handleClose);
      res.off('error', handleResponseError);
    };

    const finalizeOnce = (trigger: FinalizeTrigger, error?: unknown): FlushReceipt => {
      if (state.receipt) {
        return state.receipt;
      }

      state.finalized = true;
      state.finalizing = true;
      detachListeners();

      const receipt = runWithScope(managedScope, () => {
        if (error !== undefined) {
          managedScope.event.error(error);
        }

        managedScope.event.add({
          'http.duration_ms': Math.max(0, Date.now() - startedAt),
        });

        if (trigger !== 'manual' && options.onResponse) {
          try {
            options.onResponse(managedScope, req, res);
          } catch (hookError) {
            managedScope.event.error(hookError);
          }
        }

        return endScope(runtimeScope);
      });

      state.finalizing = false;
      state.receipt = receipt;
      return receipt;
    };

    const managedScope: Scope = createManagedScope(runtimeScope.scope, state, () => finalizeOnce('manual'));

    const handleFinish = (): void => {
      finalizeOnce('finish');
    };

    const handleClose = (): void => {
      finalizeOnce('close');
    };

    const handleAborted = (): void => {
      finalizeOnce('aborted');
    };

    const handleRequestError = (error: unknown): void => {
      finalizeOnce('error', error);
    };

    const handleResponseError = (error: unknown): void => {
      finalizeOnce('error', error);
    };

    req.once('aborted', handleAborted);
    req.once('error', handleRequestError);
    res.once('finish', handleFinish);
    res.once('close', handleClose);
    res.once('error', handleResponseError);

    runWithScope(managedScope, () => {
      try {
        const traceContext = options.extractTraceContext?.(req);
        if (traceContext) {
          addDefinedFields(managedScope, {
            'trace.id': traceContext.traceId,
            'span.id': traceContext.spanId,
          });
        }

        options.onRequest?.(managedScope, req);
        next();
      } catch (error) {
        managedScope.event.error(error);
        next(error);
      }
    });
  };
}
