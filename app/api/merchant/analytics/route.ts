import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getOrganizationContext } from '@/lib/repositories/organizations';
import { getViewEnvironment } from '@/lib/view-env';
import {
  getKpiComparison,
  getRevenueTrend,
  getSourceMix,
  getFailureBreakdown,
  getFunnel,
  getNewVsRepeatCustomers,
  getPeakTimeHeatmap,
} from '@/lib/repositories/analytics';

const ALLOWED_RANGES = [7, 30, 90] as const;

/**
 * Merchant dashboard analytics bundle for a rolling window. Read-only, any org
 * member; respects the Sandbox/Live view filter. Powers the dashboard's range
 * selector (7 / 30 / 90 days) without a full page reload.
 */
export async function GET(request: Request) {
  const { userId, orgId } = await auth();
  if (!userId) return NextResponse.json({ success: false, error: 'Not signed in.' }, { status: 401 });

  const context = await getOrganizationContext(userId, orgId);
  if (!context) return NextResponse.json({ success: false, error: 'Organization not found.' }, { status: 404 });

  const url = new URL(request.url);
  const rangeParam = Number(url.searchParams.get('range'));
  const range = (ALLOWED_RANGES as readonly number[]).includes(rangeParam) ? rangeParam : 30;

  const environment = await getViewEnvironment(context.merchant?.environment);
  const now = new Date();
  const since = new Date(now.getTime() - range * 24 * 60 * 60 * 1000);
  const scope = { environment, since, until: now };
  const orgId2 = context.organization.id;

  const [kpis, trend, sourceMix, failures, funnel, customers, heatmap] = await Promise.all([
    getKpiComparison(orgId2, { environment, windowDays: range, now }),
    getRevenueTrend(orgId2, scope),
    getSourceMix(orgId2, scope),
    getFailureBreakdown(orgId2, scope),
    getFunnel(orgId2, scope),
    getNewVsRepeatCustomers(orgId2, scope),
    getPeakTimeHeatmap(orgId2, scope),
  ]);

  return NextResponse.json({
    success: true,
    data: { range, environment, kpis, trend, sourceMix, failures, funnel, customers, heatmap },
  });
}
