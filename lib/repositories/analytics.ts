import { prismaReadonly } from "@/lib/db-readonly";
import { summarizeFailureReasons, type FailureReasonCount } from "@/lib/metrics/failure-reasons";

/**
 * Merchant-facing analytics. Org-scoped (guardrail #6) — every function takes
 * organizationId and filters by it. Read-only reporting queries, so they run on
 * the replica-backed `prismaReadonly` client, NEVER the payment-write path.
 * Respects the Sandbox/Live view filter via the optional `environment` arg.
 *
 * Monetary amounts are whole KES (matching the Transaction.amount convention
 * used across the app), so callers can display them directly.
 */

interface Scope {
  environment?: string;
  since: Date;
  until: Date;
}

function baseWhere(organizationId: string, scope: Scope) {
  return {
    organizationId,
    ...(scope.environment ? { environment: scope.environment } : {}),
    createdAt: { gte: scope.since, lt: scope.until },
  };
}

// ─── Headline KPIs ────────────────────────────────────────────────────────────

export interface DashboardKpis {
  revenue: number;
  transactionCount: number;
  completedCount: number;
  pendingCount: number;
  failedCount: number;
  successRate: number; // 0–100, completed ÷ total
  averageValue: number; // mean completed amount
}

export async function getDashboardKpis(
  organizationId: string,
  scope: Scope
): Promise<DashboardKpis> {
  const grouped = await prismaReadonly.transaction.groupBy({
    by: ["status"],
    where: baseWhere(organizationId, scope),
    _count: { id: true },
    _sum: { amount: true },
  });

  let transactionCount = 0;
  let completedCount = 0;
  let pendingCount = 0;
  let failedCount = 0;
  let revenue = 0;

  for (const g of grouped) {
    const count = g._count.id;
    transactionCount += count;
    if (g.status === "completed") {
      completedCount += count;
      revenue += g._sum.amount ?? 0;
    } else if (g.status === "pending") {
      pendingCount += count;
    } else if (g.status === "failed" || g.status === "cancelled") {
      failedCount += count;
    }
  }

  return {
    revenue,
    transactionCount,
    completedCount,
    pendingCount,
    failedCount,
    successRate: transactionCount > 0 ? Math.round((completedCount / transactionCount) * 100) : 0,
    averageValue: completedCount > 0 ? Math.round(revenue / completedCount) : 0,
  };
}

export interface KpiComparison {
  current: DashboardKpis;
  previous: DashboardKpis;
  revenueChangePct: number | null; // null when the prior period had zero revenue
  countChangePct: number | null;
}

