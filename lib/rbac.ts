import { findMembership, type Membership } from '@/lib/repositories/organizations';

// Mirrors this codebase's existing AuthResult pattern (lib/auth.ts) rather
// than throwing, so callers handle authorization failures the same way they
// already handle authentication failures.
export type RbacResult =
  | { allowed: true; membership: Membership }
  | { allowed: false; error: string; status: number };

export type Role = 'owner' | 'admin' | 'developer' | 'finance';

/**
 * Enforces that the given Clerk user is a member of the given organization
 * with one of the allowed roles. Membership.role is our own source of truth
 * (see lib/repositories/organizations.ts) — not Clerk's built-in org roles —
 * so this never requires custom role configuration in the Clerk Dashboard.
 *
 * Call this at the top of every mutating route that's role-gated. Never rely
 * on the UI hiding an action alone — the UI check and this check both exist,
 * and this one is the one that actually matters.
 */
export async function requireRole(
  organizationId: string,
  clerkUserId: string,
  allowedRoles: Role[]
): Promise<RbacResult> {
  const membership = await findMembership(organizationId, clerkUserId);

  if (!membership) {
    return { allowed: false, error: 'Not a member of this organization', status: 403 };
  }

  if (!allowedRoles.includes(membership.role as Role)) {
    return { allowed: false, error: 'Insufficient permissions for this action', status: 403 };
  }

  return { allowed: true, membership };
}
