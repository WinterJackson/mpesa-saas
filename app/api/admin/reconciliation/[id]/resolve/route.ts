import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { requireAdminCapability } from '@/lib/admin-auth';
import { resolveMismatch } from '@/lib/repositories/reconciliation';
import { writeAuditLog } from '@/lib/repositories/audit-log';
import { logger } from '@/lib/logger';

/** POST /api/admin/reconciliation/[id]/resolve — mark a mismatch resolved/ignored. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const adminAuth = await requireAdminCapability(userId, 'recon:resolve');
    if (!adminAuth.allowed) return NextResponse.json({ success: false, error: adminAuth.error }, { status: adminAuth.status });

    const { id } = await params;
    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch {
      /* default below */
    }
    const status = body.status === 'ignored' ? 'ignored' : 'resolved';

    await resolveMismatch(id, status);
    await writeAuditLog({ actorId: userId, action: 'reconciliation.mismatch_resolved', metadata: { mismatchId: id, status } });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: unknown) {
    logger.error('[Admin Resolve Mismatch Error]:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
