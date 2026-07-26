import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useVisibleInterval } from './use-visible-interval';

describe('useVisibleInterval', () => {
  let visibilityState = 'visible';

  beforeEach(() => {
    vi.useFakeTimers();
    // Mock document.visibilityState
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibilityState,
    });
    // Reset to visible by default
    visibilityState = 'visible';
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function fireVisibilityChange(state: 'visible' | 'hidden') {
    visibilityState = state;
    document.dispatchEvent(new Event('visibilitychange'));
  }

  it('fires at the given interval while visible', async () => {
    const callback = vi.fn();
    renderHook(() => useVisibleInterval(callback, 5000));
    
    expect(callback).not.toHaveBeenCalled();
    
    // Fast-forward 5s
    await vi.advanceTimersByTimeAsync(5000);
    expect(callback).toHaveBeenCalledTimes(1);
    
    // Fast-forward another 5s
    await vi.advanceTimersByTimeAsync(5000);
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('does not fire while hidden', async () => {
    const callback = vi.fn();
    fireVisibilityChange('hidden');
    
    renderHook(() => useVisibleInterval(callback, 5000));
    
    // Fast-forward 10s
    await vi.advanceTimersByTimeAsync(10000);
    expect(callback).not.toHaveBeenCalled();
  });

  it('fires immediately on becoming visible if overdue', async () => {
    const callback = vi.fn();
    renderHook(() => useVisibleInterval(callback, 5000));
    
    // First interval passes while visible
    await vi.advanceTimersByTimeAsync(5000);
    expect(callback).toHaveBeenCalledTimes(1);
    
    // Hide and advance time beyond interval
    fireVisibilityChange('hidden');
    await vi.advanceTimersByTimeAsync(10000);
    expect(callback).toHaveBeenCalledTimes(1); // Did not fire while hidden
    
    // Un-hide, should fire immediately
    fireVisibilityChange('visible');
    // Because it relies on Date.now() internally for elapsed tracking, and advanceTimersByTimeAsync also mocks Date.now()
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('does not double-fire if the callback is still pending', async () => {
    let resolvePromise: (value: void) => void;
    const promise = new Promise<void>((resolve) => {
      resolvePromise = resolve;
    });
    const callback = vi.fn().mockReturnValue(promise);
    
    renderHook(() => useVisibleInterval(callback, 5000));
    
    // Fire first interval
    await vi.advanceTimersByTimeAsync(5000);
    expect(callback).toHaveBeenCalledTimes(1);
    
    // Fire second interval while first is still pending
    await vi.advanceTimersByTimeAsync(5000);
    expect(callback).toHaveBeenCalledTimes(1); // Did NOT fire second time
    
    // Now resolve the first one
    resolvePromise!();
    // Flush microtasks
    await Promise.resolve();
    
    // The loop schedules the next tick via setTimeout(tick, intervalMs).
    // Advance another 5s
    await vi.advanceTimersByTimeAsync(5000);
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('cleans up its listener and timer on unmount', async () => {
    const callback = vi.fn();
    const { unmount } = renderHook(() => useVisibleInterval(callback, 5000));
    
    unmount();
    
    // Time passes, shouldn't fire
    await vi.advanceTimersByTimeAsync(10000);
    expect(callback).not.toHaveBeenCalled();
    
    // Firing visibility change shouldn't trigger it
    fireVisibilityChange('hidden');
    fireVisibilityChange('visible');
    expect(callback).not.toHaveBeenCalled();
  });
});
