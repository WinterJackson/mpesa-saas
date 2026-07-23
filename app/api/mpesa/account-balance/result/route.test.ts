import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { findDarajaCommandByOriginatorId } from '@/lib/repositories/daraja-commands';
import { createBalanceSnapshot } from '@/lib/repositories/account-balance';

vi.mock('@/lib/repositories/daraja-commands', () => ({
  findDarajaCommandByOriginatorId: vi.fn(),
  applyDarajaCommandResult: vi.fn(), // used by the route under test
}));
vi.mock('@/lib/repositories/account-balance', async () => {
  const actual = await vi.importActual<typeof import('@/lib/repositories/account-balance')>('@/lib/repositories/account-balance');
  return { ...actual, createBalanceSnapshot: vi.fn() };
});
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

function req(originator: string, resultCode: number, balance?: string) {
  return new Request('http://localhost/api/mpesa/account-balance/result', {
    method: 'POST',
    body: JSON.stringify({
      Result: {
        ResultCode: resultCode,
        ResultDesc: 'x',
        OriginatorConversationID: originator,
        ResultParameters: balance ? { ResultParameter: [{ Key: 'AccountBalance', Value: balance }] } : undefined,
      },
    }),
  });
}

describe('POST /api/mpesa/account-balance/result', () => {
  beforeEach(() => vi.clearAllMocks());

  it('snapshots the parsed working balance on success', async () => {
    vi.mocked(findDarajaCommandByOriginatorId).mockResolvedValueOnce({ id: 'c-1', organizationId: 'org-1', environment: 'live', type: 'account_balance', status: 'pending', targetPayoutId: null } as never);
    const res = await POST(req('OC', 0, 'Working Account|KES|481000.00|481000.00|0.00|0.00'));
    expect(res.status).toBe(200);
    expect(createBalanceSnapshot).toHaveBeenCalledWith('org-1', expect.objectContaining({ workingBalance: 481000, environment: 'live' }));
  });

  it('does not snapshot on a failed balance query', async () => {
    vi.mocked(findDarajaCommandByOriginatorId).mockResolvedValueOnce({ id: 'c-1', organizationId: 'org-1', environment: 'live', type: 'account_balance', status: 'pending', targetPayoutId: null } as never);
    await POST(req('OC', 1));
    expect(createBalanceSnapshot).not.toHaveBeenCalled();
  });
});
