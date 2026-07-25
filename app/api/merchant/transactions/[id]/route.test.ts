import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));
vi.mock('@/lib/repositories/organizations', () => ({ getOrganizationContext: vi.fn() }));
vi.mock('@/lib/repositories/transactions', () => ({ findTransactionById: vi.fn(), updateTransactionNote: vi.fn() }));
vi.mock('@/lib/rbac', () => ({ requireRole: vi.fn() }));

import { GET, PATCH } from './route';
import { auth } from '@clerk/nextjs/server';
import { getOrganizationContext } from '@/lib/repositories/organizations';
import { findTransactionById, updateTransactionNote } from '@/lib/repositories/transactions';
import { requireRole } from '@/lib/rbac';

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue({ userId: 'user-1', orgId: 'org-1' } as never);
  vi.mocked(getOrganizationContext).mockResolvedValue({ organization: { id: 'org-1' }, membership: { role: 'finance' } } as never);
  vi.mocked(requireRole).mockResolvedValue({ allowed: true, membership: { role: 'finance' } } as never);
});

describe('GET /api/merchant/transactions/[id]', () => {
  it('404s when the transaction is not in the org', async () => {
    vi.mocked(findTransactionById).mockResolvedValueOnce(null);
    const res = await GET(new Request('http://x'), ctx('tx-1'));
    expect(res.status).toBe(404);
  });

  it('attaches a plain-language failure reason for a non-completed payment', async () => {
    vi.mocked(findTransactionById).mockResolvedValueOnce({ id: 'tx-1', status: 'cancelled', resultCode: 1032 } as never);
    const res = await GET(new Request('http://x'), ctx('tx-1'));
    const json = await res.json();
    expect(json.data.failure.reason).toBe('Cancelled by customer');
  });

  it('does not attach a failure block for a completed payment', async () => {
    vi.mocked(findTransactionById).mockResolvedValueOnce({ id: 'tx-1', status: 'completed', resultCode: 0 } as never);
    const res = await GET(new Request('http://x'), ctx('tx-1'));
    const json = await res.json();
    expect(json.data.failure).toBeNull();
  });
});

describe('PATCH /api/merchant/transactions/[id]', () => {
  function req(body: unknown) {
    return new Request('http://x', { method: 'PATCH', body: JSON.stringify(body) });
  }

  it('rejects a role without permission (e.g. developer)', async () => {
    vi.mocked(requireRole).mockResolvedValueOnce({ allowed: false, error: 'Insufficient permissions for this action', status: 403 } as never);
    const res = await PATCH(req({ note: 'x' }), ctx('tx-1'));
    expect(res.status).toBe(403);
    expect(updateTransactionNote).not.toHaveBeenCalled();
  });

  it('saves a trimmed note, org-scoped', async () => {
    vi.mocked(updateTransactionNote).mockResolvedValueOnce(1);
    const res = await PATCH(req({ note: '  paid twice  ' }), ctx('tx-1'));
    expect(res.status).toBe(200);
    expect(updateTransactionNote).toHaveBeenCalledWith('org-1', 'tx-1', 'paid twice');
  });

  it('clears the note to null when empty, and 404s an unknown id', async () => {
    vi.mocked(updateTransactionNote).mockResolvedValueOnce(0);
    const res = await PATCH(req({ note: '   ' }), ctx('missing'));
    expect(updateTransactionNote).toHaveBeenCalledWith('org-1', 'missing', null);
    expect(res.status).toBe(404);
  });
});
