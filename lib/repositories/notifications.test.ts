import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '@/lib/db';
import {
  createNotification,
  listNotifications,
  countUnreadNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from './notifications';

vi.mock('@/lib/db', () => ({
  prisma: {
    notification: { create: vi.fn(), findMany: vi.fn(), count: vi.fn(), updateMany: vi.fn() },
  },
}));

describe('notifications repository', () => {
  beforeEach(() => vi.clearAllMocks());

  it('createNotification persists the org-scoped payload with href defaulting to null', async () => {
    vi.mocked(prisma.notification.create).mockResolvedValueOnce({} as never);
    await createNotification({ organizationId: 'org-1', type: 'kyc.approved', title: 'T', body: 'B' });
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: { organizationId: 'org-1', type: 'kyc.approved', title: 'T', body: 'B', href: null },
    });
  });

  it('listNotifications is org-scoped, newest first', async () => {
    vi.mocked(prisma.notification.findMany).mockResolvedValueOnce([] as never);
    await listNotifications('org-1');
    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: 'org-1' }, orderBy: { createdAt: 'desc' } })
    );
  });

  it('countUnreadNotifications filters by org + unread', async () => {
    vi.mocked(prisma.notification.count).mockResolvedValueOnce(3 as never);
    const n = await countUnreadNotifications('org-1');
    expect(n).toBe(3);
    expect(prisma.notification.count).toHaveBeenCalledWith({ where: { organizationId: 'org-1', read: false } });
  });

  it('markNotificationRead is scoped to id AND organizationId (no cross-tenant writes)', async () => {
    vi.mocked(prisma.notification.updateMany).mockResolvedValueOnce({ count: 1 } as never);
    await markNotificationRead('org-1', 'n-1');
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({ where: { id: 'n-1', organizationId: 'org-1' }, data: { read: true } });
  });

  it('markAllNotificationsRead only touches the org’s unread rows', async () => {
    vi.mocked(prisma.notification.updateMany).mockResolvedValueOnce({ count: 2 } as never);
    await markAllNotificationsRead('org-1');
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({ where: { organizationId: 'org-1', read: false }, data: { read: true } });
  });
});
