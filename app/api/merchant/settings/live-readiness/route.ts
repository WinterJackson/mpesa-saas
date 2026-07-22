import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { isLiveModeConfigured } from '@/lib/daraja';
import { getOrganizationContext } from '@/lib/repositories/organizations';
import { logger } from '@/lib/logger';

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

    return NextResponse.json(
      { success: true, data: { liveReady: await isLiveModeConfigured(context.organization.id) } },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Live Readiness Error]:', message);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
