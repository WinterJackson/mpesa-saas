import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { auth } from '@clerk/nextjs/server';
import { getOrganizationContext } from '@/lib/repositories/organizations';
import { markNotificationRead, markAllNotificationsRead } from '@/lib/repositories/notifications';

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));
vi.mock('@/lib/repositories/organizations', () => ({ getOrganizationContext: vi.fn() }));
vi.mock('@/lib/repositories/notifications', () => ({ markNotificationRead: vi.fn(), markAllNotificationsRead: vi.fn() }));

function makeRequest(body?: unknown) {
  return new Request('http://localhost/api/merchant/notifications/read', {
    method: 'POST',
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

describe('POST /api/merchant/notifications/read', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ userId: 'user-1', orgId: null } as never);
    vi.mocked(getOrganizationContext).mockResolvedValue({ organization: { id: 'org-1' }, membership: { role: 'developer' }, merchant: {} } as never);
  });

  it('401s when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ userId: null, orgId: null } as never);
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(401);
  });

  it('marks a single notification read when an id is given (org-scoped)', async () => {
    const res = await POST(makeRequest({ id: 'n-1' }));
    expect(res.status).toBe(200);
    expect(markNotificationRead).toHaveBeenCalledWith('org-1', 'n-1');
    expect(markAllNotificationsRead).not.toHaveBeenCalled();
  });

  it('marks all read when no id is given', async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(200);
    expect(markAllNotificationsRead).toHaveBeenCalledWith('org-1');
    expect(markNotificationRead).not.toHaveBeenCalled();
  });
});
