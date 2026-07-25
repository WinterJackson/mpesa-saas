import { NextResponse, after } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import crypto from 'node:crypto';
import { requireAdminCapability } from '@/lib/admin-auth';
import { isAdminRole, ALL_ADMIN_ROLES } from '@/lib/admin-rbac';
import {
  findAdminUserByClerkId,
  findAdminUserByEmail,
  createAdminUser,
  upsertAdminInvite,
  normalizeEmail,
} from '@/lib/repositories/admin';
import { notifyAdminInvited, notifyAdminAccessGranted } from '@/lib/email/notifications';
import { appBaseUrl } from '@/lib/email/layout';
import { writeAuditLog } from '@/lib/repositories/audit-log';
import { logger } from '@/lib/logger';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * POST /api/admin/admins/invite
 *
 * Invite a platform admin BY EMAIL (replaces the raw-clerkUserId path). Only
 * `admin:manage` (superadmin) may grant admin access.
 *
 * - If the email already belongs to a Clerk user → bind an AdminUser NOW and
 *   email them a "your admin access is ready" note.
 * - Otherwise → store a pending AdminInvite and email them a sign-up link; on
 *   their first /admin request it's reconciled into an AdminUser
 *   (lib/admin-invite-sync.ts).
 */
export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

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

    const rawEmail = body.email;
    const role = body.role;
    if (typeof rawEmail !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(rawEmail.trim())) {
      return NextResponse.json({ success: false, error: 'A valid email is required' }, { status: 400 });
    }
    if (typeof role !== 'string' || !isAdminRole(role)) {
      return NextResponse.json(
        { success: false, error: `role must be one of: ${ALL_ADMIN_ROLES.join(', ')}` },
        { status: 400 }
      );
    }

    const email = normalizeEmail(rawEmail);

    // Already an admin under this email? Nothing to do.
    const existingAdmin = await findAdminUserByEmail(email);
    if (existingAdmin) {
      return NextResponse.json(
        { success: false, error: 'That email already has admin access.' },
        { status: 409 }
      );
    }

    // Does the person already have a Clerk account? If so, bind immediately.
    const client = await clerkClient();
    const { data: matches } = await client.users.getUserList({ emailAddress: [email], limit: 1 });
    const clerkUser = matches[0];

    if (clerkUser) {
      // Guard against an AdminUser that exists by clerkUserId but not by that email.
      const already = await findAdminUserByClerkId(clerkUser.id);
      if (already) {
        return NextResponse.json({ success: false, error: 'That user already has admin access.' }, { status: 409 });
      }

      const displayName = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || null;
      const admin = await createAdminUser(clerkUser.id, role, { email, displayName, createdBy: userId });

      await writeAuditLog({
        actorId: userId,
        action: 'admin_user.created',
        metadata: { newAdminClerkUserId: clerkUser.id, role, via: 'email_invite_existing_user' },
      });

      after(() => notifyAdminAccessGranted(email, role, `${appBaseUrl()}/admin`));

      return NextResponse.json(
        { success: true, status: 'granted', data: admin },
        { status: 201 }
      );
    }

    // New person: store a pending invite + email them a sign-up link.
    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
    const invite = await upsertAdminInvite({ email, role, token, invitedBy: userId, expiresAt });

    await writeAuditLog({
      actorId: userId,
      action: 'admin_invite.created',
      metadata: { inviteId: invite.id, email, role },
    });

    const acceptUrl = `${appBaseUrl()}/sign-up?redirect_url=${encodeURIComponent('/admin')}`;
    after(() => notifyAdminInvited(email, role, acceptUrl));

    return NextResponse.json(
      { success: true, status: 'invited', data: { id: invite.id, email: invite.email, role: invite.role, expiresAt: invite.expiresAt } },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Admin Invite Error]:', message);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
