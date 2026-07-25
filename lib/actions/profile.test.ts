import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/repositories/organizations', () => ({
  getOrganizationContext: vi.fn(),
  updateBusinessName: vi.fn(),
}));
vi.mock('@/lib/rbac', () => ({ requireRole: vi.fn() }));
vi.mock('@/lib/repositories/audit-log', () => ({ writeAuditLog: vi.fn() }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { updateBusinessNameAction } from './profile';
import { auth } from '@clerk/nextjs/server';
import { getOrganizationContext, updateBusinessName } from '@/lib/repositories/organizations';
import { requireRole } from '@/lib/rbac';
import { writeAuditLog } from '@/lib/repositories/audit-log';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue({ userId: 'user-1', orgId: 'org-1' } as never);
  vi.mocked(getOrganizationContext).mockResolvedValue({ organization: { id: 'org-1' }, membership: { role: 'owner' } } as never);
  vi.mocked(requireRole).mockResolvedValue({ allowed: true, membership: { role: 'owner' } } as never);
  vi.mocked(updateBusinessName).mockResolvedValue(undefined as never);
});

describe('updateBusinessNameAction', () => {
  it('rejects a role without permission (developer/finance)', async () => {
    vi.mocked(requireRole).mockResolvedValueOnce({ allowed: false, error: 'Insufficient permissions for this action', status: 403 } as never);
    const res = await updateBusinessNameAction({ businessName: 'New Name' });
    expect(res.success).toBe(false);
    expect(updateBusinessName).not.toHaveBeenCalled();
  });

  it('rejects an empty / too-short name', async () => {
    const res = await updateBusinessNameAction({ businessName: ' ' });
    expect(res.success).toBe(false);
    expect(updateBusinessName).not.toHaveBeenCalled();
  });

  it('rejects a name longer than 100 characters', async () => {
    const res = await updateBusinessNameAction({ businessName: 'x'.repeat(101) });
    expect(res.success).toBe(false);
    expect(updateBusinessName).not.toHaveBeenCalled();
  });

  it('trims and persists a valid name, then audits it (field name only)', async () => {
    const res = await updateBusinessNameAction({ businessName: '  Mama Mboga  ' });
    expect(res.success).toBe(true);
    expect(updateBusinessName).toHaveBeenCalledWith('org-1', 'Mama Mboga');
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'organization.business_name_updated', metadata: { field: 'businessName' } })
    );
  });
});
