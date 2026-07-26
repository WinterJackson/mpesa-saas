import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { requireAdminCapability } from '@/lib/admin-auth';
import { getSignupFunnel, getMrrAndChurn } from '@/lib/repositories/admin-analytics';
import { getAdminBillingOverview } from '@/lib/repositories/billing';

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return new NextResponse('Unauthorized', { status: 401 });

  const adminAuth = await requireAdminCapability(userId, 'ops:view');
  if (!adminAuth.allowed) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  // Parse date range if provided, else default to trailing 30 days
  const url = new URL(request.url);
  const sinceParam = url.searchParams.get('since');
  const untilParam = url.searchParams.get('until');

  const until = untilParam ? new Date(untilParam) : new Date();
  const since = sinceParam ? new Date(sinceParam) : new Date(until.getTime() - 30 * 24 * 60 * 60 * 1000);

  const scope = { since, until };

  const [funnel, mrrAndChurn, billingOverview] = await Promise.all([
    getSignupFunnel(scope),
    getMrrAndChurn(scope),
    getAdminBillingOverview(),
  ]);

  return NextResponse.json({
    funnel,
    mrrAndChurn,
    byPlan: billingOverview.byPlan,
    atRisk: billingOverview.atRisk,
  });
}
