import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '@/lib/db';
import { findActiveApiKey, revokeActiveApiKeys, createApiKey } from './api-keys';

vi.mock('@/lib/db', () => ({
  prisma: {
    apiKey: {
      findFirst: vi.fn(),
    },
  },
}));

describe('api-keys repository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('findActiveApiKey always filters by organizationId and revoked: false', async () => {
    vi.mocked(prisma.apiKey.findFirst).mockResolvedValueOnce(null as never);
    await findActiveApiKey('org-1');
    expect(prisma.apiKey.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: 'org-1', revoked: false } })
    );
  });

  it('revokeActiveApiKeys scopes the update to organizationId + revoked: false', async () => {
    const tx = { apiKey: { updateMany: vi.fn().mockResolvedValueOnce({ count: 1 }) } };
    // @ts-expect-error - partial TransactionClient mock for this test
    await revokeActiveApiKeys(tx, 'org-1');
    expect(tx.apiKey.updateMany).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', revoked: false },
      data: { revoked: true },
    });
  });

  it('createApiKey always writes organizationId', async () => {
    const tx = { apiKey: { create: vi.fn().mockResolvedValueOnce({ id: 'key-1' }) } };
    const key = { raw: 'pk_abc', keyHash: 'hash', keyPrefix: 'pk_abc' };
    // @ts-expect-error - partial TransactionClient mock for this test
    await createApiKey(tx, { organizationId: 'org-1', merchantId: 'merchant-1', key });
    expect(tx.apiKey.create).toHaveBeenCalledWith({
      data: {
        organizationId: 'org-1',
        merchantId: 'merchant-1',
        keyHash: 'hash',
        keyPrefix: 'pk_abc',
      },
    });
  });
});
