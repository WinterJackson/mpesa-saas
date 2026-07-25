import { prisma } from '@/lib/db';
import { prismaReadonly } from '@/lib/db-readonly';

export interface AdminUser {
  id: string;
  clerkUserId: string;
  role: string;
  // Phase 4.5 fields — optional in the interface so legacy rows and test
  // fixtures that predate them still satisfy the type; the DB always populates
  // `status` with a default.
  status?: string;
  displayName?: string | null;
  email?: string | null;
  createdBy?: string | null;
  lastActiveAt?: Date | null;
  createdAt: Date;
}

export async function findAdminUserByClerkId(clerkUserId: string): Promise<AdminUser | null> {
  return prisma.adminUser.findUnique({ where: { clerkUserId } });
}

export async function findAdminUserByEmail(email: string): Promise<AdminUser | null> {
  return prisma.adminUser.findFirst({ where: { email } });
}

export async function listAdminUsers(): Promise<AdminUser[]> {
  return prisma.adminUser.findMany({ orderBy: { createdAt: 'asc' } });
}

export async function createAdminUser(
  clerkUserId: string,
  role: string,
  extra?: { displayName?: string | null; email?: string | null; createdBy?: string | null }
): Promise<AdminUser> {
  return prisma.adminUser.create({
    data: {
      clerkUserId,
      role,
      displayName: extra?.displayName ?? null,
      email: extra?.email ?? null,
      createdBy: extra?.createdBy ?? null,
    },
  });
}

export async function setAdminUserStatus(id: string, status: 'active' | 'disabled'): Promise<AdminUser> {
  return prisma.adminUser.update({ where: { id }, data: { status } });
}

export async function touchAdminLastActive(clerkUserId: string): Promise<void> {
  // Best-effort activity heartbeat (Phase 4.5 Stage H) — never block a request
  // on it.
  await prisma.adminUser.update({ where: { clerkUserId }, data: { lastActiveAt: new Date() } }).catch(() => {});
}

export async function removeAdminUser(id: string): Promise<void> {
  await prisma.adminUser.delete({ where: { id } });
}

// ─── Admin invites (email-based admin onboarding, Phase 4.5 Stage B) ──────────
//
// A superadmin invites platform staff BY EMAIL + role. If the person already has
// a Clerk account we bind an AdminUser immediately; otherwise we store a pending
// AdminInvite here and bind it on their first authenticated /admin request
// (lib/admin-invite-sync.ts). Emails are normalized lowercase so lookups match
// regardless of how they were typed.

export interface AdminInvite {
  id: string;
  email: string;
  role: string;
  token: string;
  invitedBy: string;
  acceptedAt: Date | null;
  acceptedBy: string | null;
  expiresAt: Date;
  createdAt: Date;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Creates (or refreshes) a pending invite for an email. Idempotent per email:
 * an existing UN-accepted invite is updated in place (new role/token/expiry)
 * rather than duplicated, so re-inviting simply extends the window.
 */
export async function upsertAdminInvite(params: {
  email: string;
  role: string;
  token: string;
  invitedBy: string;
  expiresAt: Date;
}): Promise<AdminInvite> {
  const email = normalizeEmail(params.email);
  const existing = await prisma.adminInvite.findFirst({ where: { email, acceptedAt: null } });
  if (existing) {
    return prisma.adminInvite.update({
      where: { id: existing.id },
      data: { role: params.role, token: params.token, invitedBy: params.invitedBy, expiresAt: params.expiresAt },
    });
  }
  return prisma.adminInvite.create({
    data: { email, role: params.role, token: params.token, invitedBy: params.invitedBy, expiresAt: params.expiresAt },
  });
}

/** The newest still-valid (un-accepted, un-expired) invite for an email, or null. */
export async function findPendingInviteByEmail(email: string): Promise<AdminInvite | null> {
  return prisma.adminInvite.findFirst({
    where: { email: normalizeEmail(email), acceptedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
}

/** All un-accepted invites (for the console list), newest first. */
export async function listPendingAdminInvites(): Promise<AdminInvite[]> {
  return prisma.adminInvite.findMany({ where: { acceptedAt: null }, orderBy: { createdAt: 'desc' } });
}

export async function markAdminInviteAccepted(id: string, acceptedBy: string): Promise<AdminInvite> {
  return prisma.adminInvite.update({ where: { id }, data: { acceptedAt: new Date(), acceptedBy } });
}

export async function deleteAdminInvite(id: string): Promise<void> {
  await prisma.adminInvite.delete({ where: { id } });
}

// ─── Platform-wide queries (admin console only — deliberately NOT tenant-scoped) ──

export interface OrganizationSummary {
  id: string;
  businessName: string;
  kycStatus: string;
  environment: string;
  createdAt: Date;
  _count: { transactions: number; memberships: number };
}

export async function listAllOrganizations(): Promise<OrganizationSummary[]> {
  // Read-heavy admin listing — routed through the (optionally replica-backed)
  // read client, see lib/db-readonly.ts.
  return prismaReadonly.organization.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      businessName: true,
      kycStatus: true,
      environment: true,
      createdAt: true,
      _count: { select: { transactions: true, memberships: true } },
    },
  });
}

export async function findOrganizationWithDetails(organizationId: string) {
  return prisma.organization.findUnique({
    where: { id: organizationId },
    include: {
      merchant: true,
      memberships: true,
      kycDocuments: { orderBy: { createdAt: 'desc' } },
      darajaCredential: { select: { isPooledSandbox: true, shortcode: true, shortcodeLive: true } },
    },
  });
}

export async function updateOrganizationKycStatus(
  organizationId: string,
  kycStatus: 'pending' | 'approved' | 'rejected'
) {
  return prisma.organization.update({ where: { id: organizationId }, data: { kycStatus } });
}

export async function platformOverviewStats() {
  // Read-heavy admin dashboard snapshot — see lib/db-readonly.ts.
  const [organizationCount, pendingKycCount, transactionCount] = await Promise.all([
    prismaReadonly.organization.count(),
    prismaReadonly.kycDocument.count({ where: { reviewStatus: 'pending' } }),
    prismaReadonly.transaction.count(),
  ]);
  return { organizationCount, pendingKycCount, transactionCount };
}
