import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { isLiveModeConfigured } from '@/lib/daraja';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json(
      { success: true, data: { liveReady: isLiveModeConfigured() } },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Live Readiness Error]:', message);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
