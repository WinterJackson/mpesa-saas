import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET } from './route';
import { prisma } from '@/lib/db';
import { querySTKPushStatus } from '@/lib/daraja';
import { finalizeTransactionAsync } from '@/lib/transaction-finalization';

// Mock dependencies
vi.mock('@/lib/db', () => ({
  prisma: {
    transaction: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/lib/daraja', () => ({
  querySTKPushStatus: vi.fn(),
}));

vi.mock('@/lib/transaction-finalization', () => ({
  finalizeTransactionAsync: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Cron Reconcile Transactions', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, CRON_SECRET: 'test-secret' };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns 401 if unauthorized', async () => {
    const request = new Request('http://localhost/api/cron/reconcile-transactions', {
      headers: { authorization: 'Bearer wrong-secret' },
    });

    const response = await GET(request);
    expect(response.status).toBe(401);
  });

  it('heals transaction to completed if ResultCode is 0', async () => {
    const request = new Request('http://localhost/api/cron', {
      headers: { authorization: 'Bearer test-secret' },
    });

    const mockTx = {
      id: 'tx-1',
      checkoutRequestId: 'ws_123',
      createdAt: new Date(Date.now() - 5 * 60 * 1000), // 5 mins old
      merchant: { environment: 'sandbox' },
    };

    vi.mocked(prisma.transaction.findMany).mockResolvedValueOnce([mockTx] as never);
    vi.mocked(querySTKPushStatus).mockResolvedValueOnce({
      ResultCode: '0',
      ResultDesc: 'The service request is processed successfully.',
    } as never);
    vi.mocked(prisma.transaction.update).mockResolvedValueOnce({ ...mockTx, status: 'completed' } as never);

    const response = await GET(request);
    const data = await response.json();

    expect(data.successCount).toBe(1);
    expect(prisma.transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'completed', resultCode: 0 }),
      })
    );
    expect(finalizeTransactionAsync).toHaveBeenCalled();
  });

  it('leaves transaction pending if < 30mins old and non-zero ResultCode', async () => {
    const request = new Request('http://localhost/api/cron', {
      headers: { authorization: 'Bearer test-secret' },
    });

    const mockTx = {
      id: 'tx-1',
      checkoutRequestId: 'ws_123',
      createdAt: new Date(Date.now() - 10 * 60 * 1000), // 10 mins old
      merchant: { environment: 'sandbox' },
    };

    vi.mocked(prisma.transaction.findMany).mockResolvedValueOnce([mockTx] as never);
    vi.mocked(querySTKPushStatus).mockResolvedValueOnce({
      ResultCode: '1032',
      ResultDesc: 'Request cancelled by user',
    } as never);

    const response = await GET(request);
    const data = await response.json();

    expect(data.failCount).toBe(0);
    expect(data.successCount).toBe(0);
    expect(prisma.transaction.update).not.toHaveBeenCalled();
    expect(finalizeTransactionAsync).not.toHaveBeenCalled();
  });

  it('marks transaction as expired if >= 30mins old and non-zero ResultCode', async () => {
    const request = new Request('http://localhost/api/cron', {
      headers: { authorization: 'Bearer test-secret' },
    });

    const mockTx = {
      id: 'tx-1',
      checkoutRequestId: 'ws_123',
      createdAt: new Date(Date.now() - 35 * 60 * 1000), // 35 mins old
      merchant: { environment: 'sandbox' },
    };

    vi.mocked(prisma.transaction.findMany).mockResolvedValueOnce([mockTx] as never);
    vi.mocked(querySTKPushStatus).mockResolvedValueOnce({
      ResultCode: '1032',
      ResultDesc: 'Request cancelled by user',
    } as never);

    const response = await GET(request);
    const data = await response.json();

    expect(data.failCount).toBe(1);
    expect(prisma.transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'expired', resultCode: 1032 }),
      })
    );
    // Expired transactions should NOT trigger webhooks
    expect(finalizeTransactionAsync).not.toHaveBeenCalled();
  });
});
