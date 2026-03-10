import type { DrainOptions, FinalizedEvent } from '../types/index.js';

export interface AttachedSinkRuntime {
  enqueue(record: FinalizedEvent): boolean;
  drain(options?: DrainOptions): Promise<void>;
}

const attachedSinkRuntimes = new WeakMap<object, AttachedSinkRuntime>();

export function attachSinkRuntime(scope: object, runtime: AttachedSinkRuntime): void {
  attachedSinkRuntimes.set(scope, runtime);
}

export function detachSinkRuntime(scope: object): void {
  attachedSinkRuntimes.delete(scope);
}

export function getAttachedSinkRuntime(scope: object): AttachedSinkRuntime | undefined {
  return attachedSinkRuntimes.get(scope);
}
