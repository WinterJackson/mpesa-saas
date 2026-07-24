import { findAdminUserByClerkId, type AdminUser } from '@/lib/repositories/admin';
import {
  roleHasCapability,
  type AdminCapability,
  type AdminRole,
} from '@/lib/admin-rbac';

// AdminRole now lives in lib/admin-rbac.ts (the capability-matrix source of
// truth); re-exported here so existing `import { AdminRole } from '@/lib/admin-auth'`
// call sites keep working.
export type { AdminRole };

// Mirrors lib/rbac.ts's Result-type pattern, but checks the AdminUser table —
// deliberately separate from Membership/requireRole so a platform admin can
// never accidentally inherit tenant-scoped permissions.
export type AdminAuthResult =
  | { allowed: true; admin: AdminUser }
  | { allowed: false; error: string; status: number };

// A disabled admin account loses access immediately everywhere, while its
// AuditLog history and lineage are preserved (see Phase 4.5 Stage B). Treated
// as active when the field is absent (legacy rows / test fixtures).
function isDisabled(admin: AdminUser): boolean {
  return admin.status === 'disabled';
}

/**
 * "Is this Clerk user an active platform admin (optionally in one of these
 * roles)?" — the coarse gate for admin READ pages. Every one of the five admin
 * roles is allowed by default; pass `allowedRoles` only to narrow further.
 * Mutations should prefer `requireAdminCapability` instead of a role list.
 */
export async function requireAdmin(
  clerkUserId: string,
  allowedRoles?: AdminRole[]
): Promise<AdminAuthResult> {
  const admin = await findAdminUserByClerkId(clerkUserId);

  if (!admin) {
    return { allowed: false, error: 'Not authorized as a platform admin', status: 403 };
  }

  if (isDisabled(admin)) {
    return { allowed: false, error: 'This admin account has been disabled', status: 403 };
  }

  if (allowedRoles && !allowedRoles.includes(admin.role as AdminRole)) {
    return { allowed: false, error: 'Insufficient admin permissions for this action', status: 403 };
  }

  return { allowed: true, admin };
}

/**
 * Capability-gated admin authorization — the preferred gate for every admin
 * MUTATION and for sensitive cross-tenant views. Reads the fixed role→capability
 * matrix in lib/admin-rbac.ts rather than comparing role strings inline.
 */
export async function requireAdminCapability(
  clerkUserId: string,
  capability: AdminCapability
): Promise<AdminAuthResult> {
  const admin = await findAdminUserByClerkId(clerkUserId);

  if (!admin) {
    return { allowed: false, error: 'Not authorized as a platform admin', status: 403 };
  }

  if (isDisabled(admin)) {
    return { allowed: false, error: 'This admin account has been disabled', status: 403 };
  }

  if (!roleHasCapability(admin.role, capability)) {
    return { allowed: false, error: 'Insufficient admin permissions for this action', status: 403 };
  }

  return { allowed: true, admin };
}
