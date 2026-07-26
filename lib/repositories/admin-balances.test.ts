import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getLatestBalancesAcrossOrganizations } from './admin-balances';
import { prismaReadonly } from '@/lib/db-readonly';
import { writeAuditLog } from './audit-log';

import type { Organization, AccountBalanceSnapshot } from '@prisma/client';

vi.mock('@/lib/db-readonly', () => ({
  prismaReadonly: {
    organization: { findMany: vi.fn() },
    accountBalanceSnapshot: { findMany: vi.fn() },
  },
}));

vi.mock('./audit-log', () => ({
  writeAuditLog: vi.fn(),
}));

describe('Admin Balances Repository', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('getLatestBalancesAcrossOrganizations', () => {
    it('returns an empty array when no live orgs exist', async () => {
      vi.mocked(prismaReadonly.organization.findMany).mockResolvedValueOnce([]);
      vi.mocked(prismaReadonly.accountBalanceSnapshot.findMany).mockResolvedValueOnce([]);
      
      const rows = await getLatestBalancesAcrossOrganizations('admin_123');
      
      expect(rows).toEqual([]);
      expect(writeAuditLog).toHaveBeenCalledWith({ actorId: 'admin_123', action: 'admin.balances_view' });
    });

    it('returns balances sorted from lowest to highest, pushing nulls to the end', async () => {
      vi.mocked(prismaReadonly.organization.findMany).mockResolvedValueOnce([
        { id: 'org_1', businessName: 'Org 1', lowBalanceThresholdKes: null } as unknown as Organization,
        { id: 'org_2', businessName: 'Org 2', lowBalanceThresholdKes: 5000 } as unknown as Organization,
        { id: 'org_3', businessName: 'Org 3', lowBalanceThresholdKes: 1000 } as unknown as Organization,
      ]);

      vi.mocked(prismaReadonly.accountBalanceSnapshot.findMany).mockResolvedValueOnce([
        { organizationId: 'org_1', workingBalance: 500, createdAt: new Date('2026-07-26T12:00:00Z') } as unknown as AccountBalanceSnapshot,
        { organizationId: 'org_2', workingBalance: 6000, createdAt: new Date('2026-07-26T12:00:00Z') } as unknown as AccountBalanceSnapshot,
      ]);

      const rows = await getLatestBalancesAcrossOrganizations('admin_123');
      
      // Expected order: org 1 (500), org 2 (6000), org 3 (null)
      expect(rows[0].organizationId).toBe('org_1');
      expect(rows[0].workingBalance).toBe(500);
      expect(rows[0].belowThreshold).toBe(true); // 500 < 1000 (default)

      expect(rows[1].organizationId).toBe('org_2');
      expect(rows[1].workingBalance).toBe(6000);
      expect(rows[1].belowThreshold).toBe(false); // 6000 >= 5000 (custom)

      expect(rows[2].organizationId).toBe('org_3');
      expect(rows[2].workingBalance).toBe(null);
      expect(rows[2].belowThreshold).toBe(false);
    });
  });
});
