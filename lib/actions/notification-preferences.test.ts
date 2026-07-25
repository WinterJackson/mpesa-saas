import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/repositories/organizations', () => ({ getOrganizationContext: vi.fn() }));
vi.mock('@/lib/repositories/notification-preferences', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/repositories/notification-preferences')>();
  return { ...actual, updateNotificationPreferences: vi.fn() };
});
vi.mock('@/lib/rbac', () => ({ requireRole: vi.fn() }));
vi.mock('@/lib/repositories/audit-log', () => ({ writeAuditLog: vi.fn() }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { saveNotificationPreferencesAction } from './notification-preferences';
import { auth } from '@clerk/nextjs/server';
import { getOrganizationContext } from '@/lib/repositories/organizations';
import { updateNotificationPreferences } from '@/lib/repositories/notification-preferences';
import { requireRole } from '@/lib/rbac';
import { writeAuditLog } from '@/lib/repositories/audit-log';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue({ userId: 'user-1', orgId: 'org-1' } as never);
  vi.mocked(getOrganizationContext).mockResolvedValue({ organization: { id: 'org-1' }, membership: { role: 'admin' } } as never);
  vi.mocked(requireRole).mockResolvedValue({ allowed: true, membership: { role: 'admin' } } as never);
  vi.mocked(updateNotificationPreferences).mockResolvedValue({} as never);
});

describe('saveNotificationPreferencesAction', () => {
  it('401s equivalent when not signed in', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ userId: null, orgId: null } as never);
    const res = await saveNotificationPreferencesAction({ payoutAlerts: true });
    expect(res.success).toBe(false);
    expect(updateNotificationPreferences).not.toHaveBeenCalled();
  });

  it('rejects a role without permission (e.g. developer/finance)', async () => {
    vi.mocked(requireRole).mockResolvedValueOnce({ allowed: false, error: 'Insufficient permissions for this action', status: 403 } as never);
    const res = await saveNotificationPreferencesAction({ payoutAlerts: true });
    expect(res.success).toBe(false);
    expect(updateNotificationPreferences).not.toHaveBeenCalled();
  });

  it('coerces every category to a strict boolean and persists all five keys', async () => {
    // Only two keys provided; the rest must be written as false, never undefined.
    const res = await saveNotificationPreferencesAction({ payoutAlerts: true, productUpdates: true });
    expect(res.success).toBe(true);
    expect(updateNotificationPreferences).toHaveBeenCalledWith('org-1', {
      paymentAlerts: false,
      payoutAlerts: true,
      billingAlerts: false,
      securityAlerts: false,
      productUpdates: true,
    });
  });

  it('audit-logs only the enabled category names (no PII)', async () => {
    await saveNotificationPreferencesAction({ billingAlerts: true });
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'notification_preferences.updated', metadata: { enabled: ['billingAlerts'] } })
    );
  });
});
