import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requireAdmin } from './admin-auth';
import { findAdminUserByClerkId } from '@/lib/repositories/admin';

vi.mock('@/lib/repositories/admin', () => ({
  findAdminUserByClerkId: vi.fn(),
}));

describe('requireAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('denies with 403 when the Clerk user has no AdminUser row', async () => {
    vi.mocked(findAdminUserByClerkId).mockResolvedValueOnce(null);
    const result = await requireAdmin('user-1');
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.status).toBe(403);
  });

  it('denies a support admin from a superadmin-only action', async () => {
    vi.mocked(findAdminUserByClerkId).mockResolvedValueOnce({
      id: 'admin-1', clerkUserId: 'user-1', role: 'support', createdAt: new Date(),
    });
    const result = await requireAdmin('user-1', ['superadmin']);
    expect(result.allowed).toBe(false);
  });

  it('allows a superadmin for a superadmin-only action', async () => {
    vi.mocked(findAdminUserByClerkId).mockResolvedValueOnce({
      id: 'admin-1', clerkUserId: 'user-1', role: 'superadmin', createdAt: new Date(),
    });
    const result = await requireAdmin('user-1', ['superadmin']);
    expect(result.allowed).toBe(true);
  });

  it('defaults to allowing both support and superadmin', async () => {
    vi.mocked(findAdminUserByClerkId).mockResolvedValueOnce({
      id: 'admin-1', clerkUserId: 'user-1', role: 'support', createdAt: new Date(),
    });
    const result = await requireAdmin('user-1');
    expect(result.allowed).toBe(true);
  });
});
