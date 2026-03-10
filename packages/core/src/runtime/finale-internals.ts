import type { ScopeOptions } from '../accumulation/scope.js';
import type { AttachedSinkRuntime } from '../sink/attachment.js';
import type { Finale } from '../types/index.js';

const finaleSinkRuntimes = new WeakMap<Finale, AttachedSinkRuntime>();
const finaleScopeOptions = new WeakMap<Finale, ScopeOptions>();

export function registerFinaleSinkRuntime(finale: Finale, runtime: AttachedSinkRuntime): void {
  finaleSinkRuntimes.set(finale, runtime);
}

export function unregisterFinaleSinkRuntime(finale: Finale): void {
  finaleSinkRuntimes.delete(finale);
}

export function getFinaleSinkRuntime(finale: Finale): AttachedSinkRuntime | undefined {
  return finaleSinkRuntimes.get(finale);
}

export function registerFinaleScopeOptions(finale: Finale, options: ScopeOptions): void {
  finaleScopeOptions.set(finale, options);
}

export function unregisterFinaleScopeOptions(finale: Finale): void {
  finaleScopeOptions.delete(finale);
}

export function getFinaleScopeOptions(finale: Finale): ScopeOptions | undefined {
  return finaleScopeOptions.get(finale);
}
