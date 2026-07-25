"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useChartTheme } from "@/lib/charts/palette";

export interface TrendPoint {
  date: string; // YYYY-MM-DD
  revenue: number;
  count: number;
}

function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-KE", { day: "numeric", month: "short", timeZone: "UTC" });
}

function compactKes(n: number): string {
  if (n >= 1_000_000) return `KES ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `KES ${Math.round(n / 1_000)}k`;
  return `KES ${n}`;
}

function fullKes(n: number): string {
  return `KES ${n.toLocaleString("en-KE")}`;
}

/**
 * Single-series revenue-over-time area chart (the "change over time" job — one
 * hue, no legend, recessive grid, crosshair tooltip). Values are whole KES.
 */
export function RevenueTrend({ data, height = 240 }: { data: TrendPoint[]; height?: number }) {
  const t = useChartTheme();
  const gradientId = "revenue-fill";

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={t.seriesFillFrom} />
            <stop offset="100%" stopColor={t.seriesFillTo} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={t.gridline} strokeDasharray="0" />
        <XAxis
          dataKey="date"
          tickFormatter={shortDate}
          tick={{ fill: t.muted, fontSize: 11 }}
          axisLine={{ stroke: t.axis }}
          tickLine={false}
          minTickGap={24}
        />
        <YAxis
          tickFormatter={compactKes}
          tick={{ fill: t.muted, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={64}
        />
        <Tooltip
          cursor={{ stroke: t.axis, strokeWidth: 1 }}
          contentStyle={{
            background: t.surface,
            border: `1px solid ${t.gridline}`,
            borderRadius: 10,
            color: t.textPrimary,
            fontSize: 12,
          }}
          labelFormatter={(label) => shortDate(String(label))}
          formatter={(value, _name, item) => {
            const point = item?.payload as TrendPoint | undefined;
            return [`${fullKes(Number(value))} · ${point?.count ?? 0} payments`, "Collected"];
          }}
        />
        <Area
          type="monotone"
          dataKey="revenue"
          stroke={t.series}
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          dot={false}
          activeDot={{ r: 4, fill: t.series, stroke: t.surface, strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
