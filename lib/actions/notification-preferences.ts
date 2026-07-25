'use server';

import { auth } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { getOrganizationContext } from '@/lib/repositories/organizations';
import {
  updateNotificationPreferences,
  type NotificationPreferences,
  PREFERENCE_KEYS,
} from '@/lib/repositories/notification-preferences';
import { requireRole } from '@/lib/rbac';
import { writeAuditLog } from '@/lib/repositories/audit-log';
import { logger } from '@/lib/logger';

export type NotificationPrefsResult = { success: boolean; message: string };

/** Roles allowed to manage org-wide notification preferences. */
const PREFS_ROLES = ['owner', 'admin'] as const;

/**
 * Saves the org's in-app notification preferences (owner/admin only). Coerces
 * every category to a strict boolean so a malformed payload can't partially
 * write. Audit-logs which categories are now enabled — no PII involved.
 */
export async function saveNotificationPreferencesAction(
  input: Partial<Record<keyof NotificationPreferences, boolean>>
): Promise<NotificationPrefsResult> {
  const { userId, orgId } = await auth();
  if (!userId) return { success: false, message: 'Not signed in.' };

  const context = await getOrganizationContext(userId, orgId);
  if (!context) return { success: false, message: 'Organization not found.' };

  const rbac = await requireRole(context.organization.id, userId, [...PREFS_ROLES]);
  if (!rbac.allowed) return { success: false, message: rbac.error };

  const prefs = PREFERENCE_KEYS.reduce((acc, key) => {
    acc[key] = input[key] === true;
    return acc;
  }, {} as NotificationPreferences);

  try {
    await updateNotificationPreferences(context.organization.id, prefs);
    await writeAuditLog({
      organizationId: context.organization.id,
      actorId: userId,
      action: 'notification_preferences.updated',
      metadata: { enabled: PREFERENCE_KEYS.filter((k) => prefs[k]) },
    });
    revalidatePath('/settings/notifications');
    return { success: true, message: 'Notification preferences saved.' };
  } catch (error) {
    logger.error('[notifications] save preferences failed', error);
    return { success: false, message: 'Could not save preferences. Please try again.' };
  }
}
