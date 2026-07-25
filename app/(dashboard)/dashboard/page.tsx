import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getOrganizationContext } from "@/lib/repositories/organizations";
import { listTransactions } from "@/lib/repositories/transactions";
import {
  getKpiComparison,
  getRevenueTrend,
  getSourceMix,
  getFailureBreakdown,
  getFunnel,
  getNewVsRepeatCustomers,
} from "@/lib/repositories/analytics";
import { getPlanUsage } from "@/lib/repositories/billing";
import { listPaymentLinks } from "@/lib/repositories/payment-links";
import { getViewEnvironment } from "@/lib/view-env";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import type { AnalyticsBundle, PlanUsage, LinksSummary } from "@/components/dashboard/analytics-section";

export const metadata = {
  title: "Dashboard - PaySwift",
  description: "Monitor your M-Pesa collections",
};

const DEFAULT_RANGE = 30;

export default async function DashboardPage() {
  const { userId, orgId } = await auth();
  if (!userId) redirect("/sign-in");

  const context = await getOrganizationContext(userId, orgId);
  if (!context) redirect("/onboarding");

  const environment = await getViewEnvironment(context.merchant?.environment);
  const orgIdResolved = context.organization.id;
  const now = new Date();
  const since = new Date(now.getTime() - DEFAULT_RANGE * 24 * 60 * 60 * 1000);
  const scope = { environment, since, until: now };

  const [kpis, trend, sourceMix, failures, funnel, customers, transactions, planUsageRaw, links] =
    await Promise.all([
      getKpiComparison(orgIdResolved, { environment, windowDays: DEFAULT_RANGE, now }),
      getRevenueTrend(orgIdResolved, scope),
      getSourceMix(orgIdResolved, scope),
      getFailureBreakdown(orgIdResolved, scope),
      getFunnel(orgIdResolved, scope),
      getNewVsRepeatCustomers(orgIdResolved, scope),
      listTransactions(orgIdResolved, { take: 50, environment }),
      getPlanUsage(orgIdResolved),
      listPaymentLinks(orgIdResolved, { environment }),
    ]);

  const analytics: AnalyticsBundle = { range: DEFAULT_RANGE, kpis, trend, sourceMix, failures, funnel, customers };

  const planUsage: PlanUsage = planUsageRaw
    ? {
        planName: planUsageRaw.planName,
        used: planUsageRaw.used,
        included: planUsageRaw.included,
        projectedOverageKes: planUsageRaw.projectedOverageKes,
      }
    : { planName: "—", used: 0, included: null, projectedOverageKes: 0 };

  const activeLinks = links.filter((l) => l.active);
  const best = [...activeLinks].sort((a, b) => b.paymentsVolume - a.paymentsVolume)[0];
  const linksSummary: LinksSummary = {
    activeCount: activeLinks.length,
    bestTitle: best && best.paymentsVolume > 0 ? best.title : null,
  };

  return (
    <DashboardView
      analytics={analytics}
      planUsage={planUsage}
      links={linksSummary}
      initialTransactions={transactions}
      currentRole={context.membership.role}
    />
  );
}
