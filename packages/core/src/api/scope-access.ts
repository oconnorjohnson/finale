import type { Finale, Scope } from '../types/index.js';
import {
  getScope as getRuntimeScope,
  hasScope as hasRuntimeScope,
  withScope as withRuntimeScope,
} from '../runtime/scope-manager.js';

export interface WithScopeOptions {
  scope?: Scope;
}

export function getScope(): Scope {
  return getRuntimeScope();
}

export function hasScope(): boolean {
  return hasRuntimeScope();
}

export async function withScope<T>(
  finale: Finale,
  fn: (scope: Scope) => T | Promise<T>,
  options: WithScopeOptions = {}
): Promise<T> {
  return withRuntimeScope(finale, fn, options);
}
