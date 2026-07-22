import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PATCH } from './route';
import { auth } from '@clerk/nextjs/server';
import { requireAdmin } from '@/lib/admin-auth';
import { updateKycDocumentReviewStatus, allRequiredDocumentsApproved } from '@/lib/repositories/kyc-documents';
import { updateOrganizationKycStatus } from '@/lib/repositories/admin';
import { writeAuditLog } from '@/lib/repositories/audit-log';

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));
vi.mock('@/lib/admin-auth', () => ({ requireAdmin: vi.fn() }));
vi.mock('@/lib/repositories/kyc-documents', () => ({
  updateKycDocumentReviewStatus: vi.fn(),
  allRequiredDocumentsApproved: vi.fn(),
}));
vi.mock('@/lib/repositories/admin', () => ({
  updateOrganizationKycStatus: vi.fn(),
}));
vi.mock('@/lib/repositories/audit-log', () => ({
  writeAuditLog: vi.fn(),
}));

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/admin/kyc/doc-1', { method: 'PATCH', body: JSON.stringify(body) });
}

describe('PATCH /api/admin/kyc/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ userId: 'admin-user-1' } as never);
  });

  it('returns 403 when the caller is not an admin', async () => {
    vi.mocked(requireAdmin).mockResolvedValueOnce({ allowed: false, error: 'Not authorized', status: 403 });
    const response = await PATCH(makeRequest({ organizationId: 'org-1', reviewStatus: 'approved' }), { params: Promise.resolve({ id: 'doc-1' }) });
    expect(response.status).toBe(403);
    expect(updateKycDocumentReviewStatus).not.toHaveBeenCalled();
  });

  it('approves a document, writes an audit log, and does not flip org status if other docs are still pending', async () => {
    vi.mocked(requireAdmin).mockResolvedValueOnce({ allowed: true, admin: { id: 'a1', clerkUserId: 'admin-user-1', role: 'support', createdAt: new Date() } });
    vi.mocked(updateKycDocumentReviewStatus).mockResolvedValueOnce({ id: 'doc-1', organizationId: 'org-1', type: 'id', storageKey: 'k', reviewStatus: 'approved', createdAt: new Date() });
    vi.mocked(allRequiredDocumentsApproved).mockResolvedValueOnce(false);

    const response = await PATCH(makeRequest({ organizationId: 'org-1', reviewStatus: 'approved' }), { params: Promise.resolve({ id: 'doc-1' }) });

    expect(response.status).toBe(200);
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'kyc_document.approved', organizationId: 'org-1' }));
    expect(updateOrganizationKycStatus).not.toHaveBeenCalled();
  });

  it('flips the organization to approved once every required document is approved', async () => {
    vi.mocked(requireAdmin).mockResolvedValueOnce({ allowed: true, admin: { id: 'a1', clerkUserId: 'admin-user-1', role: 'support', createdAt: new Date() } });
    vi.mocked(updateKycDocumentReviewStatus).mockResolvedValueOnce({ id: 'doc-1', organizationId: 'org-1', type: 'kra_pin', storageKey: 'k', reviewStatus: 'approved', createdAt: new Date() });
    vi.mocked(allRequiredDocumentsApproved).mockResolvedValueOnce(true);

    await PATCH(makeRequest({ organizationId: 'org-1', reviewStatus: 'approved' }), { params: Promise.resolve({ id: 'doc-1' }) });

    expect(updateOrganizationKycStatus).toHaveBeenCalledWith('org-1', 'approved');
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'organization.kyc_approved' }));
  });

  it('rejects a document and flips the organization to rejected', async () => {
    vi.mocked(requireAdmin).mockResolvedValueOnce({ allowed: true, admin: { id: 'a1', clerkUserId: 'admin-user-1', role: 'support', createdAt: new Date() } });
    vi.mocked(updateKycDocumentReviewStatus).mockResolvedValueOnce({ id: 'doc-1', organizationId: 'org-1', type: 'id', storageKey: 'k', reviewStatus: 'rejected', createdAt: new Date() });

    await PATCH(makeRequest({ organizationId: 'org-1', reviewStatus: 'rejected' }), { params: Promise.resolve({ id: 'doc-1' }) });

    expect(updateOrganizationKycStatus).toHaveBeenCalledWith('org-1', 'rejected');
    expect(allRequiredDocumentsApproved).not.toHaveBeenCalled();
  });
});
