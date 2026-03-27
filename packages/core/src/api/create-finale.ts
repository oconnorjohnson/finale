import type { ScopeOptions } from '../accumulation/scope.js';
import { createMetricsStore, type MetricsRecorder } from './metrics.js';
import {
  registerFinaleScopeOptions,
  registerFinaleSinkRuntime,
} from '../runtime/finale-internals.js';
import { createScopeSinkRuntime } from '../sink/scope-runtime.js';
import type {
  Finale,
  FinaleConfig,
  QueueConfig,
} from '../types/index.js';

function normalizeQueueConfig(queue: FinaleConfig['queue']): QueueConfig {
  return {
    maxSize: queue?.maxSize ?? 1000,
    dropPolicy: queue?.dropPolicy ?? 'drop-lowest-tier',
  };
}

function buildScopeOptions(config: FinaleConfig, recorder: MetricsRecorder): ScopeOptions {
  return {
    ...(config.defaults ? { defaults: config.defaults } : {}),
    ...(config.limits ? { limits: config.limits } : {}),
    fieldRegistry: config.fields,
    ...(config.errors ? { errorCapture: config.errors } : {}),
    validationMode: config.validation ?? 'soft',
    onValidationIssue: () => {
      recorder.recordValidationIssue();
    },
    onFlushReceipt: (receipt) => {
      recorder.recordFlushReceipt(receipt);
    },
    ...(config.sampling
      ? {
          sampling: {
            policy: config.sampling,
          },
        }
      : {}),
  };
}

export function createFinale(config: FinaleConfig): Finale {
  const { metrics, recorder } = createMetricsStore();
  const sinkRuntime = createScopeSinkRuntime({
    sink: config.sink,
    queue: normalizeQueueConfig(config.queue),
    onQueueDrop: (_record, reason) => {
      recorder.recordQueueDrop(reason);
    },
    onSinkSuccess: () => {
      recorder.recordSinkEmitSuccess();
    },
    onSinkError: () => {
      recorder.recordSinkEmitFailure();
    },
    onSinkDrainError: () => {
      recorder.recordSinkDrainFailure();
    },
  });

  const finale: Finale = {
    metrics,
    async drain(options) {
      await sinkRuntime.drain(options);
    },
  };

  registerFinaleScopeOptions(finale, buildScopeOptions(config, recorder));
  registerFinaleSinkRuntime(finale, sinkRuntime);

  return finale;
}
