import { AccumulationScope } from '../accumulation/scope.js';
import { attachSinkRuntime } from '../sink/attachment.js';
import type { Finale, FlushReceipt, Scope } from '../types/index.js';
import { getFinaleScopeOptions, getFinaleSinkRuntime } from './finale-internals.js';

export interface RuntimeScopeContext {
  scope: Scope;
  startedAt: number;
  finalized: boolean;
  lastReceipt?: FlushReceipt;
}

export interface StartScopeOptions {
  scope?: Scope;
}

function createLifecycleFallbackReceipt(reason: string): FlushReceipt {
  return {
    emitted: false,
    decision: {
      decision: 'DROP',
      reason,
    },
    fieldsDropped: [],
    fieldsRedacted: [],
    finalSize: 0,
  };
}

export function startScope(finale: Finale, options: StartScopeOptions = {}): RuntimeScopeContext {
  const scope = options.scope ?? new AccumulationScope(getFinaleScopeOptions(finale));

  if (!options.scope) {
    const runtime = getFinaleSinkRuntime(finale);
    if (runtime) {
      attachSinkRuntime(scope, runtime);
    }
  }

  return {
    scope,
    startedAt: Date.now(),
    finalized: false,
  };
}

export function endScope(context: RuntimeScopeContext): FlushReceipt {
  if (context.finalized) {
    return context.lastReceipt ?? createLifecycleFallbackReceipt('already_finalized');
  }

  context.finalized = true;

  try {
    const receipt = context.scope.event.flush();
    context.lastReceipt = receipt;
    return receipt;
  } catch {
    const fallback = createLifecycleFallbackReceipt('flush_error');
    context.lastReceipt = fallback;
    return fallback;
  }
}
