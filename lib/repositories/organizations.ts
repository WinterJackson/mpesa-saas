import { prisma } from '@/lib/db';

// Locally defined to avoid importing model types from @prisma/client, which
// are not reliably exported in Prisma 7 with the Neon adapter (see lib/auth.ts).

export interface Organization {
  id: string;
  clerkOrgId: string;
  businessName: string;
  kycStatus: string;
  liveApprovedAt: Date | null;
  liveApprovedBy: string | null;
  environment: string;
  createdAt: Date;
}

export interface Membership {
  id: string;
  organizationId: string;
  clerkUserId: string;
  role: string;
  createdAt: Date;
}

export interface OrganizationMerchant {
  id: string;
  businessName: string;
  webhookUrl: string | null;
  webhookSecret: string | null;
  shopifyShopDomain: string | null;
  shopifyAdminAccessToken: string | null;
  shopifyWebhookSecret: string | null;
  environment: string;
}

export interface OrganizationContext {
  organization: Organization;
  membership: Membership;
  merchant: OrganizationMerchant | null;
}

/**
 * Resolves which Organization the signed-in Clerk user is currently acting in.
 *
 * Clerk's own active-organization selection (auth()'s orgId, once Organizations
 * is enabled) is the source of truth when present — pass it as activeClerkOrgId.
 * Falls back to the user's sole Membership row, which covers every Phase 1 case
 * before a user has more than one organization to switch between.
 */
export async function getOrganizationContext(
  clerkUserId: string,
  activeClerkOrgId?: string | null
): Promise<OrganizationContext | null> {
  const membership = activeClerkOrgId
    ? await prisma.membership.findFirst({
        where: { clerkUserId, organization: { clerkOrgId: activeClerkOrgId } },
        include: { organization: { include: { merchant: true } } },
      })
    : await prisma.membership.findFirst({
        where: { clerkUserId },
        orderBy: { createdAt: 'asc' },
        include: { organization: { include: { merchant: true } } },
      });

  if (!membership) return null;

  const { organization, ...membershipRow } = membership;
  const { merchant, ...organizationRow } = organization;

  return {
    organization: organizationRow,
    membership: membershipRow,
    merchant: merchant ?? null,
  };
}

export async function findOrganizationById(organizationId: string): Promise<Organization | null> {
  return prisma.organization.findUnique({ where: { id: organizationId } });
}

export async function findMembership(
  organizationId: string,
  clerkUserId: string
): Promise<Membership | null> {
  return prisma.membership.findUnique({
    where: { organizationId_clerkUserId: { organizationId, clerkUserId } },
  });
}

export async function listMemberships(organizationId: string): Promise<Membership[]> {
  return prisma.membership.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'asc' },
  });
}

export async function findOrganizationByClerkOrgId(clerkOrgId: string): Promise<Organization | null> {
  return prisma.organization.findUnique({ where: { clerkOrgId } });
}

export async function createMembership(
  organizationId: string,
  clerkUserId: string,
  role: string
): Promise<Membership> {
  return prisma.membership.create({
    data: { organizationId, clerkUserId, role },
  });
}

export async function removeMembership(organizationId: string, clerkUserId: string): Promise<void> {
  await prisma.membership.deleteMany({ where: { organizationId, clerkUserId } });
}

export async function updateMembershipRole(
  organizationId: string,
  clerkUserId: string,
  role: string
): Promise<Membership> {
  return prisma.membership.update({
    where: { organizationId_clerkUserId: { organizationId, clerkUserId } },
    data: { role },
  });
}

export interface MerchantSettingsUpdate {
  environment?: string;
  webhookUrl?: string | null;
  shopifyShopDomain?: string | null;
  shopifyAdminAccessToken?: string | null;
  shopifyWebhookSecret?: string | null;
}

// `where: { organizationId }` relies on Merchant.organizationId being unique
// (one Merchant per Organization, per Phase 1's data model) — this is what
// makes this update inherently tenant-scoped rather than an accident of a
// primary-key lookup.
export async function updateMerchantForOrganization(
  organizationId: string,
  data: MerchantSettingsUpdate
): Promise<OrganizationMerchant> {
  return prisma.merchant.update({
    where: { organizationId },
    data,
  });
}
