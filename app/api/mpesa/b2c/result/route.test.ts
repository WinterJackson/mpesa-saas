import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { findPayoutByOriginatorId, applyPayoutResult } from '@/lib/repositories/payouts';
import { findRefundByOriginatorId, applyRefundResult } from '@/lib/repositories/refunds';
import { finalizePayoutAsync, finalizeRefundAsync } from '@/lib/payout-finalization';

vi.mock('@/lib/repositories/payouts', () => ({ findPayoutByOriginatorId: vi.fn(), applyPayoutResult: vi.fn() }));
vi.mock('@/lib/repositories/refunds', () => ({ findRefundByOriginatorId: vi.fn(), applyRefundResult: vi.fn() }));
vi.mock('@/lib/payout-finalization', () => ({ finalizePayoutAsync: vi.fn(), finalizeRefundAsync: vi.fn() }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

function resultPayload(originator: string, resultCode: number, receipt?: string) {
  return new Request('http://localhost/api/mpesa/b2c/result', {
    method: 'POST',
    body: JSON.stringify({
      Result: {
        ResultType: 0,
        ResultCode: resultCode,
        ResultDesc: resultCode === 0 ? 'The service request is processed successfully.' : 'Failed',
        OriginatorConversationID: originator,
        ConversationID: 'AG_1',
        ...(receipt ? { TransactionID: receipt } : {}),
      },
    }),
  });
}

describe('POST /api/mpesa/b2c/result', () => {
  beforeEach(() => vi.clearAllMocks());

  it('always returns 200 even for an unparseable body', async () => {
    const res = await POST(new Request('http://localhost/api/mpesa/b2c/result', { method: 'POST', body: 'not json' }));
    expect(res.status).toBe(200);
  });

  it('marks a payout completed and fires finalization on ResultCode 0', async () => {
    vi.mocked(findPayoutByOriginatorId).mockResolvedValueOnce({ id: 'p-1', status: 'pending', merchant: { id: 'm-1' } } as never);
    vi.mocked(applyPayoutResult).mockResolvedValueOnce({ id: 'p-1', status: 'completed' } as never);

    const res = await POST(resultPayload('OC_1', 0, 'LGR7Y5'));
    expect(res.status).toBe(200);
    expect(applyPayoutResult).toHaveBeenCalledWith('p-1', expect.objectContaining({ status: 'completed', mpesaReceipt: 'LGR7Y5' }));
    expect(finalizePayoutAsync).toHaveBeenCalled();
  });

  it('marks a payout failed on a non-zero ResultCode (authoritative async result)', async () => {
    vi.mocked(findPayoutByOriginatorId).mockResolvedValueOnce({ id: 'p-1', status: 'pending', merchant: { id: 'm-1' } } as never);
    vi.mocked(applyPayoutResult).mockResolvedValueOnce({ id: 'p-1', status: 'failed' } as never);

    await POST(resultPayload('OC_1', 2001));
    expect(applyPayoutResult).toHaveBeenCalledWith('p-1', expect.objectContaining({ status: 'failed', mpesaReceipt: null }));
  });

  it('is idempotent — skips a payout already in a terminal state', async () => {
    vi.mocked(findPayoutByOriginatorId).mockResolvedValueOnce({ id: 'p-1', status: 'completed', merchant: {} } as never);
    await POST(resultPayload('OC_1', 0));
    expect(applyPayoutResult).not.toHaveBeenCalled();
  });

  it('falls through to refunds when no payout matches', async () => {
    vi.mocked(findPayoutByOriginatorId).mockResolvedValueOnce(null);
    vi.mocked(findRefundByOriginatorId).mockResolvedValueOnce({ id: 'r-1', status: 'pending', merchant: { id: 'm-1' } } as never);
    vi.mocked(applyRefundResult).mockResolvedValueOnce({ id: 'r-1', status: 'completed' } as never);

    await POST(resultPayload('OC_2', 0, 'LGR9Z'));
    expect(applyRefundResult).toHaveBeenCalledWith('r-1', expect.objectContaining({ status: 'completed' }));
    expect(finalizeRefundAsync).toHaveBeenCalled();
  });

  it('returns 200 when no payout/refund matches the originator id', async () => {
    vi.mocked(findPayoutByOriginatorId).mockResolvedValueOnce(null);
    vi.mocked(findRefundByOriginatorId).mockResolvedValueOnce(null);
    const res = await POST(resultPayload('OC_unknown', 0));
    expect(res.status).toBe(200);
  });
});
