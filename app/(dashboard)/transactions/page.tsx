import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Download } from "lucide-react";
import { getOrganizationContext } from "@/lib/repositories/organizations";
import { listTransactionsPage } from "@/lib/repositories/transactions";
import { getViewEnvironment } from "@/lib/view-env";
import { TransactionsTable } from "@/components/dashboard/transactions-table";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Transactions - PaySwift",
  description: "View all your M-Pesa transactions",
};

export default async function TransactionsPage() {
  const { userId, orgId } = await auth();
  if (!userId) redirect("/sign-in");

  const context = await getOrganizationContext(userId, orgId);
  if (!context) redirect("/onboarding");

  const viewEnv = await getViewEnvironment(context.merchant?.environment);
  const { data: transactions, nextCursor } = await listTransactionsPage(context.organization.id, {
    limit: 50,
    environment: viewEnv,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Transactions</h1>
          <p className="text-sm text-muted-foreground">
            Full history of all payments through your account.
          </p>
        </div>
        <a href={`/api/merchant/transactions/export?environment=${viewEnv}`} download>
          <Button variant="outline" size="sm">
            <Download className="mr-1.5 size-4" /> Export CSV
          </Button>
        </a>
      </div>
      <TransactionsTable
        initialTransactions={transactions}
        initialNextCursor={nextCursor}
        showFilters={true}
        limit={50}
        environment={viewEnv}
      />
    </div>
  );
}
