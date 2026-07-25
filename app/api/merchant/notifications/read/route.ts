import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getOrganizationContext } from '@/lib/repositories/organizations';
import { markNotificationRead, markAllNotificationsRead } from '@/lib/repositories/notifications';
import { logger } from '@/lib/logger';

/**
 * POST /api/merchant/notifications/read — mark notifications read.
 * Body: { id } to mark one, or {} to mark all. Org-scoped so a member can only
 * affect their own org's notifications.
 */
export async function POST(request: Request) {
  try {
    const { userId, orgId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const context = await getOrganizationContext(userId, orgId);
    if (!context) {
      return NextResponse.json({ success: false, error: 'Organization not found' }, { status: 404 });
    }

    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch {
      // Empty body = mark all.
    }

    if (typeof body.id === 'string' && body.id) {
      await markNotificationRead(context.organization.id, body.id);
    } else {
      await markAllNotificationsRead(context.organization.id);
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: unknown) {
    logger.error('[Notifications Read Error]:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
