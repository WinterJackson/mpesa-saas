import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST, GET } from './route';
import { auth } from '@clerk/nextjs/server';
import { getOrganizationContext } from '@/lib/repositories/organizations';
import { createPaymentLink, listPaymentLinks } from '@/lib/repositories/payment-links';
import { requireRole } from '@/lib/rbac';

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));
vi.mock('@/lib/repositories/organizations', () => ({ getOrganizationContext: vi.fn() }));
vi.mock('@/lib/repositories/payment-links', () => ({
  createPaymentLink: vi.fn(),
  listPaymentLinks: vi.fn(),
}));
vi.mock('@/lib/repositories/audit-log', () => ({ writeAuditLog: vi.fn() }));
vi.mock('@/lib/rbac', () => ({ requireRole: vi.fn() }));

function makeRequest(body?: unknown) {
  return new Request('http://localhost/api/merchant/payment-links', {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('POST /api/merchant/payment-links', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getOrganizationContext).mockResolvedValue({
      organization: { id: 'org-1' },
      membership: { role: 'owner' },
      merchant: { id: 'm-1', environment: 'sandbox' },
    } as never);
    vi.mocked(requireRole).mockResolvedValue({ allowed: true, membership: { role: 'owner' } as never });
    vi.mocked(createPaymentLink).mockResolvedValue({ id: 'pl-1', slug: 'abc' } as never);
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ userId: null, orgId: null } as never);
    const response = await POST(makeRequest({ title: 'x', amount: 100 }));
    expect(response.status).toBe(401);
  });

  it('returns 403 for a finance (read-only) member', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ userId: 'u-1', orgId: null } as never);
    vi.mocked(requireRole).mockResolvedValueOnce({ allowed: false, error: 'nope', status: 403 });
    const response = await POST(makeRequest({ title: 'x', amount: 100 }));
    expect(response.status).toBe(403);
    expect(createPaymentLink).not.toHaveBeenCalled();
  });

  it('rejects a missing title', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ userId: 'u-1', orgId: null } as never);
    const response = await POST(makeRequest({ amount: 100 }));
    expect(response.status).toBe(400);
    expect(createPaymentLink).not.toHaveBeenCalled();
  });

  it('rejects a fixed link with no/invalid amount', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ userId: 'u-1', orgId: null } as never);
    const response = await POST(makeRequest({ title: 'Shirt', amountType: 'fixed' }));
    expect(response.status).toBe(400);
    expect(createPaymentLink).not.toHaveBeenCalled();
  });

  it('creates a fixed-amount link and inherits the merchant environment', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ userId: 'u-1', orgId: null } as never);
    const response = await POST(makeRequest({ title: 'Shirt', amountType: 'fixed', amount: 2500 }));
    expect(response.status).toBe(201);
    expect(createPaymentLink).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-1', merchantId: 'm-1', amount: 2500, environment: 'sandbox' })
    );
  });

  it('creates a customer_set link without requiring an amount', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ userId: 'u-1', orgId: null } as never);
    const response = await POST(makeRequest({ title: 'Donation', amountType: 'customer_set' }));
    expect(response.status).toBe(201);
    expect(createPaymentLink).toHaveBeenCalledWith(expect.objectContaining({ amountType: 'customer_set' }));
  });

  it('rejects an expiry date in the past', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ userId: 'u-1', orgId: null } as never);
    const response = await POST(
      makeRequest({ title: 'Shirt', amount: 100, expiresAt: '2000-01-01T00:00:00.000Z' })
    );
    expect(response.status).toBe(400);
    expect(createPaymentLink).not.toHaveBeenCalled();
  });
});

describe('GET /api/merchant/payment-links', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getOrganizationContext).mockResolvedValue({
      organization: { id: 'org-1' },
      membership: { role: 'finance' },
      merchant: { id: 'm-1', environment: 'sandbox' },
    } as never);
    vi.mocked(listPaymentLinks).mockResolvedValue([] as never);
  });

  it('lists links scoped to the org (readable by any member incl. finance)', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ userId: 'u-1', orgId: null } as never);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(listPaymentLinks).toHaveBeenCalledWith('org-1');
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ userId: null, orgId: null } as never);
    const response = await GET();
    expect(response.status).toBe(401);
  });
});
