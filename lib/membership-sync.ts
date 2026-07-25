import { clerkClient } from '@clerk/nextjs/server';
import {
  findOrganizationByClerkOrgId,
  findMembership,
  createMembership,
} from '@/lib/repositories/organizations';
import { logger } from '@/lib/logger';

const VALID_ROLES = ['owner', 'admin', 'developer', 'finance'];

/**
 * Self-heals a local Membership row for a user who has already joined a Clerk
 * Organization but whose local Membership hasn't been created yet.
 *
 * WHY THIS EXISTS: local Membership rows are normally created by the Clerk
 * webhook (`app/api/webhooks/clerk`) when an invitation is accepted. But an
 * invited teammate can land on the dashboard/onboarding BEFORE that webhook
 * arrives (or when `CLERK_WEBHOOK_SIGNING_SECRET` isn't configured yet). Without
 * this, `getOrganizationContext` returns null and the invitee is wrongly shown
 * the create-your-organization wizard — which would spin up a DUPLICATE org and
 * make them its owner. This reconciler closes that gap by reading their role
 * straight from the Clerk org membership metadata and creating the local row.
 *
 * Idempotent and defensive: returns true only when a local membership exists (or
 * was just created) for `activeClerkOrgId`; never throws — a failure just means
 * "couldn't reconcile", and the caller falls back to its normal null handling.
 */
export async function reconcileMembershipFromClerk(
  clerkUserId: string,
  activeClerkOrgId: string | null | undefined
): Promise<boolean> {
  if (!activeClerkOrgId) return false;

  try {
    const organization = await findOrganizationByClerkOrgId(activeClerkOrgId);
    if (!organization) return false;

    // Already reconciled (e.g. the webhook won the race) — nothing to do.
    const existing = await findMembership(organization.id, clerkUserId);
    if (existing) return true;

    // Read the invitee's intended PaySwift role from their Clerk org membership.
    const client = await clerkClient();
    const memberships = await client.organizations.getOrganizationMembershipList({
      organizationId: activeClerkOrgId,
      limit: 100,
    });

    const mine = memberships.data.find((m) => m.publicUserData?.userId === clerkUserId);
    if (!mine) return false; // not actually a member of this Clerk org

    const requestedRole = (mine.publicMetadata as Record<string, unknown> | undefined)?.payswiftRole;
    const role = typeof requestedRole === 'string' && VALID_ROLES.includes(requestedRole)
      ? requestedRole
      : 'developer';

    await createMembership(organization.id, clerkUserId, role);
    logger.info(
      `[MembershipSync] Reconciled membership for ${clerkUserId} in org ${organization.id} (role: ${role})`
    );
    return true;
  } catch (error: unknown) {
    logger.warn(
      '[MembershipSync] Reconciliation failed:',
      error instanceof Error ? error.message : 'unknown'
    );
    return false;
  }
}
