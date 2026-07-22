import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getOrganizationContext } from '@/lib/repositories/organizations';
import { listTransactions, transactionStatusSummary, summarizeStats } from '@/lib/repositories/transactions';
import { logger } from '@/lib/logger';

export async function GET(request: Request) {
  try {
    const { userId, orgId } = await auth();

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const context = await getOrganizationContext(userId, orgId);

    if (!context) {
      return NextResponse.json({ success: false, error: 'Organization not found' }, { status: 404 });
    }

    const { organization } = context;

    // Get searchParams for basic pagination if needed
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const transactions = await listTransactions(organization.id, { take: limit });
    const allStats = await transactionStatusSummary(organization.id);
    const summary = summarizeStats(allStats);

    return NextResponse.json(
      {
        success: true,
        data: { transactions, summary },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Merchant Transactions GET Error]:', message);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
