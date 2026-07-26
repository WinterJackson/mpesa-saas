'use client';

import { useEffect, useRef } from 'react';

/**
 * Calls `callback` on a fixed interval, but only while the tab is visible
 * (Page Visibility API) — paused entirely when backgrounded, so no wasted
 * fetches or DB load while a merchant has switched tabs. Fires one immediate
 * call the moment the tab becomes visible again if at least `intervalMs` has
 * elapsed since the last run, so switching back doesn't show stale data for
 * a full cycle.
 *
 * Guards against overlap itself — if `callback` is still resolving when the
 * next tick or a visibility-triggered tick would fire, that tick is skipped.
 * `callback` should still handle its own request cancellation (e.g. an
 * AbortController) for cleanup-on-unmount; this hook only decides WHEN to
 * call, not how the call behaves.
 */
export function useVisibleInterval(callback: () => void | Promise<void>, intervalMs: number) {
  const savedCallback = useRef(callback);
  const lastRunRef = useRef(0);
  const isRunningRef = useRef(false);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    let cancelled = false;

    async function tick() {
      if (isRunningRef.current) return;
      if (document.visibilityState === 'visible') {
        isRunningRef.current = true;
        lastRunRef.current = Date.now();
        try {
          await savedCallback.current();
        } finally {
          isRunningRef.current = false;
        }
      }
      if (!cancelled) {
        timeoutId = setTimeout(tick, intervalMs);
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible' && Date.now() - lastRunRef.current >= intervalMs) {
        clearTimeout(timeoutId);
        tick();
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    timeoutId = setTimeout(tick, intervalMs);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [intervalMs]);
}
