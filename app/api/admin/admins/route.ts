import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { requireAdminCapability } from '@/lib/admin-auth';
import { isAdminRole, ALL_ADMIN_ROLES } from '@/lib/admin-rbac';
import { listAdminUsers, createAdminUser } from '@/lib/repositories/admin';
import { writeAuditLog } from '@/lib/repositories/audit-log';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const adminAuth = await requireAdminCapability(userId, 'admin:manage');
    if (!adminAuth.allowed) {
      return NextResponse.json({ success: false, error: adminAuth.error }, { status: adminAuth.status });
    }

    const admins = await listAdminUsers();
    return NextResponse.json({ success: true, data: admins }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Admin List Error]:', message);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    // Only holders of `admin:manage` (superadmin) may grant admin access —
    // prevents a lower-privileged admin from escalating themselves or a colleague.
    const adminAuth = await requireAdminCapability(userId, 'admin:manage');
    if (!adminAuth.allowed) {
      return NextResponse.json({ success: false, error: adminAuth.error }, { status: adminAuth.status });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON payload' }, { status: 400 });
    }

    const { clerkUserId, role } = body;
    if (typeof clerkUserId !== 'string' || clerkUserId.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'clerkUserId is required' }, { status: 400 });
    }
    if (typeof role !== 'string' || !isAdminRole(role)) {
      return NextResponse.json(
        { success: false, error: `role must be one of: ${ALL_ADMIN_ROLES.join(', ')}` },
        { status: 400 }
      );
    }

    const admin = await createAdminUser(clerkUserId.trim(), role);

    await writeAuditLog({
      actorId: userId,
      action: 'admin_user.created',
      metadata: { newAdminClerkUserId: clerkUserId, role },
    });

    return NextResponse.json({ success: true, data: admin }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Admin Create Error]:', message);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
