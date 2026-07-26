"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Wallet, Activity, CheckCircle2, Clock, Coins, Users, Link2, Gauge } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/charts/kpi-card";
import { RevenueTrend } from "@/components/charts/revenue-trend";
import { ShareBar } from "@/components/charts/share-bar";
import { MiniFunnel } from "@/components/charts/mini-funnel";
import { FailureList } from "@/components/charts/failure-list";
import { sourceLabel } from "@/lib/charts/palette";
import { cn } from "@/lib/utils";
import { useVisibleInterval } from "@/hooks/use-visible-interval";
import type {
  KpiComparison,
  TrendPoint,
  SourceMixRow,
  Funnel,
  CustomerSplit,
} from "@/lib/repositories/analytics";
import type { FailureReasonCount } from "@/lib/metrics/failure-reasons";

export interface AnalyticsBundle {
  range: number;
  kpis: KpiComparison;
  trend: TrendPoint[];
  sourceMix: SourceMixRow[];
  failures: FailureReasonCount[];
  funnel: Funnel;
  customers: CustomerSplit;
}

export interface PlanUsage {
  planName: string;
  used: number;
  included: number | null;
  projectedOverageKes: number;
}

export interface LinksSummary {
  activeCount: number;
  bestTitle: string | null;
}

const RANGES = [7, 30, 90];

function kes(n: number): string {
  return `KES ${Math.round(n).toLocaleString("en-KE")}`;
}

export function AnalyticsSection({
  initial,
  planUsage,
  links,
}: {
  initial: AnalyticsBundle;
  planUsage: PlanUsage;
  links: LinksSummary;
}) {
  const [bundle, setBundle] = useState<AnalyticsBundle>(initial);
  const [range, setRange] = useState<number>(initial.range);
  const [loading, setLoading] = useState(false);

  async function changeRange(next: number) {
    if (next === range) return;
    setRange(next);
    setLoading(true);
    try {
      const res = await fetch(`/api/merchant/analytics?range=${next}`);
      const json = await res.json();
      if (json.success) setBundle(json.data);
    } catch {
      /* keep prior data on failure — the range buttons just no-op visually */
    } finally {
      setLoading(false);
    }
  }

  const rangeRef = useRef(range);
  useEffect(() => {
    rangeRef.current = range;
  }, [range]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/merchant/analytics?range=${rangeRef.current}`);
      const json = await res.json();
      if (json.success) setBundle(json.data);
    } catch {
      /* keep prior data on a failed background refresh — same fail-quiet
         behavior as changeRange already has */
    }
  }, []);

  useVisibleInterval(refresh, 20_000);

  const { current } = bundle.kpis;
  const usagePct =
    planUsage.included && planUsage.included > 0
      ? Math.min(100, Math.round((planUsage.used / planUsage.included) * 100))
      : null;

  return (
    <div className="space-y-6">
      {/* Range selector */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Showing the last <span className="font-medium text-foreground">{range} days</span>
          {loading && <span className="ml-2 animate-pulse">updating…</span>}
        </p>
        <div className="inline-flex rounded-lg border border-border p-0.5">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => changeRange(r)}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                r === range ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {r}d
            </button>
          ))}
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label={`Revenue · ${range}d`} value={kes(current.revenue)} icon={Wallet} changePct={bundle.kpis.revenueChangePct} hint="vs previous period" />
        <KpiCard label={`Payments · ${range}d`} value={current.transactionCount.toLocaleString("en-KE")} icon={Activity} changePct={bundle.kpis.countChangePct} hint="vs previous period" />
        <KpiCard label="Success rate" value={`${current.successRate}%`} icon={CheckCircle2} hint={`${current.completedCount} of ${current.transactionCount} completed`} />
        <KpiCard label="Avg payment" value={kes(current.averageValue)} icon={Coins} hint="per completed payment" />
        <KpiCard label="Pending now" value={current.pendingCount.toLocaleString("en-KE")} icon={Clock} hint="awaiting customer PIN" />
        <KpiCard label="New customers" value={bundle.customers.newCustomers.toLocaleString("en-KE")} icon={Users} hint={`${bundle.customers.repeatCustomers} returning`} />
        <KpiCard label="Active links" value={links.activeCount.toLocaleString("en-KE")} icon={Link2} hint={links.bestTitle ? `Top: ${links.bestTitle}` : "No links yet"} />
        <KpiCard
          label="Plan usage"
          value={planUsage.included ? `${planUsage.used}/${planUsage.included}` : `${planUsage.used}`}
          icon={Gauge}
          hint={
            usagePct !== null
              ? `${usagePct}% used${planUsage.projectedOverageKes > 0 ? ` · ~${kes(planUsage.projectedOverageKes)} overage` : ""}`
              : `${planUsage.planName} · unlimited`
          }
        />
      </div>

      {/* Revenue trend */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Revenue over time</CardTitle>
        </CardHeader>
        <CardContent>
          <RevenueTrend data={bundle.trend} />
        </CardContent>
      </Card>

      {/* Distribution row */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Where revenue comes from</CardTitle>
          </CardHeader>
          <CardContent>
            <ShareBar
              items={bundle.sourceMix.map((s) => ({ key: s.source, label: sourceLabel(s.source), value: s.volume }))}
              formatValue={kes}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Payment funnel</CardTitle>
          </CardHeader>
          <CardContent>
            <MiniFunnel
              stages={[
                { label: "Prompt sent", value: bundle.funnel.initiated },
                { label: "Customer responded", value: bundle.funnel.responded },
                { label: "Completed", value: bundle.funnel.completed },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top failure reasons</CardTitle>
          </CardHeader>
          <CardContent>
            <FailureList items={bundle.failures} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
