import type { DrainOptions, FinalizedEvent } from '../types/index.js';
import { decideBackpressure } from './backpressure.js';
import { DrainController } from './drain-controller.js';
import type { AsyncQueueOptions, EnqueueResult, SinkQueueEntry, SinkQueueTier } from './internal-types.js';

function normalizeMaxSize(maxSize?: number): number {
  if (typeof maxSize !== 'number' || !Number.isFinite(maxSize)) {
    return 1000;
  }

  return Math.max(1, Math.trunc(maxSize));
}

export class AsyncQueue {
  private readonly maxSize: number;
  private readonly pending: SinkQueueEntry[] = [];
  private readonly drainController: DrainController;
  private nextSequence = 0;
  private inFlightEntry: SinkQueueEntry | undefined;
  private workerPromise: Promise<void> | undefined;
  private workerScheduled = false;

  constructor(private readonly options: AsyncQueueOptions) {
    this.maxSize = normalizeMaxSize(options.maxSize);
    this.drainController = new DrainController({
      getPendingCount: () => this.pending.length,
      drainSink: async () => {
        await this.options.sink.drain?.();
      },
      onSinkDrainFailure: (error) => {
        this.options.hooks?.onSinkDrainFailure?.(error);
      },
      ...(this.options.hooks?.onDrainTimeout
        ? {
            onDrainTimeout: this.options.hooks.onDrainTimeout,
          }
        : {}),
    });
  }

  enqueue(event: FinalizedEvent, tier: SinkQueueTier): EnqueueResult {
    const entry: SinkQueueEntry = {
      event,
      tier,
      sequence: this.nextSequence++,
    };

    const state = this.drainController.getState();
    if (state !== 'open') {
      const reason = state === 'draining' ? 'queue_draining' : 'queue_drained';
      this.options.hooks?.onQueueDrop?.(entry, reason);
      return {
        admitted: false,
        entry,
        reason,
      };
    }

    const occupancy = this.currentOccupancy();
    const pendingCapacity = this.maxSize - (this.inFlightEntry ? 1 : 0);

    if (occupancy >= this.maxSize && (pendingCapacity <= 0 || this.pending.length === 0)) {
      const reason = this.getFullDropReason();
      this.options.hooks?.onQueueDrop?.(entry, reason);
      return {
        admitted: false,
        entry,
        reason,
      };
    }

    const decision = decideBackpressure({
      pending: this.pending,
      incoming: entry,
      maxSize: pendingCapacity,
      dropPolicy: this.options.dropPolicy,
    });

    if (decision.action === 'drop-incoming') {
      this.options.hooks?.onQueueDrop?.(decision.dropped, decision.reason);
      return {
        admitted: false,
        entry,
        reason: decision.reason,
      };
    }

    if (decision.action === 'replace-existing') {
      const index = this.pending.findIndex((item) => item.sequence === decision.dropped.sequence);
      if (index >= 0) {
        this.pending.splice(index, 1);
      }
      this.options.hooks?.onQueueDrop?.(decision.dropped, decision.reason);
    }

    this.pending.push(entry);
    this.drainController.notifyProgress();
    this.scheduleWorker();

    return {
      admitted: true,
      entry,
    };
  }

  getPendingCount(): number {
    return this.pending.length;
  }

  getState(): ReturnType<DrainController['getState']> {
    return this.drainController.getState();
  }

  async drain(options?: DrainOptions): Promise<void> {
    await this.drainController.drain(options);
  }

  private scheduleWorker(): void {
    if (this.workerScheduled || this.workerPromise) {
      return;
    }

    this.workerScheduled = true;
    queueMicrotask(() => {
      this.workerScheduled = false;
      if (this.workerPromise || this.drainController.hasTimedOut()) {
        return;
      }

      this.workerPromise = this.processQueue().finally(() => {
        this.workerPromise = undefined;
        if (this.pending.length > 0 && !this.drainController.hasTimedOut()) {
          this.scheduleWorker();
        }
      });
    });
  }

  private async processQueue(): Promise<void> {
    while (this.pending.length > 0) {
      if (this.drainController.hasTimedOut()) {
        this.pending.length = 0;
        this.drainController.notifyProgress();
        return;
      }

      const entry = this.pending.shift();
      this.drainController.notifyProgress();
      if (!entry) {
        continue;
      }

      this.inFlightEntry = entry;
      this.drainController.taskStarted();
      try {
        await Promise.resolve(this.options.sink.emit(entry.event));
        this.options.hooks?.onSinkSuccess?.(entry);
      } catch (error) {
        this.options.hooks?.onSinkFailure?.(entry, error);
      } finally {
        this.inFlightEntry = undefined;
        this.drainController.taskSettled();
      }

      if (this.drainController.hasTimedOut()) {
        this.pending.length = 0;
        this.drainController.notifyProgress();
        return;
      }
    }
  }

  private currentOccupancy(): number {
    return this.pending.length + (this.inFlightEntry ? 1 : 0);
  }

  private getFullDropReason(): NonNullable<EnqueueResult['reason']> {
    switch (this.options.dropPolicy) {
      case 'drop-oldest':
        return 'queue_full_drop_oldest';
      case 'drop-lowest-tier':
        return 'queue_full_drop_lowest_tier';
      case 'drop-newest':
      default:
        return 'queue_full_drop_newest';
    }
  }
}
