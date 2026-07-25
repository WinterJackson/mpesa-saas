"use client";

import { useChartTheme } from "@/lib/charts/palette";

export interface FailureItem {
  reason: string;
  count: number;
}

/**
 * Top failure reasons as plain-language magnitude bars (single hue, sorted).
 * Labels carry identity; the bar carries magnitude. Uses the reserved "serious"
 * status hue muted down — these are failures, never mistaken for a data series.
 */
export function FailureList({ items }: { items: FailureItem[] }) {
  const t = useChartTheme();
  const max = Math.max(1, ...items.map((i) => i.count));

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No failed payments in this period. 🎉</p>;
  }

  return (
    <ul className="space-y-2.5">
      {items.map((i) => (
        <li key={i.reason} className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-foreground">{i.reason}</span>
            <span className="tabular-nums text-muted-foreground">{i.count}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.max(3, (i.count / max) * 100)}%`, background: t.status.serious }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
