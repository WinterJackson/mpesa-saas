import { prisma } from '@/lib/db';
import { prismaReadonly } from '@/lib/db-readonly';

export interface AdminUser {
  id: string;
  clerkUserId: string;
  role: string;
  createdAt: Date;
}

export async function findAdminUserByClerkId(clerkUserId: string): Promise<AdminUser | null> {
  return prisma.adminUser.findUnique({ where: { clerkUserId } });
}

export async function listAdminUsers(): Promise<AdminUser[]> {
  return prisma.adminUser.findMany({ orderBy: { createdAt: 'asc' } });
}

export async function createAdminUser(clerkUserId: string, role: string): Promise<AdminUser> {
  return prisma.adminUser.create({ data: { clerkUserId, role } });
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
