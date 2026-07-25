"use client";

import { useChartTheme } from "@/lib/charts/palette";

export interface FunnelStage {
  label: string;
  value: number;
  hint?: string;
}

/**
 * A compact ordinal funnel — proportional bars for ordered stages (STK
 * initiated → responded → completed), single-hue by magnitude, with the
 * step-over-step retention percentage called out. Surfaces abandonment that is
 * otherwise invisible.
 */
export function MiniFunnel({ stages }: { stages: FunnelStage[] }) {
  const t = useChartTheme();
  const top = stages[0]?.value ?? 0;

  if (top === 0) {
    return <p className="text-sm text-muted-foreground">No payment attempts in this period yet.</p>;
  }

  return (
    <div className="space-y-3">
      {stages.map((stage, i) => {
        const pctOfTop = Math.max(2, (stage.value / top) * 100);
        const stepPct = i === 0 ? null : Math.round((stage.value / (stages[i - 1].value || 1)) * 100);
        return (
          <div key={stage.label} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-foreground">{stage.label}</span>
              <span className="tabular-nums text-muted-foreground">
                {stage.value.toLocaleString("en-KE")}
                {stepPct !== null && <span className="ml-2 text-xs">({stepPct}% kept)</span>}
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full"
                style={{ width: `${pctOfTop}%`, background: t.series, opacity: 1 - i * 0.18 }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
