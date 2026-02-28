export class TimerManager {
  private readonly activeTimers = new Map<string, number>();
  private readonly timings: Record<string, number> = {};

  start(name: string): void {
    this.activeTimers.set(name, Date.now());
  }

  end(name: string): void {
    const startedAt = this.activeTimers.get(name);
    if (startedAt === undefined) {
      return;
    }

    const duration = Math.max(0, Date.now() - startedAt);
    this.timings[name] = duration;
    this.activeTimers.delete(name);
  }

  measure<T>(name: string, fn: () => T | Promise<T>): T | Promise<T> {
    this.start(name);
    const result = fn();

    if (result instanceof Promise) {
      return result.finally(() => {
        this.end(name);
      });
    }

    this.end(name);
    return result;
  }

  snapshot(): Record<string, number> {
    return { ...this.timings };
  }
}
