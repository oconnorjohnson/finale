import type { AttachedSinkRuntime } from './attachment.js';
import { createSinkRuntime, type SinkRuntimeOptions } from './runtime.js';

export type ScopeSinkRuntimeOptions = SinkRuntimeOptions;

export function createScopeSinkRuntime(options: ScopeSinkRuntimeOptions): AttachedSinkRuntime {
  return createSinkRuntime(options);
}
