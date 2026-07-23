import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getOrganizationContext } from '@/lib/repositories/organizations';
import { listDeliveries } from '@/lib/repositories/webhook-deliveries';
import { logger } from '@/lib/logger';

/**
 * GET /api/merchant/webhook-deliveries — org-scoped, cursor-paginated webhook
 * delivery history across ALL resource types (payment, payout AND refund —
 * previously only transactions were shown). Query: cursor?, limit?.
 */
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

    const { searchParams } = new URL(request.url);
    const page = await listDeliveries(context.organization.id, {
      cursor: searchParams.get('cursor'),
      limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined,
    });

    return NextResponse.json(
      { success: true, data: { deliveries: page.data, nextCursor: page.nextCursor } },
      { status: 200 }
    );
  } catch (error: unknown) {
    logger.error('[Get Webhook Deliveries Error]:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
