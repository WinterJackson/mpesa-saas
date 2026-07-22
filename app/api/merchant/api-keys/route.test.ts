import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { getOrganizationContext } from '@/lib/repositories/organizations';
import { revokeActiveApiKeys, createApiKey } from '@/lib/repositories/api-keys';
import { requireRole } from '@/lib/rbac';

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    $transaction: vi.fn((cb: (tx: unknown) => unknown) => cb({})),
  },
  TransactionClient: {},
}));

vi.mock('@/lib/repositories/organizations', () => ({
  getOrganizationContext: vi.fn(),
}));

vi.mock('@/lib/repositories/api-keys', () => ({
  revokeActiveApiKeys: vi.fn(),
  createApiKey: vi.fn(),
}));

vi.mock('@/lib/repositories/audit-log', () => ({
  writeAuditLog: vi.fn(),
}));

vi.mock('@/lib/rbac', () => ({
  requireRole: vi.fn(),
}));

function makeRequest(body?: unknown) {
  return new Request('http://localhost/api/merchant/api-keys', {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('POST /api/merchant/api-keys', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getOrganizationContext).mockResolvedValue({
      organization: { id: 'org-1' },
      membership: { role: 'owner' },
      merchant: { id: 'merchant-1' },
    } as never);
    vi.mocked(createApiKey).mockResolvedValue({ id: 'key-1' } as never);
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ userId: null, orgId: null } as never);
    const response = await POST(makeRequest());
    expect(response.status).toBe(401);
  });

  it('returns 403 when the caller has no membership or an excluded role (finance)', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ userId: 'user-1', orgId: null } as never);
    vi.mocked(requireRole).mockResolvedValueOnce({
      allowed: false,
      error: 'Insufficient permissions for this action',
      status: 403,
    });

    const response = await POST(makeRequest());
    expect(response.status).toBe(403);
    expect(createApiKey).not.toHaveBeenCalled();
  });

  it('rejects a read_write request from a developer-role member', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ userId: 'user-1', orgId: null } as never);
    vi.mocked(requireRole).mockResolvedValueOnce({
      allowed: true,
      membership: { role: 'developer' } as never,
    });

    const response = await POST(makeRequest({ scope: 'read_write' }));
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toMatch(/owners and admins/i);
    expect(createApiKey).not.toHaveBeenCalled();
  });

  it('allows a developer-role member to create a read_only key', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ userId: 'user-1', orgId: null } as never);
    vi.mocked(requireRole).mockResolvedValueOnce({
      allowed: true,
      membership: { role: 'developer' } as never,
    });

    const response = await POST(makeRequest({ scope: 'read_only' }));
    expect(response.status).toBe(200);
    expect(createApiKey).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ organizationId: 'org-1', scope: 'read_only' })
    );
  });

  it('allows an owner to create a read_write key and revokes prior active keys first', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ userId: 'user-1', orgId: null } as never);
    vi.mocked(requireRole).mockResolvedValueOnce({
      allowed: true,
      membership: { role: 'owner' } as never,
    });

    const response = await POST(makeRequest({ scope: 'read_write' }));
    expect(response.status).toBe(200);
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(revokeActiveApiKeys).toHaveBeenCalledWith(expect.anything(), 'org-1');
    expect(createApiKey).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ scope: 'read_write' })
    );
  });

  it('defaults to read_write scope when no body is sent', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ userId: 'user-1', orgId: null } as never);
    vi.mocked(requireRole).mockResolvedValueOnce({
      allowed: true,
      membership: { role: 'owner' } as never,
    });

    const response = await POST(makeRequest());
    expect(response.status).toBe(200);
    expect(createApiKey).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ scope: 'read_write' })
    );
  });
});
