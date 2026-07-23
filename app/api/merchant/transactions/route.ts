import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getOrganizationContext } from '@/lib/repositories/organizations';
import { listTransactionsPage, transactionStatusSummary, summarizeStats } from '@/lib/repositories/transactions';
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

    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get('cursor');

    const page = await listTransactionsPage(organization.id, {
      cursor,
      limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined,
      environment: searchParams.get('environment') ?? undefined,
      status: searchParams.get('status') ?? undefined,
    });

    // The status summary only makes sense on the first page (whole-account totals).
    const summary = cursor
      ? undefined
      : summarizeStats(await transactionStatusSummary(organization.id));

    return NextResponse.json(
      {
        success: true,
        data: { transactions: page.data, nextCursor: page.nextCursor, summary },
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
