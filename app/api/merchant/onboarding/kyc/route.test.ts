import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST, GET } from './route';
import { auth } from '@clerk/nextjs/server';
import { getOrganizationContext } from '@/lib/repositories/organizations';
import { createKycDocument, listKycDocuments } from '@/lib/repositories/kyc-documents';
import { uploadKycDocument } from '@/lib/storage';
import { writeAuditLog } from '@/lib/repositories/audit-log';

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/repositories/organizations', () => ({
  getOrganizationContext: vi.fn(),
}));

vi.mock('@/lib/repositories/kyc-documents', () => ({
  createKycDocument: vi.fn(),
  listKycDocuments: vi.fn(),
}));

vi.mock('@/lib/storage', () => ({
  uploadKycDocument: vi.fn(),
}));

vi.mock('@/lib/repositories/audit-log', () => ({
  writeAuditLog: vi.fn(),
}));

describe('KYC document routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ userId: 'user-1', orgId: null } as never);
    vi.mocked(getOrganizationContext).mockResolvedValue({
      organization: { id: 'org-1' },
      membership: {},
      merchant: null,
    } as never);
  });

  describe('POST', () => {
    it('returns 401 when unauthenticated', async () => {
      vi.mocked(auth).mockResolvedValueOnce({ userId: null, orgId: null } as never);
      const response = await POST(new Request('http://localhost', { method: 'POST' }));
      expect(response.status).toBe(401);
    });

    it('returns 400 for an unsupported document type', async () => {
      const formData = new FormData();
      formData.set('type', 'passport');
      formData.set('file', new File(['data'], 'id.png', { type: 'image/png' }));

      const response = await POST(new Request('http://localhost', { method: 'POST', body: formData }));
      expect(response.status).toBe(400);
      expect(uploadKycDocument).not.toHaveBeenCalled();
    });

    it('returns 400 when no file is attached', async () => {
      const formData = new FormData();
      formData.set('type', 'id');

      const response = await POST(new Request('http://localhost', { method: 'POST', body: formData }));
      expect(response.status).toBe(400);
    });

    it('uploads to storage and creates a KycDocument row scoped to the organization', async () => {
      vi.mocked(uploadKycDocument).mockResolvedValueOnce({ storageKey: 'kyc/org-1/id/uuid' });
      vi.mocked(createKycDocument).mockResolvedValueOnce({
        id: 'doc-1',
        organizationId: 'org-1',
        type: 'id',
        storageKey: 'kyc/org-1/id/uuid',
        reviewStatus: 'pending',
        createdAt: new Date(),
      });

      const formData = new FormData();
      formData.set('type', 'id');
      formData.set('file', new File(['data'], 'id.png', { type: 'image/png' }));

      const response = await POST(new Request('http://localhost', { method: 'POST', body: formData }));
      const data = await response.json();

      expect(uploadKycDocument).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: 'org-1', documentType: 'id' })
      );
      expect(createKycDocument).toHaveBeenCalledWith('org-1', { type: 'id', storageKey: 'kyc/org-1/id/uuid' });
      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
        organizationId: 'org-1',
        actorId: 'user-1',
        action: 'kyc_document.submitted',
        metadata: { documentType: 'id', documentId: 'doc-1' },
      }));
    });

    it('returns 503 with a clear message when R2 is not configured', async () => {
      vi.mocked(uploadKycDocument).mockRejectedValueOnce(new Error('R2 storage is not configured (R2_ACCOUNT_ID missing).'));

      const formData = new FormData();
      formData.set('type', 'id');
      formData.set('file', new File(['data'], 'id.png', { type: 'image/png' }));

      const response = await POST(new Request('http://localhost', { method: 'POST', body: formData }));
      expect(response.status).toBe(503);
    });
  });

  describe('GET', () => {
    it('lists documents scoped to the organization', async () => {
      vi.mocked(listKycDocuments).mockResolvedValueOnce([]);
      const response = await GET();
      expect(listKycDocuments).toHaveBeenCalledWith('org-1');
      expect(response.status).toBe(200);
    });
  });
});
