import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getOrganizationContext } from "@/lib/repositories/organizations";
import { listTransactions, transactionStatusSummary, summarizeStats } from "@/lib/repositories/transactions";
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

  // Fetch initial transactions and stats
  const transactions = await listTransactions(context.organization.id, { take: 50 });
  const allStats = await transactionStatusSummary(context.organization.id);
  const initialSummary = summarizeStats(allStats);

  return (
    <DashboardView 
      initialSummary={initialSummary} 
      initialTransactions={transactions} 
    />
  );
}
