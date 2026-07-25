import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaReadonly } from "@/lib/db-readonly";
import {
  getDashboardKpis,
  getKpiComparison,
  getRevenueTrend,
  getSourceMix,
  getFailureBreakdown,
  getFunnel,
  getNewVsRepeatCustomers,
} from "./analytics";

vi.mock("@/lib/db-readonly", () => ({
  prismaReadonly: {
    transaction: { groupBy: vi.fn(), findMany: vi.fn(), aggregate: vi.fn(), count: vi.fn() },
  },
}));

const groupBy = vi.mocked(prismaReadonly.transaction.groupBy);
const findMany = vi.mocked(prismaReadonly.transaction.findMany);

beforeEach(() => vi.clearAllMocks());

const scope = { since: new Date("2026-07-01T00:00:00Z"), until: new Date("2026-07-08T00:00:00Z") };

describe("getDashboardKpis", () => {
  it("derives revenue/success-rate/AOV from status groups", async () => {
    groupBy.mockResolvedValueOnce([
      { status: "completed", _count: { id: 8 }, _sum: { amount: 16000 } },
      { status: "pending", _count: { id: 1 }, _sum: { amount: 500 } },
      { status: "failed", _count: { id: 1 }, _sum: { amount: 500 } },
    ] as never);

    const kpis = await getDashboardKpis("org-1", scope);
    expect(kpis.revenue).toBe(16000);
    expect(kpis.completedCount).toBe(8);
    expect(kpis.pendingCount).toBe(1);
    expect(kpis.failedCount).toBe(1);
    expect(kpis.transactionCount).toBe(10);
    expect(kpis.successRate).toBe(80);
    expect(kpis.averageValue).toBe(2000);
  });

  it("is org-scoped and honours the environment filter", async () => {
    groupBy.mockResolvedValueOnce([] as never);
    await getDashboardKpis("org-1", { ...scope, environment: "live" });
    expect(groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: "org-1", environment: "live" }),
      })
    );
  });

  it("returns zeroed KPIs (no divide-by-zero) when there are no transactions", async () => {
    groupBy.mockResolvedValueOnce([] as never);
    const kpis = await getDashboardKpis("org-1", scope);
    expect(kpis).toMatchObject({ revenue: 0, successRate: 0, averageValue: 0, transactionCount: 0 });
  });
});

describe("getKpiComparison", () => {
  it("computes percentage change vs the prior window, null on a zero baseline", async () => {
    // First call = current window, second = previous window.
    groupBy
      .mockResolvedValueOnce([{ status: "completed", _count: { id: 2 }, _sum: { amount: 2000 } }] as never)
      .mockResolvedValueOnce([{ status: "completed", _count: { id: 1 }, _sum: { amount: 1000 } }] as never);

    const cmp = await getKpiComparison("org-1", { windowDays: 7, now: new Date("2026-07-15T00:00:00Z") });
    expect(cmp.current.revenue).toBe(2000);
    expect(cmp.previous.revenue).toBe(1000);
    expect(cmp.revenueChangePct).toBe(100);
  });

  it("returns null change when the previous period had zero", async () => {
    groupBy
      .mockResolvedValueOnce([{ status: "completed", _count: { id: 2 }, _sum: { amount: 2000 } }] as never)
      .mockResolvedValueOnce([] as never);
    const cmp = await getKpiComparison("org-1", { windowDays: 7, now: new Date("2026-07-15T00:00:00Z") });
    expect(cmp.revenueChangePct).toBeNull();
  });
});

describe("getRevenueTrend", () => {
  it("returns a dense, zero-filled daily series across the window", async () => {
    findMany.mockResolvedValueOnce([
      { createdAt: new Date("2026-07-02T09:00:00Z"), amount: 1000 },
      { createdAt: new Date("2026-07-02T15:00:00Z"), amount: 500 },
      { createdAt: new Date("2026-07-05T12:00:00Z"), amount: 3000 },
    ] as never);

    const trend = await getRevenueTrend("org-1", scope);
    expect(trend).toHaveLength(7); // Jul 1..7 inclusive of start, exclusive of the 8th
    expect(trend[0]).toEqual({ date: "2026-07-01", revenue: 0, count: 0 });
    expect(trend.find((p) => p.date === "2026-07-02")).toEqual({ date: "2026-07-02", revenue: 1500, count: 2 });
    expect(trend.find((p) => p.date === "2026-07-05")).toEqual({ date: "2026-07-05", revenue: 3000, count: 1 });
  });
});

describe("getSourceMix", () => {
  it("maps completed volume by source, largest first", async () => {
    groupBy.mockResolvedValueOnce([
      { source: "payment_link", _count: { id: 3 }, _sum: { amount: 3000 } },
      { source: "shopify", _count: { id: 5 }, _sum: { amount: 9000 } },
    ] as never);
    const mix = await getSourceMix("org-1", scope);
    expect(mix[0]).toEqual({ source: "shopify", count: 5, volume: 9000 });
    expect(mix[1]).toEqual({ source: "payment_link", count: 3, volume: 3000 });
  });
});

describe("getFailureBreakdown", () => {
  it("returns plain-language buckets from result codes", async () => {
    groupBy.mockResolvedValueOnce([
      { resultCode: 1, status: "failed", _count: { id: 2 } },
      { resultCode: 1032, status: "cancelled", _count: { id: 4 } },
    ] as never);
    const out = await getFailureBreakdown("org-1", scope);
    expect(out).toEqual([
      { reason: "Cancelled by customer", count: 4 },
      { reason: "Insufficient funds", count: 2 },
    ]);
  });
});

describe("getFunnel", () => {
  it("computes initiated/responded/completed from status groups", async () => {
    groupBy.mockResolvedValueOnce([
      { status: "completed", _count: { id: 6 } },
      { status: "failed", _count: { id: 2 } },
      { status: "cancelled", _count: { id: 1 } },
      { status: "pending", _count: { id: 3 } },
    ] as never);
    const funnel = await getFunnel("org-1", scope);
    expect(funnel).toEqual({ initiated: 12, responded: 9, completed: 6 });
  });
});

describe("getNewVsRepeatCustomers", () => {
  it("splits distinct payers into new vs returning", async () => {
    // in-window distinct phones
    findMany.mockResolvedValueOnce([{ phone: "a" }, { phone: "b" }, { phone: "c" }] as never);
    // prior distinct phones (b already existed before the window)
    findMany.mockResolvedValueOnce([{ phone: "b" }] as never);

    const split = await getNewVsRepeatCustomers("org-1", scope);
    expect(split).toEqual({ newCustomers: 2, repeatCustomers: 1 });
  });

  it("short-circuits with zeros and no prior query when nobody paid", async () => {
    findMany.mockResolvedValueOnce([] as never);
    const split = await getNewVsRepeatCustomers("org-1", scope);
    expect(split).toEqual({ newCustomers: 0, repeatCustomers: 0 });
    expect(findMany).toHaveBeenCalledTimes(1);
  });
});
