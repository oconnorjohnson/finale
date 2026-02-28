import { describe, expect, it, vi } from 'vitest';
import { TimerManager } from './timer-manager.js';

describe('timer manager', () => {
  it('records duration between start and end', () => {
    vi.useFakeTimers();
    const manager = new TimerManager();

    manager.start('db.query');
    vi.advanceTimersByTime(45);
    manager.end('db.query');

    expect(manager.snapshot()['db.query']).toBe(45);
    vi.useRealTimers();
  });

  it('measure wraps sync operations', () => {
    vi.useFakeTimers();
    const manager = new TimerManager();

    const result = manager.measure('sync.work', () => {
      vi.advanceTimersByTime(12);
      return 'done';
    });

    expect(result).toBe('done');
    expect(manager.snapshot()['sync.work']).toBe(12);
    vi.useRealTimers();
  });

  it('measure wraps async operations', async () => {
    vi.useFakeTimers();
    const manager = new TimerManager();

    const resultPromise = manager.measure('async.work', async () => {
      await Promise.resolve();
      vi.advanceTimersByTime(30);
      return 'ok';
    });

    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result).toBe('ok');
    expect(manager.snapshot()['async.work']).toBe(30);
    vi.useRealTimers();
  });
});
