import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { DashboardView } from "@/components/dashboard/dashboard-view";

interface TransactionGroupStat {
  status: string;
  _count: { id: number };
  _sum: { amount: number | null };
}

export const metadata = {
  title: "Dashboard - PaySwift",
  description: "Monitor your M-Pesa collections",
};

export default async function DashboardPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const merchant = await prisma.merchant.findUnique({
    where: { clerkUserId: userId },
    select: { id: true },
  });

  if (!merchant) {
    redirect("/onboarding");
  }

  // Fetch initial transactions and stats
  const transactions = await prisma.transaction.findMany({
    where: { merchantId: merchant.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      amount: true,
      phone: true,
      status: true,
      orderReference: true,
      environment: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const allStats = await prisma.transaction.groupBy({
    by: ["status"],
    where: { merchantId: merchant.id },
    _count: { id: true },
    _sum: { amount: true },
  });

  let overallTotal = 0;
  let overallRevenue = 0;
  let overallCompleted = 0;
  let overallPending = 0;

  allStats.forEach((stat: TransactionGroupStat) => {
    const count = stat._count.id;
    overallTotal += count;
    if (stat.status === "completed") {
      overallCompleted += count;
      overallRevenue += stat._sum.amount || 0;
    }
    if (stat.status === "pending") {
      overallPending += count;
    }
  });

  const successRate = overallTotal > 0 ? Math.round((overallCompleted / overallTotal) * 100) : 0;

  const initialSummary = {
    totalTransactions: overallTotal,
    totalRevenue: overallRevenue,
    successRate,
    pendingCount: overallPending,
  };

  return (
    <DashboardView 
      initialSummary={initialSummary} 
      initialTransactions={transactions} 
    />
  );
}
