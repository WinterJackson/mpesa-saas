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
