"use client";

import { useChartTheme } from "@/lib/charts/palette";

export interface ShareItem {
  key: string;
  label: string;
  value: number;
}

/**
 * A single 100%-stacked horizontal "share" bar — the compact way to show how a
 * total splits across channels. Segments use the categorical palette in FIXED
 * slot order (adjacent pairlist, CVD-validated), separated by a 2px surface gap,
 * with a legend + direct value/percent so identity never rests on color alone.
 */
export function ShareBar({
  items,
  formatValue,
}: {
  items: ShareItem[];
  formatValue?: (v: number) => string;
}) {
  const t = useChartTheme();
  const total = items.reduce((s, i) => s + i.value, 0);
  const fmt = formatValue ?? ((v: number) => v.toLocaleString("en-KE"));

  if (total === 0) {
    return <p className="text-sm text-muted-foreground">No data for this period yet.</p>;
  }

  const withColor = items
    .filter((i) => i.value > 0)
    .map((i, idx) => ({ ...i, color: t.categorical[idx % t.categorical.length], pct: (i.value / total) * 100 }));

  return (
    <div className="space-y-3">
      <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full">
        {withColor.map((i) => (
          <div
            key={i.key}
            style={{ width: `${i.pct}%`, background: i.color }}
            className="h-full min-w-[3px] first:rounded-l-full last:rounded-r-full"
            title={`${i.label}: ${fmt(i.value)} (${Math.round(i.pct)}%)`}
          />
        ))}
      </div>
      <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {withColor.map((i) => (
          <li key={i.key} className="flex items-center gap-2 text-sm">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: i.color }} aria-hidden />
            <span className="min-w-0 flex-1 truncate text-foreground">{i.label}</span>
            <span className="tabular-nums text-muted-foreground">
              {fmt(i.value)} · {Math.round(i.pct)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
