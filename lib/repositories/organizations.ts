import { prisma } from '@/lib/db';

// Locally defined to avoid importing model types from @prisma/client, which
// are not reliably exported in Prisma 7 with the Neon adapter (see lib/auth.ts).

export interface Organization {
  id: string;
  clerkOrgId: string;
  businessName: string;
  kycStatus: string;
  liveRequestedAt: Date | null;
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
 * Active-organization FIRST, membership fallback SECOND: Clerk's active-org id
 * (auth()'s orgId) is preferred when it matches one of the user's memberships,
 * but if it doesn't — e.g. Clerk assigned a different active org during sign-up
 * (the "choose-organization" task), or the id is stale — we fall back to the
 * user's own membership rather than returning null. Returning null here would
 * bounce an already-onboarded user into an /onboarding ⇄ /dashboard redirect loop.
 */
export async function getOrganizationContext(
  clerkUserId: string,
  activeClerkOrgId?: string | null
): Promise<OrganizationContext | null> {
  const include = { organization: { include: { merchant: true } } } as const;

  let membership = activeClerkOrgId
    ? await prisma.membership.findFirst({
        where: { clerkUserId, organization: { clerkOrgId: activeClerkOrgId } },
        include,
      })
    : null;

  // Fallback: the user's own membership (oldest first) regardless of active org.
  if (!membership) {
    membership = await prisma.membership.findFirst({
      where: { clerkUserId },
      orderBy: { createdAt: 'asc' },
      include,
    });
  }

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

/** Merchant requested go-live; marks the org for the admin review queue. */
export async function setLiveRequested(organizationId: string): Promise<Organization> {
  return prisma.organization.update({
    where: { id: organizationId },
    data: { liveRequestedAt: new Date() },
  });
}

/**
 * Admin approves go-live: stamps liveApprovedAt/By and flips both the
 * Organization (canonical approved state) and its Merchant (operational toggle)
 * to live, atomically.
 */
export async function approveGoLive(organizationId: string, adminClerkUserId: string): Promise<Organization> {
  const [org] = await prisma.$transaction([
    prisma.organization.update({
      where: { id: organizationId },
      data: { liveApprovedAt: new Date(), liveApprovedBy: adminClerkUserId, environment: 'live' },
    }),
    prisma.merchant.update({ where: { organizationId }, data: { environment: 'live' } }),
  ]);
  return org;
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
