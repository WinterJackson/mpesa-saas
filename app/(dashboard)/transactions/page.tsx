import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { TransactionsTable } from "@/components/dashboard/transactions-table";

export const metadata = {
  title: "Transactions - PaySwift",
  description: "View all your M-Pesa transactions",
};

export default async function TransactionsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const merchant = await prisma.merchant.findUnique({ where: { clerkUserId: userId } });
  if (!merchant) redirect("/onboarding");

  const transactions = await prisma.transaction.findMany({
    where: { merchantId: merchant.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      amount: true,
      phone: true,
      status: true,
      orderReference: true,
      environment: true,
      source: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Transactions</h1>
        <p className="text-sm text-muted-foreground">
          Full history of all payments through your account.
        </p>
      </div>
      <TransactionsTable initialTransactions={transactions} showFilters={true} />
    </div>
  );
}
