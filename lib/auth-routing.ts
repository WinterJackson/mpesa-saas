import { requireAdmin } from '@/lib/admin-auth';
import { getOrganizationContext, type OrganizationContext } from '@/lib/repositories/organizations';
import { reconcileMembershipFromClerk } from '@/lib/membership-sync';

export async function resolveUserLanding(
  clerkUserId: string,
  clerkOrgId?: string | null
): Promise<{ destination: '/admin' | '/dashboard' | '/onboarding'; context?: OrganizationContext }> {
  
  // 1. Platform Admin Check
  const adminCheck = await requireAdmin(clerkUserId);
  if (adminCheck.allowed) {
    return { destination: '/admin' };
  }

  // 2. Active Merchant Check
  let context = await getOrganizationContext(clerkUserId, clerkOrgId);

  // 3. Invited teammate reconciliation guard
  if (!context && clerkOrgId) {
    const reconciled = await reconcileMembershipFromClerk(clerkUserId, clerkOrgId);
    if (reconciled) {
      context = await getOrganizationContext(clerkUserId, clerkOrgId) ?? null;
    }
  }

  if (context) {
    return { destination: '/dashboard', context };
  }

  // 4. Needs Onboarding
  return { destination: '/onboarding' };
}
