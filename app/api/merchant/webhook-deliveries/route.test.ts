import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';
import { auth } from '@clerk/nextjs/server';
import { getOrganizationContext } from '@/lib/repositories/organizations';
import { listDeliveries } from '@/lib/repositories/webhook-deliveries';

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));
vi.mock('@/lib/repositories/organizations', () => ({ getOrganizationContext: vi.fn() }));
vi.mock('@/lib/repositories/webhook-deliveries', () => ({ listDeliveries: vi.fn() }));

function req(qs = '') {
  return new Request(`http://localhost/api/merchant/webhook-deliveries${qs}`);
}

describe('GET /api/merchant/webhook-deliveries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ userId: 'u-1', orgId: null } as never);
    vi.mocked(getOrganizationContext).mockResolvedValue({ organization: { id: 'org-1' }, membership: {}, merchant: {} } as never);
    vi.mocked(listDeliveries).mockResolvedValue({ data: [], nextCursor: null });
  });

  it('401s when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ userId: null, orgId: null } as never);
    expect((await GET(req())).status).toBe(401);
  });

  it('lists org-scoped deliveries with the cursor passed through', async () => {
    const res = await GET(req('?cursor=abc&limit=10'));
    expect(res.status).toBe(200);
    expect(listDeliveries).toHaveBeenCalledWith('org-1', { cursor: 'abc', limit: 10 });
    const json = await res.json();
    expect(json.data).toHaveProperty('deliveries');
    expect(json.data).toHaveProperty('nextCursor');
  });
});
