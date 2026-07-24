import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';
import { auth } from '@clerk/nextjs/server';
import { getOrganizationContext } from '@/lib/repositories/organizations';
import { getInvoiceForOrg } from '@/lib/repositories/billing';
import { buildInvoicePdf } from '@/lib/billing/invoice-pdf';

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));
vi.mock('@/lib/repositories/organizations', () => ({ getOrganizationContext: vi.fn() }));
vi.mock('@/lib/repositories/billing', () => ({ getInvoiceForOrg: vi.fn() }));
vi.mock('@/lib/billing/invoice-pdf', () => ({ buildInvoicePdf: vi.fn() }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const params = Promise.resolve({ id: 'inv-1' });
const req = new Request('http://localhost/api/merchant/billing/invoices/inv-1/pdf');

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue({ userId: 'user-1', orgId: 'org-1' } as never);
  vi.mocked(getOrganizationContext).mockResolvedValue({ organization: { id: 'org-1' } } as never);
});

describe('GET invoice PDF', () => {
  it('401 when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ userId: null, orgId: null } as never);
    const res = await GET(req, { params });
    expect(res.status).toBe(401);
  });

  it('404 when the invoice does not belong to the caller org (ownership scoping)', async () => {
    vi.mocked(getInvoiceForOrg).mockResolvedValueOnce(null as never);
    const res = await GET(req, { params });
    expect(res.status).toBe(404);
    // The lookup must be scoped by organizationId, not just the invoice id.
    expect(getInvoiceForOrg).toHaveBeenCalledWith('inv-1', 'org-1');
    expect(buildInvoicePdf).not.toHaveBeenCalled();
  });

  it('streams a PDF with attachment headers on success', async () => {
    vi.mocked(getInvoiceForOrg).mockResolvedValueOnce({
      id: 'inv-1',
      issuedAt: new Date('2026-07-24'),
      status: 'paid',
      paidAt: new Date('2026-07-24'),
      mpesaReceipt: 'QHJ7',
      amount: 2900,
      subscription: { plan: { name: 'Growth' }, organization: { businessName: 'Acme', kraPin: null } },
    } as never);
    vi.mocked(buildInvoicePdf).mockResolvedValueOnce(new Uint8Array([0x25, 0x50, 0x44, 0x46]));

    const res = await GET(req, { params });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
    expect(res.headers.get('Content-Disposition')).toContain('.pdf');
  });
});
