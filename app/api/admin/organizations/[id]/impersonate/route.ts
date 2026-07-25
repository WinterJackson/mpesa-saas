import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { requireAdminCapability } from '@/lib/admin-auth';
import { findOrganizationById, listMemberships } from '@/lib/repositories/organizations';
import { writeAuditLog } from '@/lib/repositories/audit-log';
import { logger } from '@/lib/logger';

/**
 * POST /api/admin/organizations/[id]/impersonate
 *
 * Support-impersonation entry point (master plan Section 4.6). Every call writes
 * an AuditLog row BEFORE anything else — impersonation must never ship without an
 * audit trail.
 *
 * Implemented via Clerk ACTOR TOKENS (Clerk's official, reversible impersonation
 * mechanism): we mint a short-lived actor token for the organization's owner with
 * the acting admin recorded as the `actor`, and return a sign-in ticket URL. When
 * the admin visits it, Clerk establishes a session AS the owner that carries an
 * `act` claim identifying the impersonator — so the impersonation is attributable
 * and the admin can sign back out to their own account. No customer password is
 * ever exposed. Requires only CLERK_SECRET_KEY (already configured); if the Clerk
 * instance rejects actor tokens, we surface a clear error (the audit row still
 * stands).
 */
const TICKET_TTL_SECONDS = 600; // 10 minutes to start the session

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const adminAuth = await requireAdminCapability(userId, 'impersonate');
    if (!adminAuth.allowed) {
      return NextResponse.json({ success: false, error: adminAuth.error }, { status: adminAuth.status });
    }

    const { id } = await params;
    const organization = await findOrganizationById(id);
    if (!organization) {
      return NextResponse.json({ success: false, error: 'Organization not found' }, { status: 404 });
    }

    // Impersonate the org's owner (fall back to any member if none is flagged owner).
    const memberships = await listMemberships(organization.id);
    const target = memberships.find((m) => m.role === 'owner') ?? memberships[0];
    if (!target) {
      return NextResponse.json({ success: false, error: 'This organization has no members to view as.' }, { status: 400 });
    }

    // Audit BEFORE minting the token.
    await writeAuditLog({
      organizationId: organization.id,
      actorId: userId,
      action: 'admin.impersonated',
      metadata: { organizationBusinessName: organization.businessName, targetClerkUserId: target.clerkUserId },
    });

    let token: string;
    try {
      const client = await clerkClient();
      const actorToken = await client.actorTokens.create({
        userId: target.clerkUserId,
        actor: { sub: userId },
        expiresInSeconds: TICKET_TTL_SECONDS,
      });
      if (!actorToken.token) {
        throw new Error('Clerk returned no actor token');
      }
      token = actorToken.token;
    } catch (clerkError: unknown) {
      logger.error('[Admin Impersonate] actor token creation failed:', clerkError instanceof Error ? clerkError.message : 'unknown');
      return NextResponse.json(
        { success: false, error: 'Could not start an impersonation session. Enable Actor Tokens for this Clerk instance and try again.' },
        { status: 502 }
      );
    }

    const signInUrl = process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL || '/sign-in';
    const ticketUrl = `${signInUrl}?__clerk_ticket=${encodeURIComponent(token)}`;

    return NextResponse.json({ success: true, ticketUrl }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Admin Impersonate Error]:', message);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
