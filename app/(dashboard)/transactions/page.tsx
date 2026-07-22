import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getOrganizationContext } from "@/lib/repositories/organizations";
import { listTransactions } from "@/lib/repositories/transactions";
import { TransactionsTable } from "@/components/dashboard/transactions-table";

export const metadata = {
  title: "Transactions - PaySwift",
  description: "View all your M-Pesa transactions",
};

export default async function TransactionsPage() {
  const { userId, orgId } = await auth();
  if (!userId) redirect("/sign-in");

  const context = await getOrganizationContext(userId, orgId);
  if (!context) redirect("/onboarding");

  const transactions = await listTransactions(context.organization.id, { take: 100 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Transactions</h1>
        <p className="text-sm text-muted-foreground">
          Full history of all payments through your account.
        </p>
      </div>
      <TransactionsTable initialTransactions={transactions} showFilters={true} limit={100} />
    </div>
  );
}
