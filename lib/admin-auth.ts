import { findAdminUserByClerkId, type AdminUser } from '@/lib/repositories/admin';

export type AdminRole = 'support' | 'superadmin';

// Mirrors lib/rbac.ts's Result-type pattern, but checks the AdminUser table —
// deliberately separate from Membership/requireRole so a platform admin can
// never accidentally inherit tenant-scoped permissions.
export type AdminAuthResult =
  | { allowed: true; admin: AdminUser }
  | { allowed: false; error: string; status: number };

export async function requireAdmin(
  clerkUserId: string,
  allowedRoles: AdminRole[] = ['support', 'superadmin']
): Promise<AdminAuthResult> {
  const admin = await findAdminUserByClerkId(clerkUserId);

  if (!admin) {
    return { allowed: false, error: 'Not authorized as a platform admin', status: 403 };
  }

  if (!allowedRoles.includes(admin.role as AdminRole)) {
    return { allowed: false, error: 'Insufficient admin permissions for this action', status: 403 };
  }

  return { allowed: true, admin };
}
