import { prisma } from '@/lib/db';

/**
 * Per-organization notification preferences (guardrail #6: org-scoped, takes
 * organizationId). Controls which CATEGORIES of in-app notifications are
 * generated for the org's dashboard bell. Never holds secret material.
 *
 * Absent a stored row, DEFAULT_PREFERENCES apply — so a brand-new org receives
 * everything except opt-in product updates without needing a row written first.
 */

export interface NotificationPreferences {
  paymentAlerts: boolean;
  payoutAlerts: boolean;
  billingAlerts: boolean;
  securityAlerts: boolean;
  productUpdates: boolean;
}

export const DEFAULT_PREFERENCES: NotificationPreferences = {
  paymentAlerts: true,
  payoutAlerts: true,
  billingAlerts: true,
  securityAlerts: true,
  productUpdates: false,
};

/** The five toggleable categories, in display order. */
export const PREFERENCE_KEYS = [
  'paymentAlerts',
  'payoutAlerts',
  'billingAlerts',
  'securityAlerts',
  'productUpdates',
] as const;

export type PreferenceKey = (typeof PREFERENCE_KEYS)[number];

/** Returns the org's preferences, or the defaults if none have been saved. */
export async function getNotificationPreferences(
  organizationId: string
): Promise<NotificationPreferences> {
  const row = await prisma.notificationPreference.findUnique({ where: { organizationId } });
  if (!row) return { ...DEFAULT_PREFERENCES };
  return {
    paymentAlerts: row.paymentAlerts,
    payoutAlerts: row.payoutAlerts,
    billingAlerts: row.billingAlerts,
    securityAlerts: row.securityAlerts,
    productUpdates: row.productUpdates,
  };
}

/** Upserts the org's preferences. */
export async function updateNotificationPreferences(
  organizationId: string,
  prefs: NotificationPreferences
): Promise<NotificationPreferences> {
  const row = await prisma.notificationPreference.upsert({
    where: { organizationId },
    create: { organizationId, ...prefs },
    update: { ...prefs },
  });
  return {
    paymentAlerts: row.paymentAlerts,
    payoutAlerts: row.payoutAlerts,
    billingAlerts: row.billingAlerts,
    securityAlerts: row.securityAlerts,
    productUpdates: row.productUpdates,
  };
}

/**
 * Maps an in-app notification `type` (e.g. "payout.completed") to the preference
 * category that gates it. Unknown/unmapped types return null and are ALWAYS
 * delivered — a new notification type is never silently dropped by omission.
 */
export function categoryForNotificationType(type: string): PreferenceKey | null {
  const prefix = type.split('.')[0];
  switch (prefix) {
    case 'payment':
    case 'transaction':
      return 'paymentAlerts';
    case 'payout':
    case 'refund':
      return 'payoutAlerts';
    case 'invoice':
    case 'subscription':
      return 'billingAlerts';
    case 'kyc':
    case 'golive':
      return 'securityAlerts';
    case 'product':
      return 'productUpdates';
    // 'balance' is deliberately NOT mapped to a category — a low-balance alert
    // must always reach the merchant regardless of notification preferences,
    // since it directly predicts payout/refund failures. Falls through to the
    // default case below (always delivered).
    default:
      return null;
  }
}

/**
 * Whether the org wants an in-app notification of the given type. Fails OPEN
 * (returns true) on any lookup error so a preferences-store hiccup never
 * silently swallows an important alert.
 */
export async function isNotificationTypeEnabled(
  organizationId: string,
  type: string
): Promise<boolean> {
  const category = categoryForNotificationType(type);
  if (!category) return true;
  try {
    const prefs = await getNotificationPreferences(organizationId);
    return prefs[category];
  } catch {
    return true;
  }
}
