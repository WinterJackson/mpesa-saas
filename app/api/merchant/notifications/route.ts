import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getOrganizationContext } from '@/lib/repositories/organizations';
import { listNotifications, countUnreadNotifications } from '@/lib/repositories/notifications';
import { logger } from '@/lib/logger';

/**
 * GET /api/merchant/notifications — the org's in-app notification feed + unread
 * count for the dashboard bell. Available to any member (it's their org's feed).
 */
export async function GET() {
  try {
    const { userId, orgId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const context = await getOrganizationContext(userId, orgId);
    if (!context) {
      return NextResponse.json({ success: false, error: 'Organization not found' }, { status: 404 });
    }

    const [notifications, unreadCount] = await Promise.all([
      listNotifications(context.organization.id, { take: 20 }),
      countUnreadNotifications(context.organization.id),
    ]);

    return NextResponse.json({ success: true, data: { notifications, unreadCount } }, { status: 200 });
  } catch (error: unknown) {
    logger.error('[Notifications List Error]:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
