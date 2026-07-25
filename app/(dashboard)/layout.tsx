import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getOrganizationContext } from "@/lib/repositories/organizations";
import { reconcileMembershipFromClerk } from "@/lib/membership-sync";
import { getSubscriptionStatus } from "@/lib/repositories/billing";
import { Sidebar } from "@/components/dashboard/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/dashboard/user-menu";
import { NotificationBell } from "@/components/dashboard/notification-bell";
import { EnvViewToggle } from "@/components/dashboard/env-view-toggle";
import { DashboardBillingBanner } from "@/components/billing/dashboard-billing-banner";
import { getViewEnvironment } from "@/lib/view-env";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId, orgId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  // Ensure the org/merchant exists (if they bypassed onboarding)
  let context = await getOrganizationContext(userId, orgId);

  // Invited teammate whose local Membership hasn't synced yet: reconcile it from
  // Clerk before falling back to onboarding, so they never bounce through the
  // create-org wizard (which would create a duplicate org).
  if (!context && orgId) {
    const reconciled = await reconcileMembershipFromClerk(userId, orgId);
    if (reconciled) {
      context = await getOrganizationContext(userId, orgId);
    }
  }

  if (!context) {
    redirect("/onboarding");
  }

  const businessName = context.merchant?.businessName ?? context.organization.businessName;
  const viewEnv = await getViewEnvironment(context.merchant?.environment);

  // Surface a payment prompt across the dashboard when the subscription needs it
  // (paid plan awaiting first payment, failed renewal, or soft-locked).
  const subStatus = await getSubscriptionStatus(context.organization.id);
  const billingAlert =
    subStatus && ['incomplete', 'past_due', 'suspended'].includes(subStatus.status)
      ? { status: subStatus.status as 'incomplete' | 'past_due' | 'suspended', planName: subStatus.plan.name }
      : null;

  return (
    <div className="flex h-screen overflow-hidden bg-dashboard bg-cover bg-center bg-no-repeat relative z-0">
      {/* Sidebar (Desktop) / Bottom Nav (Mobile) */}
      <Sidebar role={context.membership.role} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden pb-16 md:pb-0">
        {/* Header */}
        <div className="w-full shrink-0 pt-floating-header pl-[15px] md:pl-[30px] pr-0 pb-4">
          <header className="w-full rounded-l-[40px] rounded-r-none bg-background dark:bg-card text-foreground backdrop-blur-md shadow-floating-header">
            <div className="flex h-20 w-full items-center justify-between px-4 md:px-6">
              <div className="flex items-center gap-4 min-w-0 border-b-2 border-r-2 border-sidebar pr-4 pb-1 rounded-br-xl">
                <h1 className="text-sm md:text-lg font-semibold tracking-tight text-foreground truncate max-w-[200px] md:max-w-[320px]">
                  {businessName}
                </h1>
              </div>
              <div className="flex items-center gap-4 ml-auto">
                <div className="hidden md:block">
                  <EnvViewToggle initial={viewEnv} />
                </div>
                <NotificationBell />
                <ThemeToggle />
                <UserMenu />
              </div>
            </div>
          </header>
          {/* Mobile Sandbox/Live Toggle */}
          <div className="md:hidden flex justify-end pr-4 mt-4">
            <EnvViewToggle initial={viewEnv} />
          </div>
        </div>

        {/* Scrollable Main Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="mx-auto max-w-7xl 2xl:max-w-[1600px]">
            {billingAlert && (
              <DashboardBillingBanner status={billingAlert.status} planName={billingAlert.planName} />
            )}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
