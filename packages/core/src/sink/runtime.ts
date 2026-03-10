import type { DrainOptions, FinalizedEvent, QueueConfig, Sink } from '../types/index.js';
import type { AttachedSinkRuntime } from './attachment.js';
import { AsyncQueue } from './async-queue.js';
import type { QueueRejectReason } from './internal-types.js';

export interface SinkRuntimeOptions {
  sink: Sink;
  queue?: QueueConfig;
  onSinkError?: (error: unknown, record: FinalizedEvent) => void;
  onSinkSuccess?: (record: FinalizedEvent) => void;
  onSinkDrainError?: (error: unknown) => void;
  onQueueDrop?: (record: FinalizedEvent, reason: QueueRejectReason) => void;
  onDrainTimeout?: (pendingCount: number) => void;
}

export interface SinkRuntime extends AttachedSinkRuntime {
  getState(): ReturnType<AsyncQueue['getState']>;
}

export function createSinkRuntime(options: SinkRuntimeOptions): SinkRuntime {
  const queue = new AsyncQueue({
    sink: options.sink,
    ...(options.queue?.maxSize !== undefined ? { maxSize: options.queue.maxSize } : {}),
    ...(options.queue?.dropPolicy ? { dropPolicy: options.queue.dropPolicy } : {}),
    hooks: {
      ...(options.onQueueDrop
        ? {
            onQueueDrop: (entry, reason) => {
              options.onQueueDrop?.(entry.event, reason);
            },
          }
        : {}),
      ...(options.onSinkSuccess
        ? {
            onSinkSuccess: (entry) => {
              options.onSinkSuccess?.(entry.event);
            },
          }
        : {}),
      ...(options.onSinkError
        ? {
            onSinkFailure: (entry, error) => {
              if (entry) {
                options.onSinkError?.(error, entry.event);
              }
            },
          }
        : {}),
      ...(options.onSinkDrainError
        ? {
            onSinkDrainFailure: (error) => {
              options.onSinkDrainError?.(error);
            },
          }
        : {}),
      ...(options.onDrainTimeout
        ? {
            onDrainTimeout: (pendingCount) => {
              options.onDrainTimeout?.(pendingCount);
            },
          }
        : {}),
    },
  });

  return {
    enqueue(record: FinalizedEvent): boolean {
      return queue.enqueue(record, toSinkQueueTier(record)).admitted;
    },
    getState() {
      return queue.getState();
    },
    async drain(drainOptions?: DrainOptions): Promise<void> {
      await queue.drain(drainOptions);
    },
  };
}

function toSinkQueueTier(record: FinalizedEvent): 'KEEP_MINIMAL' | 'KEEP_NORMAL' | 'KEEP_DEBUG' {
  switch (record.metadata.samplingDecision) {
    case 'KEEP_MINIMAL':
    case 'KEEP_DEBUG':
      return record.metadata.samplingDecision;
    case 'KEEP_NORMAL':
    default:
      return 'KEEP_NORMAL';
  }
}
