import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '@/lib/db';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  categoryForNotificationType,
  isNotificationTypeEnabled,
  DEFAULT_PREFERENCES,
} from './notification-preferences';

vi.mock('@/lib/db', () => ({
  prisma: {
    notificationPreference: { findUnique: vi.fn(), upsert: vi.fn() },
  },
}));

const ALL_ON = {
  paymentAlerts: true,
  payoutAlerts: true,
  billingAlerts: true,
  securityAlerts: true,
  productUpdates: true,
};

describe('categoryForNotificationType', () => {
  it('maps known type prefixes to their preference category', () => {
    expect(categoryForNotificationType('payout.completed')).toBe('payoutAlerts');
    expect(categoryForNotificationType('refund.failed')).toBe('payoutAlerts');
    expect(categoryForNotificationType('invoice.paid')).toBe('billingAlerts');
    expect(categoryForNotificationType('subscription.suspended')).toBe('billingAlerts');
    expect(categoryForNotificationType('kyc.approved')).toBe('securityAlerts');
    expect(categoryForNotificationType('golive.approved')).toBe('securityAlerts');
    expect(categoryForNotificationType('payment.succeeded')).toBe('paymentAlerts');
    expect(categoryForNotificationType('product.launch')).toBe('productUpdates');
  });

  it('returns null (never gated) for an unknown type', () => {
    expect(categoryForNotificationType('something.new')).toBeNull();
  });
});

describe('getNotificationPreferences', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns defaults when no row exists', async () => {
    vi.mocked(prisma.notificationPreference.findUnique).mockResolvedValueOnce(null as never);
    const prefs = await getNotificationPreferences('org-1');
    expect(prefs).toEqual(DEFAULT_PREFERENCES);
  });

  it('reflects the stored row', async () => {
    vi.mocked(prisma.notificationPreference.findUnique).mockResolvedValueOnce({ ...ALL_ON, payoutAlerts: false } as never);
    const prefs = await getNotificationPreferences('org-1');
    expect(prefs.payoutAlerts).toBe(false);
    expect(prefs.billingAlerts).toBe(true);
  });
});

describe('updateNotificationPreferences', () => {
  beforeEach(() => vi.clearAllMocks());

  it('upserts org-scoped and returns the saved shape', async () => {
    vi.mocked(prisma.notificationPreference.upsert).mockResolvedValueOnce(ALL_ON as never);
    const res = await updateNotificationPreferences('org-1', ALL_ON);
    expect(prisma.notificationPreference.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: 'org-1' } })
    );
    expect(res).toEqual(ALL_ON);
  });
});

describe('isNotificationTypeEnabled', () => {
  beforeEach(() => vi.clearAllMocks());

  it('allows an unknown type without hitting the DB', async () => {
    const ok = await isNotificationTypeEnabled('org-1', 'weird.event');
    expect(ok).toBe(true);
    expect(prisma.notificationPreference.findUnique).not.toHaveBeenCalled();
  });

  it('respects a disabled category', async () => {
    vi.mocked(prisma.notificationPreference.findUnique).mockResolvedValueOnce({ ...ALL_ON, payoutAlerts: false } as never);
    expect(await isNotificationTypeEnabled('org-1', 'payout.completed')).toBe(false);
  });

  it('fails OPEN (returns true) if the lookup throws', async () => {
    vi.mocked(prisma.notificationPreference.findUnique).mockRejectedValueOnce(new Error('db down'));
    expect(await isNotificationTypeEnabled('org-1', 'payout.completed')).toBe(true);
  });
});
