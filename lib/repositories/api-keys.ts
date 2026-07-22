import { prisma, type TransactionClient } from '@/lib/db';
import type { GeneratedApiKey } from '@/lib/api-keys';

export interface ActiveApiKeySummary {
  keyPrefix: string;
  scope: string;
}

export async function findActiveApiKey(organizationId: string): Promise<ActiveApiKeySummary | null> {
  return prisma.apiKey.findFirst({
    where: { organizationId, revoked: false },
    orderBy: { createdAt: 'desc' },
    select: { keyPrefix: true, scope: true },
  });
}

export async function revokeActiveApiKeys(
  tx: TransactionClient,
  organizationId: string
): Promise<{ count: number }> {
  return tx.apiKey.updateMany({
    where: { organizationId, revoked: false },
    data: { revoked: true },
  });
}

export async function createApiKey(
  tx: TransactionClient,
  params: { organizationId: string; merchantId: string; key: GeneratedApiKey; scope?: 'read_only' | 'read_write' }
) {
  const { organizationId, merchantId, key, scope } = params;
  return tx.apiKey.create({
    data: {
      organizationId,
      merchantId,
      keyHash: key.keyHash,
      keyPrefix: key.keyPrefix,
      ...(scope ? { scope } : {}),
    },
  });
}
