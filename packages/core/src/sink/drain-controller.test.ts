import { describe, expect, it, vi } from 'vitest';
import { DrainController } from './drain-controller.js';

describe('drain controller', () => {
  it('resolves after pending and in-flight work complete', async () => {
    let pendingCount = 1;
    const sinkDrain = vi.fn(async () => undefined);
    const controller = new DrainController({
      getPendingCount: () => pendingCount,
      drainSink: sinkDrain,
    });

    controller.taskStarted();
    const drainPromise = controller.drain();

    pendingCount = 0;
    controller.notifyProgress();
    controller.taskSettled();
    await drainPromise;

    expect(sinkDrain).toHaveBeenCalledTimes(1);
    expect(controller.getState()).toBe('drained');
  });

  it('resolves best-effort on timeout and reports pending count', async () => {
    vi.useFakeTimers();
    const onDrainTimeout = vi.fn();
    const controller = new DrainController({
      getPendingCount: () => 2,
      onDrainTimeout,
    });

    const drainPromise = controller.drain({ timeoutMs: 25 });
    await vi.advanceTimersByTimeAsync(25);
    await expect(drainPromise).resolves.toBeUndefined();

    expect(onDrainTimeout).toHaveBeenCalledWith(2);
    expect(controller.getState()).toBe('drained');
    vi.useRealTimers();
  });

  it('swallows sink drain failures and reports them through the hook', async () => {
    const onSinkDrainFailure = vi.fn();
    const controller = new DrainController({
      getPendingCount: () => 0,
      drainSink: async () => {
        throw new Error('drain failed');
      },
      onSinkDrainFailure,
    });

    await expect(controller.drain()).resolves.toBeUndefined();

    expect(onSinkDrainFailure).toHaveBeenCalledTimes(1);
    expect(controller.getState()).toBe('drained');
  });
});
