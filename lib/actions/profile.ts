'use server';

import { auth } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { getOrganizationContext } from '@/lib/repositories/organizations';
import { updateBusinessName } from '@/lib/repositories/organizations';
import { requireRole } from '@/lib/rbac';
import { writeAuditLog } from '@/lib/repositories/audit-log';
import { logger } from '@/lib/logger';

export type ProfileActionResult = { success: boolean; message: string };

/** Roles allowed to edit the business profile (developer/finance are read-only). */
const PROFILE_ROLES = ['owner', 'admin'] as const;

/**
 * Renames the business (owner/admin only). Personal identity — name, email,
 * password, MFA — is owned by Clerk and managed through the embedded profile
 * component, not here. This action only touches the org-level display name.
 */
export async function updateBusinessNameAction(input: {
  businessName: string;
}): Promise<ProfileActionResult> {
  const { userId, orgId } = await auth();
  if (!userId) return { success: false, message: 'Not signed in.' };

  const context = await getOrganizationContext(userId, orgId);
  if (!context) return { success: false, message: 'Organization not found.' };

  const rbac = await requireRole(context.organization.id, userId, [...PROFILE_ROLES]);
  if (!rbac.allowed) return { success: false, message: rbac.error };

  const businessName = input.businessName?.trim() ?? '';
  if (businessName.length < 2) {
    return { success: false, message: 'Business name must be at least 2 characters.' };
  }
  if (businessName.length > 100) {
    return { success: false, message: 'Business name must be 100 characters or fewer.' };
  }

  try {
    await updateBusinessName(context.organization.id, businessName);
    await writeAuditLog({
      organizationId: context.organization.id,
      actorId: userId,
      action: 'organization.business_name_updated',
      metadata: { field: 'businessName' },
    });
    revalidatePath('/settings/account');
    revalidatePath('/dashboard');
    return { success: true, message: 'Business name updated.' };
  } catch (error) {
    logger.error('[profile] updateBusinessName failed', error);
    return { success: false, message: 'Could not update the business name. Please try again.' };
  }
}
