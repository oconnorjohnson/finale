import { AsyncLocalStorage } from 'node:async_hooks';
import type { Finale, Scope } from '../types/index.js';
import { endScope, startScope, type StartScopeOptions } from './lifecycle.js';
import { getNoopScope } from './noop-scope.js';

const scopeStorage = new AsyncLocalStorage<Scope[]>();

export function getScope(): Scope {
  const scopeStack = scopeStorage.getStore();
  if (!scopeStack || scopeStack.length === 0) {
    return getNoopScope();
  }

  return scopeStack[scopeStack.length - 1] ?? getNoopScope();
}

export function hasScope(): boolean {
  const scopeStack = scopeStorage.getStore();
  return Boolean(scopeStack && scopeStack.length > 0);
}

export function runWithScope<T>(scope: Scope, fn: () => T): T {
  const currentStack = scopeStorage.getStore() ?? [];
  const nextStack = [...currentStack, scope];
  return scopeStorage.run(nextStack, fn);
}

export async function withScope<T>(
  finale: Finale,
  fn: (scope: Scope) => T | Promise<T>,
  options: StartScopeOptions = {}
): Promise<T> {
  const runtimeScope = startScope(finale, options);

  return runWithScope(runtimeScope.scope, async () => {
    try {
      return await fn(runtimeScope.scope);
    } finally {
      endScope(runtimeScope);
    }
  });
}
