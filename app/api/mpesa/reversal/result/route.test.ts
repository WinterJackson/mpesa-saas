import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { findDarajaCommandByOriginatorId } from '@/lib/repositories/daraja-commands';
import { applyPayoutResult } from '@/lib/repositories/payouts';

vi.mock('@/lib/repositories/daraja-commands', () => ({
  findDarajaCommandByOriginatorId: vi.fn(),
  applyDarajaCommandResult: vi.fn(), // used by the route under test
}));
vi.mock('@/lib/repositories/payouts', () => ({ applyPayoutResult: vi.fn() }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

function req(originator: string, resultCode: number) {
  return new Request('http://localhost/api/mpesa/reversal/result', {
    method: 'POST',
    body: JSON.stringify({ Result: { ResultCode: resultCode, ResultDesc: 'x', OriginatorConversationID: originator } }),
  });
}

describe('POST /api/mpesa/reversal/result', () => {
  beforeEach(() => vi.clearAllMocks());

  it('flips the target payout to reversed on success', async () => {
    vi.mocked(findDarajaCommandByOriginatorId).mockResolvedValueOnce({ id: 'c-1', organizationId: 'org-1', environment: 'live', type: 'reversal', status: 'pending', targetPayoutId: 'p-1' } as never);
    const res = await POST(req('OC', 0));
    expect(res.status).toBe(200);
    expect(applyPayoutResult).toHaveBeenCalledWith('p-1', expect.objectContaining({ status: 'reversed' }));
  });

  it('does not reverse the payout on a failed reversal', async () => {
    vi.mocked(findDarajaCommandByOriginatorId).mockResolvedValueOnce({ id: 'c-1', organizationId: 'org-1', environment: 'live', type: 'reversal', status: 'pending', targetPayoutId: 'p-1' } as never);
    await POST(req('OC', 21));
    expect(applyPayoutResult).not.toHaveBeenCalled();
  });
});
