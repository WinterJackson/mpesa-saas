import { NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/auth';
import { listTransactionsPage } from '@/lib/repositories/transactions';
import { enforcePlanRateLimit, rateLimitHeaders, retryAfterSeconds } from '@/lib/plan-rate-limit';
import { logger } from '@/lib/logger';

/**
 * GET /api/v1/transactions — cursor-paginated list of the caller's transactions.
 * Part of the frozen public contract. Query: cursor?, limit? (1–100), status?,
 * environment?. Returns { success, data: { transactions, nextCursor } }.
 */
export async function GET(request: Request) {
  try {
    const authResult = await authenticateApiKey(request);
    if (!authResult.success) {
      return NextResponse.json({ success: false, error: authResult.error }, { status: authResult.status });
    }

    const rl = await enforcePlanRateLimit(authResult.organizationId, 'transactions');
    if (!rl.ok) {
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded' },
        { status: 429, headers: { ...rateLimitHeaders(rl), 'Retry-After': String(retryAfterSeconds(rl)) } }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = await listTransactionsPage(authResult.organizationId, {
      cursor: searchParams.get('cursor'),
      limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined,
      status: searchParams.get('status') ?? undefined,
      environment: searchParams.get('environment') ?? undefined,
    });

    return NextResponse.json(
      { success: true, data: { transactions: page.data, nextCursor: page.nextCursor } },
      { status: 200, headers: rateLimitHeaders(rl) }
    );
  } catch (error: unknown) {
    logger.error('[V1 Transactions List Error]:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
