import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveOrgRecipients, resolveStaffRecipients } from './recipients';
import { clerkClient } from '@clerk/nextjs/server';
import { listMemberships, findOrganizationById } from '@/lib/repositories/organizations';
import { listAdminUsers } from '@/lib/repositories/admin';

vi.mock('@clerk/nextjs/server', () => ({ clerkClient: vi.fn() }));
vi.mock('@/lib/repositories/organizations', () => ({ listMemberships: vi.fn(), findOrganizationById: vi.fn() }));
vi.mock('@/lib/repositories/admin', () => ({ listAdminUsers: vi.fn() }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

function mockClerkUsers(users: { id: string; primaryEmailAddressId: string; emailAddresses: { id: string; emailAddress: string }[] }[]) {
  vi.mocked(clerkClient).mockResolvedValue({
    users: { getUserList: vi.fn().mockResolvedValue({ data: users }) },
  } as never);
}

describe('resolveOrgRecipients', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns business name + owner/admin emails resolved from Clerk', async () => {
    vi.mocked(findOrganizationById).mockResolvedValue({ id: 'org-1', businessName: 'Acme' } as never);
    vi.mocked(listMemberships).mockResolvedValue([
      { clerkUserId: 'u_owner', role: 'owner' },
      { clerkUserId: 'u_admin', role: 'admin' },
      { clerkUserId: 'u_dev', role: 'developer' },
    ] as never);
    mockClerkUsers([
      { id: 'u_owner', primaryEmailAddressId: 'e1', emailAddresses: [{ id: 'e1', emailAddress: 'owner@acme.com' }] },
      { id: 'u_admin', primaryEmailAddressId: 'e2', emailAddresses: [{ id: 'e2', emailAddress: 'admin@acme.com' }] },
    ]);

    const res = await resolveOrgRecipients('org-1');
    expect(res?.businessName).toBe('Acme');
    expect(res?.emails.sort()).toEqual(['admin@acme.com', 'owner@acme.com']);
  });

  it('returns null for an unknown org', async () => {
    vi.mocked(findOrganizationById).mockResolvedValue(null as never);
    expect(await resolveOrgRecipients('nope')).toBeNull();
  });

  it('fails open (no throw) when Clerk lookup throws', async () => {
    vi.mocked(findOrganizationById).mockResolvedValue({ id: 'org-1', businessName: 'Acme' } as never);
    vi.mocked(listMemberships).mockResolvedValue([{ clerkUserId: 'u_owner', role: 'owner' }] as never);
    vi.mocked(clerkClient).mockRejectedValue(new Error('clerk down') as never);
    const res = await resolveOrgRecipients('org-1');
    expect(res).toEqual({ businessName: 'Acme', emails: [] });
  });
});

describe('resolveStaffRecipients', () => {
  beforeEach(() => vi.clearAllMocks());

  it('skips disabled admins and admins without an email', async () => {
    vi.mocked(listAdminUsers).mockResolvedValue([
      { role: 'superadmin', status: 'active', email: 'super@ps.com' },
      { role: 'ops', status: 'disabled', email: 'ops@ps.com' },
      { role: 'support', status: 'active', email: null },
    ] as never);
    expect(await resolveStaffRecipients()).toEqual(['super@ps.com']);
  });

  it('narrows to admins whose role holds the capability', async () => {
    vi.mocked(listAdminUsers).mockResolvedValue([
      { role: 'kyc_reviewer', status: 'active', email: 'kyc@ps.com' },
      { role: 'finance', status: 'active', email: 'fin@ps.com' },
      { role: 'superadmin', status: 'active', email: 'super@ps.com' },
    ] as never);
    // Only kyc_reviewer and superadmin hold kyc:review.
    expect((await resolveStaffRecipients('kyc:review')).sort()).toEqual(['kyc@ps.com', 'super@ps.com']);
  });
});
