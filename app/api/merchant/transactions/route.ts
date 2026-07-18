import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';

interface TransactionRow {
  id: string;
  amount: number;
  phone: string;
  status: string;
  orderReference: string | null;
  environment: string;
  source: string;
  createdAt: Date;
  updatedAt: Date;
}

interface TransactionGroupStat {
  status: string;
  _count: { id: number };
  _sum: { amount: number | null };
}

export async function GET(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const merchant = await prisma.merchant.findUnique({
      where: { clerkUserId: userId },
    });

    if (!merchant) {
      return NextResponse.json({ success: false, error: 'Merchant not found' }, { status: 404 });
    }

    // Get searchParams for basic pagination if needed
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const transactions: TransactionRow[] = await prisma.transaction.findMany({
      where: { merchantId: merchant.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
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
      }
    });

    // Total historical metrics (we could query these from DB for full history, 
    // but for the demo we'll use the fetched ones or run aggregate queries)
    const allStats = await prisma.transaction.groupBy({
      by: ['status'],
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
      if (stat.status === 'completed') {
        overallCompleted += count;
        overallRevenue += stat._sum.amount || 0;
      }
      if (stat.status === 'pending') {
        overallPending += count;
      }
    });

    const successRate = overallTotal > 0 ? Math.round((overallCompleted / overallTotal) * 100) : 0;

    return NextResponse.json(
      { 
        success: true, 
        data: {
          transactions,
          summary: {
            totalTransactions: overallTotal,
            totalRevenue: overallRevenue,
            successRate,
            pendingCount: overallPending,
          }
        } 
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Merchant Transactions GET Error]:', message);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
