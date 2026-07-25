import {
  findAdminUserByClerkId,
  findPendingInviteByEmail,
  createAdminUser,
  markAdminInviteAccepted,
} from '@/lib/repositories/admin';
import { writeAuditLog } from '@/lib/repositories/audit-log';
import { logger } from '@/lib/logger';

/**
 * Binds a pending email-based admin invite to a real AdminUser on the invitee's
 * first authenticated /admin request.
 *
 * WHY: a superadmin can invite platform staff BY EMAIL before that person has a
 * PaySwift/Clerk account. Once they sign up (Clerk-verifying the email) and open
 * /admin, this reconciler matches their verified email against a pending, unexpired
 * AdminInvite and promotes them — the admin-console analogue of the merchant
 * `reconcileMembershipFromClerk`. Email ownership is proven by Clerk sign-up
 * verification, so matching on the verified primary email is the security anchor.
 *
 * Idempotent and defensive: returns true only when the user is (now) an AdminUser;
 * never throws — a failure just means "not reconciled" and the caller falls back
 * to its normal not-an-admin handling.
 */
export async function reconcileAdminFromInvite(
  clerkUserId: string,
  email: string | null | undefined
): Promise<boolean> {
  try {
    // Already an admin (e.g. a concurrent request or the immediate-grant path won).
    const existing = await findAdminUserByClerkId(clerkUserId);
    if (existing) return true;

    if (!email) return false;

    const invite = await findPendingInviteByEmail(email);
    if (!invite) return false;

    await createAdminUser(clerkUserId, invite.role, {
      email,
      createdBy: invite.invitedBy,
    });
    await markAdminInviteAccepted(invite.id, clerkUserId);

    await writeAuditLog({
      actorId: clerkUserId,
      action: 'admin_invite.accepted',
      metadata: { inviteId: invite.id, role: invite.role, invitedBy: invite.invitedBy },
    });

    logger.info(`[AdminInviteSync] Bound admin invite ${invite.id} to ${clerkUserId} (role: ${invite.role})`);
    return true;
  } catch (error: unknown) {
    logger.warn('[AdminInviteSync] Reconciliation failed:', error instanceof Error ? error.message : 'unknown');
    return false;
  }
}
