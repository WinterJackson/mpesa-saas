import { describe, it, expect, vi, beforeEach } from 'vitest';
import { withTenantContext, withPlatformContext } from '@/lib/db';
import {
  createRefund,
  findRefundById,
  listRefunds,
  setRefundInitiation,
  markRefundFailedOnInitiation,
  findRefundByOriginatorId,
  applyRefundResult,
} from './refunds';

// Refund has Row-Level Security enabled — org-scoped functions route through
// withTenantContext, callback-correlation functions route through
// withPlatformContext (the documented bypass). Both mocked as "run the
// callback against the same fake client", so assertions on the client below
// still see the calls.
vi.mock('@/lib/db', () => {
  const client = {
    refund: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  };
  return {
    prisma: client,
    withTenantContext: vi.fn((_organizationId: string, fn: (tx: typeof client) => unknown) => fn(client)),
    withPlatformContext: vi.fn((fn: (tx: typeof client) => unknown) => fn(client)),
  };
});

describe('refunds repository', () => {
  beforeEach(() => vi.clearAllMocks());

  it('createRefund opens the tenant context for the given organization', async () => {
    await createRefund('org-1', {
      merchantId: 'm-1',
      transactionId: 'tx-1',
      amount: 100,
      phone: '254712345678',
      environment: 'sandbox',
    });
    expect(withTenantContext).toHaveBeenCalledWith('org-1', expect.any(Function));
  });

  it('findRefundById, listRefunds, setRefundInitiation, markRefundFailedOnInitiation are all tenant-scoped', async () => {
    await findRefundById('org-1', 'r-1');
    await listRefunds('org-1');
    await setRefundInitiation('org-1', 'r-1', { conversationId: 'c-1', originatorConversationId: 'o-1' });
    await markRefundFailedOnInitiation('org-1', 'r-1', 'failed');

    expect(withTenantContext).toHaveBeenCalledTimes(4);
    for (const call of vi.mocked(withTenantContext).mock.calls) {
      expect(call[0]).toBe('org-1');
    }
  });

  it('findRefundByOriginatorId and applyRefundResult use the platform bypass, not a tenant context', async () => {
    await findRefundByOriginatorId('originator-1');
    await applyRefundResult('r-1', { status: 'completed', resultCode: 0, resultDesc: 'ok', mpesaReceipt: 'ABC123' });

    expect(withPlatformContext).toHaveBeenCalledTimes(2);
    expect(withTenantContext).not.toHaveBeenCalled();
  });
});
