import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findDarajaCommandByOriginatorId, applyDarajaCommandResult } from '@/lib/repositories/daraja-commands';
import { processCommandResult } from './daraja-command-result';
import type { DarajaResultPayload } from '@/lib/types';

vi.mock('@/lib/repositories/daraja-commands', () => ({
  findDarajaCommandByOriginatorId: vi.fn(),
  applyDarajaCommandResult: vi.fn(),
}));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

function payload(originator: string, resultCode: number): DarajaResultPayload {
  return { Result: { ResultCode: resultCode, ResultDesc: 'x', OriginatorConversationID: originator } };
}

describe('processCommandResult', () => {
  beforeEach(() => vi.clearAllMocks());

  it('records completed + runs the side effect on ResultCode 0', async () => {
    vi.mocked(findDarajaCommandByOriginatorId).mockResolvedValueOnce({ id: 'c-1', organizationId: 'org-1', environment: 'sandbox', type: 'account_balance', status: 'pending', targetPayoutId: null } as never);
    const sideEffect = vi.fn();
    await processCommandResult(payload('OC', 0), 'Account Balance', sideEffect);
    expect(applyDarajaCommandResult).toHaveBeenCalledWith('c-1', expect.objectContaining({ status: 'completed' }));
    expect(sideEffect).toHaveBeenCalledWith(expect.objectContaining({ id: 'c-1' }), expect.anything(), 'completed');
  });

  it('records failed without special-casing (non-zero ResultCode)', async () => {
    vi.mocked(findDarajaCommandByOriginatorId).mockResolvedValueOnce({ id: 'c-1', organizationId: 'org-1', environment: 'sandbox', type: 'reversal', status: 'pending', targetPayoutId: 'p-1' } as never);
    const sideEffect = vi.fn();
    await processCommandResult(payload('OC', 21), 'Reversal', sideEffect);
    expect(applyDarajaCommandResult).toHaveBeenCalledWith('c-1', expect.objectContaining({ status: 'failed' }));
    expect(sideEffect).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'failed');
  });

  it('is idempotent — skips a command already terminal', async () => {
    vi.mocked(findDarajaCommandByOriginatorId).mockResolvedValueOnce({ id: 'c-1', status: 'completed' } as never);
    const sideEffect = vi.fn();
    await processCommandResult(payload('OC', 0), 'Account Balance', sideEffect);
    expect(applyDarajaCommandResult).not.toHaveBeenCalled();
    expect(sideEffect).not.toHaveBeenCalled();
  });

  it('no-ops for an unknown originator id', async () => {
    vi.mocked(findDarajaCommandByOriginatorId).mockResolvedValueOnce(null);
    await processCommandResult(payload('OC', 0), 'Account Balance');
    expect(applyDarajaCommandResult).not.toHaveBeenCalled();
  });

  it('swallows side-effect errors (never throws to the callback)', async () => {
    vi.mocked(findDarajaCommandByOriginatorId).mockResolvedValueOnce({ id: 'c-1', organizationId: 'org-1', environment: 'sandbox', type: 'account_balance', status: 'pending', targetPayoutId: null } as never);
    await expect(processCommandResult(payload('OC', 0), 'Account Balance', async () => { throw new Error('boom'); })).resolves.toBeUndefined();
  });
});
