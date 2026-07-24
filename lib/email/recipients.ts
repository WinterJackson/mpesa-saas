import { clerkClient } from '@clerk/nextjs/server';
import { listMemberships, findOrganizationById } from '@/lib/repositories/organizations';
import { listAdminUsers } from '@/lib/repositories/admin';
import { roleHasCapability, type AdminCapability } from '@/lib/admin-rbac';
import { logger } from '@/lib/logger';

/**
 * Resolves WHO gets a notification. Merchant emails live in Clerk (the local
 * Membership only stores clerkUserId); platform-staff emails live on AdminUser.
 *
 * Every resolver fails OPEN — a Clerk outage or a missing address returns an
 * empty list (logged), never throws. A notification with no recipients is
 * simply not sent.
 */

export interface OrgRecipients {
  businessName: string;
  emails: string[];
}

const MERCHANT_NOTIFY_ROLES = ['owner', 'admin'] as const;

async function emailsForClerkUserIds(clerkUserIds: string[]): Promise<string[]> {
  if (clerkUserIds.length === 0) return [];
  try {
    const client = await clerkClient();
    // One batched call rather than N getUser() round-trips.
    const { data } = await client.users.getUserList({ userId: clerkUserIds, limit: 100 });
    const emails: string[] = [];
    for (const user of data) {
      const primary =
        user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ??
        user.emailAddresses[0]?.emailAddress;
      if (primary) emails.push(primary);
    }
    return emails;
  } catch (err: unknown) {
    logger.error('[email] failed to resolve Clerk emails', err);
    return [];
  }
}

/**
 * The org's business name + the emails of its notifiable members
 * (owner + admin by default). Use for merchant-facing business/security emails.
 */
export async function resolveOrgRecipients(
  organizationId: string,
  roles: readonly string[] = MERCHANT_NOTIFY_ROLES
): Promise<OrgRecipients | null> {
  try {
    const organization = await findOrganizationById(organizationId);
    if (!organization) return null;

    const memberships = await listMemberships(organizationId);
    const targetIds = memberships.filter((m) => roles.includes(m.role)).map((m) => m.clerkUserId);
    // Fall back to every member if no owner/admin is present (small orgs mid-setup).
    const ids = targetIds.length > 0 ? targetIds : memberships.map((m) => m.clerkUserId);

    const emails = await emailsForClerkUserIds([...new Set(ids)]);
    return { businessName: organization.businessName, emails };
  } catch (err: unknown) {
    logger.error(`[email] failed to resolve org recipients for ${organizationId}`, err);
    return null;
  }
}

/**
 * Emails of active platform admins, optionally narrowed to those whose role
 * holds a capability (e.g. only kyc_reviewers for a KYC alert). Admins without
 * a stored email are skipped.
 */
export async function resolveStaffRecipients(capability?: AdminCapability): Promise<string[]> {
  try {
    const admins = await listAdminUsers();
    return admins
      .filter((a) => (a.status ?? 'active') !== 'disabled')
      .filter((a) => Boolean(a.email))
      .filter((a) => (capability ? roleHasCapability(a.role, capability) : true))
      .map((a) => a.email as string);
  } catch (err: unknown) {
    logger.error('[email] failed to resolve staff recipients', err);
    return [];
  }
}
