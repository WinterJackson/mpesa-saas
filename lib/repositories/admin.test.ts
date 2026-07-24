import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '@/lib/db';
import {
  findAdminUserByClerkId,
  createAdminUser,
  removeAdminUser,
  listAllOrganizations,
  updateOrganizationKycStatus,
  platformOverviewStats,
} from './admin';

vi.mock('@/lib/db', () => ({
  prisma: {
    adminUser: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
    organization: { findMany: vi.fn(), count: vi.fn(), update: vi.fn() },
    kycDocument: { count: vi.fn() },
    transaction: { count: vi.fn() },
  },
}));

describe('admin repository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('findAdminUserByClerkId looks up by clerkUserId', async () => {
    vi.mocked(prisma.adminUser.findUnique).mockResolvedValueOnce(null as never);
    await findAdminUserByClerkId('user-1');
    expect(prisma.adminUser.findUnique).toHaveBeenCalledWith({ where: { clerkUserId: 'user-1' } });
  });

  it('createAdminUser writes clerkUserId and role', async () => {
    vi.mocked(prisma.adminUser.create).mockResolvedValueOnce({} as never);
    await createAdminUser('user-1', 'superadmin');
    expect(prisma.adminUser.create).toHaveBeenCalledWith({
      data: { clerkUserId: 'user-1', role: 'superadmin', displayName: null, email: null, createdBy: null },
    });
  });

  it('removeAdminUser deletes by id', async () => {
    vi.mocked(prisma.adminUser.delete).mockResolvedValueOnce({} as never);
    await removeAdminUser('admin-1');
    expect(prisma.adminUser.delete).toHaveBeenCalledWith({ where: { id: 'admin-1' } });
  });

  it('listAllOrganizations is not scoped to any single organizationId (platform-wide by design)', async () => {
    vi.mocked(prisma.organization.findMany).mockResolvedValueOnce([] as never);
    await listAllOrganizations();
    const call = vi.mocked(prisma.organization.findMany).mock.calls[0][0];
    expect(call?.where).toBeUndefined();
  });

  it('updateOrganizationKycStatus updates the given organization', async () => {
    vi.mocked(prisma.organization.update).mockResolvedValueOnce({} as never);
    await updateOrganizationKycStatus('org-1', 'approved');
    expect(prisma.organization.update).toHaveBeenCalledWith({ where: { id: 'org-1' }, data: { kycStatus: 'approved' } });
  });

  it('platformOverviewStats aggregates organization, pending KYC, and transaction counts', async () => {
    vi.mocked(prisma.organization.count).mockResolvedValueOnce(5 as never);
    vi.mocked(prisma.kycDocument.count).mockResolvedValueOnce(2 as never);
    vi.mocked(prisma.transaction.count).mockResolvedValueOnce(100 as never);

    const stats = await platformOverviewStats();
    expect(stats).toEqual({ organizationCount: 5, pendingKycCount: 2, transactionCount: 100 });
  });
});
