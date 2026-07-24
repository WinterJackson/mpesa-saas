import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/repositories/organizations', () => ({ getOrganizationContext: vi.fn() }));
vi.mock('@/lib/repositories/billing', () => ({
  updateBillingDetails: vi.fn(),
  getLatestUnpaidInvoiceForOrg: vi.fn(),
}));
vi.mock('@/lib/billing/subscription-billing', () => ({ chargeInvoice: vi.fn() }));
vi.mock('@/lib/rbac', () => ({ requireRole: vi.fn() }));
vi.mock('@/lib/repositories/audit-log', () => ({ writeAuditLog: vi.fn() }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { saveBillingDetailsAction, payNowAction } from './billing';
import { auth } from '@clerk/nextjs/server';
import { getOrganizationContext } from '@/lib/repositories/organizations';
import { updateBillingDetails, getLatestUnpaidInvoiceForOrg } from '@/lib/repositories/billing';
import { chargeInvoice } from '@/lib/billing/subscription-billing';
import { requireRole } from '@/lib/rbac';
import { writeAuditLog } from '@/lib/repositories/audit-log';

const ctx = { organization: { id: 'org-1' }, membership: { role: 'owner' }, merchant: {} };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue({ userId: 'user-1', orgId: 'org-1' } as never);
  vi.mocked(getOrganizationContext).mockResolvedValue(ctx as never);
  vi.mocked(requireRole).mockResolvedValue({ allowed: true, membership: { role: 'owner' } } as never);
});

describe('saveBillingDetailsAction', () => {
  it('rejects a member without a billing role', async () => {
    vi.mocked(requireRole).mockResolvedValueOnce({ allowed: false, error: 'Insufficient permissions', status: 403 } as never);
    const res = await saveBillingDetailsAction({ billingMpesaPhone: '0712345678', billingContactEmail: '' });
    expect(res.success).toBe(false);
    expect(updateBillingDetails).not.toHaveBeenCalled();
  });

  it('rejects an invalid phone number', async () => {
    const res = await saveBillingDetailsAction({ billingMpesaPhone: '12345', billingContactEmail: '' });
    expect(res.success).toBe(false);
    expect(updateBillingDetails).not.toHaveBeenCalled();
  });

  it('normalizes the phone, saves, and writes an audit row with field names only (no PII)', async () => {
    const res = await saveBillingDetailsAction({ billingMpesaPhone: '0712345678', billingContactEmail: 'f@x.co' });
    expect(res.success).toBe(true);
    expect(updateBillingDetails).toHaveBeenCalledWith('org-1', {
      billingMpesaPhone: '254712345678',
      billingContactEmail: 'f@x.co',
    });
    const audit = vi.mocked(writeAuditLog).mock.calls[0][0];
    expect(audit.action).toBe('billing.details_updated');
    expect(JSON.stringify(audit.metadata)).not.toContain('254712345678');
  });
});

describe('payNowAction', () => {
  it('reports when there is nothing outstanding', async () => {
    vi.mocked(getLatestUnpaidInvoiceForOrg).mockResolvedValueOnce(null as never);
    const res = await payNowAction();
    expect(res.success).toBe(false);
    expect(chargeInvoice).not.toHaveBeenCalled();
  });

  it('charges the outstanding invoice and tells the merchant to check their phone', async () => {
    vi.mocked(getLatestUnpaidInvoiceForOrg).mockResolvedValueOnce({ id: 'inv-1', amount: 2900, subscription: { organization: { billingMpesaPhone: '254712345678' } } } as never);
    vi.mocked(chargeInvoice).mockResolvedValueOnce({ charged: true, checkoutRequestId: 'ws_CO_1' });
    const res = await payNowAction();
    expect(res.success).toBe(true);
    expect(chargeInvoice).toHaveBeenCalled();
  });

  it('surfaces a friendly message when no billing phone is set', async () => {
    vi.mocked(getLatestUnpaidInvoiceForOrg).mockResolvedValueOnce({ id: 'inv-1', amount: 2900, subscription: { organization: { billingMpesaPhone: null } } } as never);
    vi.mocked(chargeInvoice).mockResolvedValueOnce({ charged: false, reason: 'no_billing_phone' });
    const res = await payNowAction();
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/billing M-Pesa number/i);
  });
});
