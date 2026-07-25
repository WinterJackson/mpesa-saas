"use client";

import { useTheme } from "@wrksz/themes/client";

/**
 * Chart palette — the validated data-viz reference instance (see the dataviz
 * skill's references/palette.md). Both light and dark columns are *selected*
 * steps, not an automatic flip. Categorical hues are consumed in fixed slot
 * order (never cycled); status colors are reserved and never reused as a series.
 *
 * Charts read this via `useChartTheme()` so colors track the resolved theme.
 * Text/gridlines stay in ink tokens — a series color never carries label text.
 */

export interface ChartTheme {
  isDark: boolean;
  surface: string;
  gridline: string;
  axis: string;
  textPrimary: string;
  textSecondary: string;
  muted: string;
  /** Single-series (revenue) hue — the sequential blue, plus a soft fill. */
  series: string;
  seriesFillFrom: string;
  seriesFillTo: string;
  /** Categorical slots 1..8 in fixed order (identity encoding). */
  categorical: string[];
  status: { good: string; warning: string; serious: string; critical: string };
}

const LIGHT: Omit<ChartTheme, "isDark"> = {
  surface: "#fcfcfb",
  gridline: "#e1e0d9",
  axis: "#c3c2b7",
  textPrimary: "#0b0b0b",
  textSecondary: "#52514e",
  muted: "#898781",
  series: "#2a78d6",
  seriesFillFrom: "rgba(42,120,214,0.24)",
  seriesFillTo: "rgba(42,120,214,0.02)",
  categorical: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"],
  status: { good: "#0ca30c", warning: "#fab219", serious: "#ec835a", critical: "#d03b3b" },
};

const DARK: Omit<ChartTheme, "isDark"> = {
  surface: "#1a1a19",
  gridline: "#2c2c2a",
  axis: "#383835",
  textPrimary: "#ffffff",
  textSecondary: "#c3c2b7",
  muted: "#898781",
  series: "#3987e5",
  seriesFillFrom: "rgba(57,135,229,0.28)",
  seriesFillTo: "rgba(57,135,229,0.02)",
  categorical: ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"],
  status: { good: "#0ca30c", warning: "#fab219", serious: "#ec835a", critical: "#d03b3b" },
};

export function useChartTheme(): ChartTheme {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  return { isDark, ...(isDark ? DARK : LIGHT) };
}

/** Friendly labels for Transaction.source values (identity, not codes). */
export const SOURCE_LABELS: Record<string, string> = {
  payment_link: "Payment Links",
  shopify: "Shopify",
  api: "API",
  c2b: "Paybill / Till",
  stk: "STK Push",
  demo_store: "Demo store",
  external: "External",
  demo: "Demo data",
};

export function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source;
}
