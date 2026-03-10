import { describe, expect, it } from 'vitest';
import type { ScopeOptions } from '../accumulation/scope.js';
import { createSinkRuntime } from '../sink/runtime.js';
import type { Finale, Sink } from '../types/index.js';
import {
  getFinaleScopeOptions,
  getFinaleSinkRuntime,
  registerFinaleScopeOptions,
  registerFinaleSinkRuntime,
  unregisterFinaleScopeOptions,
  unregisterFinaleSinkRuntime,
} from './finale-internals.js';

function createFinaleStub(): Finale {
  const snapshot = {
    eventsEmitted: 0,
    eventsDropped: 0,
    eventsSampledOut: 0,
    fieldsDropped: 0,
    redactionsApplied: 0,
    schemaViolations: 0,
    sinkFailures: 0,
    queueDrops: 0,
  };

  return {
    metrics: {
      ...snapshot,
      snapshot() {
        return snapshot;
      },
    },
    async drain(): Promise<void> {},
  };
}

function createRuntime() {
  const sink: Sink = {
    emit: async () => undefined,
  };

  return createSinkRuntime({ sink });
}

function createScopeOptions(): ScopeOptions {
  return {
    defaults: { 'service.name': 'checkout-api' },
    validationMode: 'soft',
  };
}

describe('finale internals', () => {
  it('registers and resolves sink runtimes per finale instance', () => {
    const finale = createFinaleStub();
    const runtime = createRuntime();

    registerFinaleSinkRuntime(finale, runtime);

    expect(getFinaleSinkRuntime(finale)).toBe(runtime);

    unregisterFinaleSinkRuntime(finale);
  });

  it('unregister removes the runtime association', () => {
    const finale = createFinaleStub();
    const runtime = createRuntime();

    registerFinaleSinkRuntime(finale, runtime);
    unregisterFinaleSinkRuntime(finale);

    expect(getFinaleSinkRuntime(finale)).toBeUndefined();
  });

  it('keeps separate finale instances isolated', () => {
    const firstFinale = createFinaleStub();
    const secondFinale = createFinaleStub();
    const firstRuntime = createRuntime();
    const secondRuntime = createRuntime();

    registerFinaleSinkRuntime(firstFinale, firstRuntime);
    registerFinaleSinkRuntime(secondFinale, secondRuntime);

    expect(getFinaleSinkRuntime(firstFinale)).toBe(firstRuntime);
    expect(getFinaleSinkRuntime(secondFinale)).toBe(secondRuntime);

    unregisterFinaleSinkRuntime(firstFinale);
    unregisterFinaleSinkRuntime(secondFinale);
  });

  it('registers and resolves scope options per finale instance', () => {
    const finale = createFinaleStub();
    const options = createScopeOptions();

    registerFinaleScopeOptions(finale, options);

    expect(getFinaleScopeOptions(finale)).toBe(options);

    unregisterFinaleScopeOptions(finale);
  });

  it('unregister removes the scope-options association', () => {
    const finale = createFinaleStub();

    registerFinaleScopeOptions(finale, createScopeOptions());
    unregisterFinaleScopeOptions(finale);

    expect(getFinaleScopeOptions(finale)).toBeUndefined();
  });

  it('keeps sink runtime and scope options independent for the same finale', () => {
    const finale = createFinaleStub();
    const runtime = createRuntime();
    const options = createScopeOptions();

    registerFinaleSinkRuntime(finale, runtime);
    registerFinaleScopeOptions(finale, options);

    expect(getFinaleSinkRuntime(finale)).toBe(runtime);
    expect(getFinaleScopeOptions(finale)).toBe(options);

    unregisterFinaleSinkRuntime(finale);
    unregisterFinaleScopeOptions(finale);
  });
});
