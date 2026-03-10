import type { DrainOptions } from '../types/index.js';
import type { DrainState } from './internal-types.js';

export interface DrainControllerOptions {
  getPendingCount: () => number;
  drainSink?: () => Promise<void>;
  onDrainTimeout?: (pendingCount: number) => void;
  onSinkDrainFailure?: (error: unknown) => void;
}

export class DrainController {
  private state: DrainState = 'open';
  private inFlight = 0;
  private timedOut = false;
  private drainPromise?: Promise<void>;
  private readonly waiters = new Set<() => void>();

  constructor(private readonly options: DrainControllerOptions) {}

  getState(): DrainState {
    return this.state;
  }

  canAccept(): boolean {
    return this.state === 'open';
  }

  hasTimedOut(): boolean {
    return this.timedOut;
  }

  taskStarted(): void {
    this.inFlight += 1;
  }

  taskSettled(): void {
    if (this.inFlight > 0) {
      this.inFlight -= 1;
    }
    this.notifyProgress();
  }

  notifyProgress(): void {
    for (const waiter of this.waiters) {
      waiter();
    }
  }

  async drain(options: DrainOptions = {}): Promise<void> {
    if (this.drainPromise) {
      return this.drainPromise;
    }

    this.state = 'draining';

    const completeDrain = async (): Promise<void> => {
      await this.waitForIdle();
      if (this.timedOut) {
        return;
      }

      if (this.options.drainSink) {
        try {
          await this.options.drainSink();
        } catch (error) {
          this.options.onSinkDrainFailure?.(error);
        }
      }
    };

    if (typeof options.timeoutMs === 'number') {
      const timeoutPromise = new Promise<void>((resolve) => {
        setTimeout(() => {
          this.timedOut = true;
          this.state = 'drained';
          this.options.onDrainTimeout?.(this.options.getPendingCount());
          this.notifyProgress();
          resolve();
        }, options.timeoutMs);
      });

      this.drainPromise = Promise.race([completeDrain(), timeoutPromise]).finally(() => {
        this.state = 'drained';
        this.notifyProgress();
      });
      return this.drainPromise;
    }

    this.drainPromise = completeDrain().finally(() => {
      this.state = 'drained';
      this.notifyProgress();
    });
    return this.drainPromise;
  }

  private async waitForIdle(): Promise<void> {
    while (!this.timedOut && (this.options.getPendingCount() > 0 || this.inFlight > 0)) {
      await this.waitForProgress();
    }
  }

  private waitForProgress(): Promise<void> {
    return new Promise((resolve) => {
      const waiter = () => {
        this.waiters.delete(waiter);
        resolve();
      };

      this.waiters.add(waiter);
    });
  }
}
