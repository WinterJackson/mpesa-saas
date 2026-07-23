import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';
import { auth } from '@clerk/nextjs/server';
import { isLiveModeConfigured } from '@/lib/daraja';
import { getOrganizationContext } from '@/lib/repositories/organizations';

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));
vi.mock('@/lib/daraja', () => ({ isLiveModeConfigured: vi.fn() }));
vi.mock('@/lib/repositories/organizations', () => ({ getOrganizationContext: vi.fn() }));

describe('GET /api/merchant/settings/live-readiness', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ userId: null, orgId: null } as never);
    const response = await GET();
    expect(response.status).toBe(401);
  });

  it('returns 404 when the organization cannot be resolved', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ userId: 'user-1', orgId: null } as never);
    vi.mocked(getOrganizationContext).mockResolvedValueOnce(null);
    const response = await GET();
    expect(response.status).toBe(404);
  });

  it('checks live-mode readiness scoped to the resolved organization', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ userId: 'user-1', orgId: 'clerk-org-1' } as never);
    vi.mocked(getOrganizationContext).mockResolvedValueOnce({
      organization: { id: 'org-1' },
      membership: {},
      merchant: null,
    } as never);
    vi.mocked(isLiveModeConfigured).mockResolvedValueOnce(true);

    const response = await GET();
    const data = await response.json();

    expect(getOrganizationContext).toHaveBeenCalledWith('user-1', 'clerk-org-1');
    expect(isLiveModeConfigured).toHaveBeenCalledWith('org-1');
    expect(data.data.liveReady).toBe(true);
  });
});
