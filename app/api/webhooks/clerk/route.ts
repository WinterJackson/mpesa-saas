import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhook } from '@clerk/nextjs/webhooks';
import {
  findOrganizationByClerkOrgId,
  findMembership,
  createMembership,
  removeMembership,
  updateMembershipRole,
} from '@/lib/repositories/organizations';
import { logger } from '@/lib/logger';

const VALID_ROLES = ['owner', 'admin', 'developer', 'finance'];

/**
 * POST /api/webhooks/clerk
 *
 * Syncs Clerk Organization membership changes into the local Membership
 * table. Membership.role is our own source of truth (see lib/rbac.ts) — not
 * Clerk's built-in org roles — so a new member's role is read from the
 * invitation's public_metadata.payswiftRole (set by the team-invite route),
 * which Clerk copies onto the membership when an invitation is accepted.
 * Defaults to "developer" if absent (e.g. the org creator's own membership,
 * which app/api/merchant/setup/route.ts already creates directly — this
 * handler is a no-op for that case since the membership already exists).
 *
 * Requires CLERK_WEBHOOK_SIGNING_SECRET to be configured once a webhook
 * endpoint is added in the Clerk Dashboard pointing at this route.
 */
export async function POST(request: NextRequest) {
  let evt;
  try {
    evt = await verifyWebhook(request);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.warn('[Clerk Webhook] Signature verification failed:', message);
    return NextResponse.json({ success: false, error: 'Invalid signature' }, { status: 400 });
  }

  try {
    if (evt.type === 'organizationMembership.created') {
      const clerkOrgId = evt.data.organization.id;
      const clerkUserId = evt.data.public_user_data.user_id;
      const requestedRole = (evt.data.public_metadata as Record<string, unknown> | undefined)?.payswiftRole;
      const role = typeof requestedRole === 'string' && VALID_ROLES.includes(requestedRole)
        ? requestedRole
        : 'developer';

      const organization = await findOrganizationByClerkOrgId(clerkOrgId);
      if (!organization) {
        logger.warn(`[Clerk Webhook] organizationMembership.created for unknown clerkOrgId ${clerkOrgId}`);
        return NextResponse.json({ success: true }, { status: 200 });
      }

      const existing = await findMembership(organization.id, clerkUserId);
      if (!existing) {
        await createMembership(organization.id, clerkUserId, role);
        logger.info(`[Clerk Webhook] Created Membership for ${clerkUserId} in org ${organization.id} (role: ${role})`);
      }
    }

    if (evt.type === 'organizationMembership.deleted') {
      const clerkOrgId = evt.data.organization.id;
      const clerkUserId = evt.data.public_user_data.user_id;

      const organization = await findOrganizationByClerkOrgId(clerkOrgId);
      if (organization) {
        await removeMembership(organization.id, clerkUserId);
        logger.info(`[Clerk Webhook] Removed Membership for ${clerkUserId} in org ${organization.id}`);
      }
    }

    if (evt.type === 'organizationMembership.updated') {
      const clerkOrgId = evt.data.organization.id;
      const clerkUserId = evt.data.public_user_data.user_id;
      const requestedRole = (evt.data.public_metadata as Record<string, unknown> | undefined)?.payswiftRole;

      if (typeof requestedRole === 'string' && VALID_ROLES.includes(requestedRole)) {
        const organization = await findOrganizationByClerkOrgId(clerkOrgId);
        if (organization) {
          await updateMembershipRole(organization.id, clerkUserId, requestedRole);
        }
      }
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Clerk Webhook] Processing error:', message);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
