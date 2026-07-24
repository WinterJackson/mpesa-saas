import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getOrganizationContext } from "@/lib/repositories/organizations";
import { listTransactions, transactionStatusSummary, summarizeStats } from "@/lib/repositories/transactions";
import { getViewEnvironment } from "@/lib/view-env";
import { DashboardView } from "@/components/dashboard/dashboard-view";

export const metadata = {
  title: "Dashboard - PaySwift",
  description: "Monitor your M-Pesa collections",
};

export default async function DashboardPage() {
  const { userId, orgId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const context = await getOrganizationContext(userId, orgId);

  if (!context) {
    redirect("/onboarding");
  }

  const viewEnv = await getViewEnvironment(context.merchant?.environment);

  // Fetch initial transactions and stats filtered by the current view environment
  const transactions = await listTransactions(context.organization.id, { take: 50, environment: viewEnv });
  const allStats = await transactionStatusSummary(context.organization.id, { environment: viewEnv });
  const initialSummary = summarizeStats(allStats);

  return (
    <DashboardView 
      initialSummary={initialSummary} 
      initialTransactions={transactions} 
    />
  );
}