/** Percentage change, or null when the baseline is 0 (avoids divide-by-zero / ∞). */
export function changePct(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/**
 * KPIs for the last `windowDays` vs the immediately preceding `windowDays`, so
 * the dashboard can show "▲ 12% vs previous period".
 */
export async function getKpiComparison(
  organizationId: string,
  opts: { environment?: string; windowDays: number; now?: Date }
): Promise<KpiComparison> {
  const now = opts.now ?? new Date();
  const ms = opts.windowDays * 24 * 60 * 60 * 1000;
  const currentSince = new Date(now.getTime() - ms);
  const previousSince = new Date(now.getTime() - 2 * ms);

  const [current, previous] = await Promise.all([
    getDashboardKpis(organizationId, { environment: opts.environment, since: currentSince, until: now }),
    getDashboardKpis(organizationId, { environment: opts.environment, since: previousSince, until: currentSince }),
  ]);

  return {
    current,
    previous,
    revenueChangePct: changePct(current.revenue, previous.revenue),
    countChangePct: changePct(current.transactionCount, previous.transactionCount),
  };
}

// ─── Revenue trend (dense daily buckets) ──────────────────────────────────────

export interface TrendPoint {
  date: string; // YYYY-MM-DD
  revenue: number;
  count: number;
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Daily completed-revenue series across [since, until), with every day present
 * (zero-filled) so the chart has a continuous x-axis. Bounded row fetch keeps it
 * safe at pilot scale; move to a date_trunc aggregate if volume outgrows it.
 */
export async function getRevenueTrend(
  organizationId: string,
  scope: Scope
): Promise<TrendPoint[]> {
  const rows = await prismaReadonly.transaction.findMany({
    where: { ...baseWhere(organizationId, scope), status: "completed" },
    select: { createdAt: true, amount: true },
    orderBy: { createdAt: "asc" },
    take: 50_000,
  });

  const buckets = new Map<string, { revenue: number; count: number }>();
  for (const r of rows) {
    const key = dayKey(r.createdAt);
    const b = buckets.get(key) ?? { revenue: 0, count: 0 };
    b.revenue += r.amount;
    b.count += 1;
    buckets.set(key, b);
  }

  const out: TrendPoint[] = [];
  const cursor = new Date(Date.UTC(scope.since.getUTCFullYear(), scope.since.getUTCMonth(), scope.since.getUTCDate()));
  const end = scope.until.getTime();
  while (cursor.getTime() < end) {
    const key = dayKey(cursor);
    const b = buckets.get(key);
    out.push({ date: key, revenue: b?.revenue ?? 0, count: b?.count ?? 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

// ─── Source mix (which channel earns) ─────────────────────────────────────────

export interface SourceMixRow {
  source: string;
  count: number;
  volume: number;
}

export async function getSourceMix(
  organizationId: string,
  scope: Scope
): Promise<SourceMixRow[]> {
  const grouped = await prismaReadonly.transaction.groupBy({
    by: ["source"],
    where: { ...baseWhere(organizationId, scope), status: "completed" },
    _count: { id: true },
    _sum: { amount: true },
  });
  return grouped
    .map((g) => ({ source: g.source, count: g._count.id, volume: g._sum.amount ?? 0 }))
    .sort((a, b) => b.volume - a.volume);
}

// ─── Failure breakdown (plain-language) ───────────────────────────────────────

export async function getFailureBreakdown(
  organizationId: string,
  scope: Scope
): Promise<FailureReasonCount[]> {
  const grouped = await prismaReadonly.transaction.groupBy({
    by: ["resultCode", "status"],
    where: { ...baseWhere(organizationId, scope), status: { in: ["failed", "cancelled"] } },
    _count: { id: true },
  });
  return summarizeFailureReasons(
    grouped.map((g) => ({ resultCode: g.resultCode, status: g.status, count: g._count.id }))
  );
}

// ─── STK funnel (surfaces abandonment) ────────────────────────────────────────

export interface Funnel {
  initiated: number;
  responded: number; // customer acted: completed + failed + cancelled
  completed: number;
}

export async function getFunnel(organizationId: string, scope: Scope): Promise<Funnel> {
  const grouped = await prismaReadonly.transaction.groupBy({
    by: ["status"],
    where: baseWhere(organizationId, scope),
    _count: { id: true },
  });
  const byStatus: Record<string, number> = {};
  let initiated = 0;
  for (const g of grouped) {
    byStatus[g.status] = g._count.id;
    initiated += g._count.id;
  }
  const responded = (byStatus.completed ?? 0) + (byStatus.failed ?? 0) + (byStatus.cancelled ?? 0);
  return { initiated, responded, completed: byStatus.completed ?? 0 };
}

// ─── New vs repeat customers (distinct phones) ────────────────────────────────

export interface CustomerSplit {
  newCustomers: number;
  repeatCustomers: number;
}

/**
 * Of the distinct phone numbers that paid (completed) in the window, how many
 * had paid this merchant BEFORE the window (repeat) vs. are first-time (new).
 */
export async function getNewVsRepeatCustomers(
  organizationId: string,
  scope: Scope
): Promise<CustomerSplit> {
  const inWindow = await prismaReadonly.transaction.findMany({
    where: { ...baseWhere(organizationId, scope), status: "completed" },
    select: { phone: true },
    distinct: ["phone"],
  });
  const phones = inWindow.map((r) => r.phone);
  if (phones.length === 0) return { newCustomers: 0, repeatCustomers: 0 };

  const prior = await prismaReadonly.transaction.findMany({
    where: {
      organizationId,
      ...(scope.environment ? { environment: scope.environment } : {}),
      status: "completed",
      createdAt: { lt: scope.since },
      phone: { in: phones },
    },
    select: { phone: true },
    distinct: ["phone"],
  });
  const repeatCustomers = prior.length;
  return { newCustomers: phones.length - repeatCustomers, repeatCustomers };
}
