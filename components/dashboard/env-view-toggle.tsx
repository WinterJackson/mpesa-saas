'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setViewEnvironment } from '@/lib/actions/view-env';
import { cn } from '@/lib/utils';

/**
 * Header toggle for the dashboard VIEW environment (a list-view filter, not the
 * merchant's payment routing). Persists the choice in a cookie and refreshes so
 * server components re-read it. Clearly distinct from the Settings environment
 * switch, which actually moves the merchant between sandbox and live.
 */
export function EnvViewToggle({ initial }: { initial: 'sandbox' | 'live' }) {
  const router = useRouter();
  const [value, setValue] = useState<'sandbox' | 'live'>(initial);
  const [isPending, startTransition] = useTransition();

  function select(next: 'sandbox' | 'live') {
    if (next === value) return;
    setValue(next);
    // Persist via a server action (sets the cookie server-side), then refresh so
    // server components re-read the new view filter.
    startTransition(async () => {
      await setViewEnvironment(next);
      router.refresh();
    });
  }

  return (
    <div
      className="inline-flex items-center rounded-full border border-border bg-muted p-0.5 text-xs font-medium"
      role="group"
      aria-label="View environment"
      title="Filters which records you see. This does not change your live/sandbox payment routing."
    >
      {(['sandbox', 'live'] as const).map((env) => (
        <button
          key={env}
          type="button"
          onClick={() => select(env)}
          disabled={isPending}
          className={cn(
            'rounded-full px-2.5 py-1 capitalize transition-colors disabled:opacity-60',
            value === env
              ? env === 'live'
                ? 'bg-destructive text-white'
                : 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {env}
        </button>
      ))}
    </div>
  );
}
