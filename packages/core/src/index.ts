// @finalejs/core - Wide-event instrumentation layer for TypeScript

// Types will be exported here
export * from './types/index.js';
export * from './accumulation/index.js';
export * from './governance/index.js';
export * from './safety/index.js';
export * from './sampling/index.js';

export { createFinale } from './api/create-finale.js';
export { getScope, hasScope, withScope } from './api/scope-access.js';
export type { WithScopeOptions } from './api/scope-access.js';
