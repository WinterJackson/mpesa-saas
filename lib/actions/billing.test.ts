import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/repositories/organizations', () => ({ getOrganizationContext: vi.fn() }));
vi.mock('@/lib/repositories/billing', () => ({
  updateBillingDetails: vi.fn(),
  getLatestUnpaidInvoiceForOrg: vi.fn(),
  getSubscriptionForOrganization: vi.fn(),
  getPlanByName: vi.fn(),
  createInvoice: vi.fn(),
  updateSubscriptionPlan: vi.fn(),
  isSelfServePlanName: (name: string) => ['Starter', 'Growth', 'Scale'].includes(name),
}));
vi.mock('@/lib/billing/subscription-billing', () => ({ chargeInvoice: vi.fn() }));
vi.mock('@/lib/rbac', () => ({ requireRole: vi.fn() }));
vi.mock('@/lib/repositories/audit-log', () => ({ writeAuditLog: vi.fn() }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { saveBillingDetailsAction, payNowAction, changePlanAction } from './billing';
import { auth } from '@clerk/nextjs/server';
import { getOrganizationContext } from '@/lib/repositories/organizations';
import {
  updateBillingDetails,
  getLatestUnpaidInvoiceForOrg,
  getSubscriptionForOrganization,
  getPlanByName,
  createInvoice,
  updateSubscriptionPlan,
} from '@/lib/repositories/billing';
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

describe('changePlanAction', () => {
  it('rejects a member without a billing role', async () => {
    vi.mocked(requireRole).mockResolvedValueOnce({ allowed: false, error: 'Insufficient permissions', status: 403 } as never);
    const res = await changePlanAction('Growth');
    expect(res.success).toBe(false);
    expect(updateSubscriptionPlan).not.toHaveBeenCalled();
  });

  it('rejects an unknown / non-self-serve plan (e.g. Enterprise)', async () => {
    const res = await changePlanAction('Enterprise');
    expect(res.success).toBe(false);
    expect(getSubscriptionForOrganization).not.toHaveBeenCalled();
  });

  it('is a no-op when already on the requested plan', async () => {
    vi.mocked(getSubscriptionForOrganization).mockResolvedValueOnce({ id: 'sub-1', status: 'active', plan: { name: 'Growth', monthlyFee: 2900 } } as never);
    const res = await changePlanAction('Growth');
    expect(res.success).toBe(false);
    expect(updateSubscriptionPlan).not.toHaveBeenCalled();
  });

  it('downgrades to the free Starter tier immediately with no charge', async () => {
    vi.mocked(getSubscriptionForOrganization).mockResolvedValueOnce({ id: 'sub-1', status: 'active', plan: { name: 'Growth', monthlyFee: 2900 } } as never);
    vi.mocked(getPlanByName).mockResolvedValueOnce({ id: 'plan-starter', name: 'Starter', monthlyFee: 0 } as never);

    const res = await changePlanAction('Starter');
    expect(res.success).toBe(true);
    expect(updateSubscriptionPlan).toHaveBeenCalledWith('sub-1', 'plan-starter', 'active', null);
    expect(createInvoice).not.toHaveBeenCalled();
    expect(chargeInvoice).not.toHaveBeenCalled();
  });

  it('upgrading a free org to a paid plan issues an invoice and requires payment (incomplete)', async () => {
    vi.mocked(getSubscriptionForOrganization).mockResolvedValueOnce({ id: 'sub-1', status: 'active', plan: { name: 'Starter', monthlyFee: 0 } } as never);
    vi.mocked(getPlanByName).mockResolvedValueOnce({ id: 'plan-growth', name: 'Growth', monthlyFee: 2900 } as never);
    vi.mocked(getLatestUnpaidInvoiceForOrg).mockResolvedValueOnce({ id: 'inv-1', amount: 2900, subscription: { organization: { billingMpesaPhone: '254712345678' } } } as never);
    vi.mocked(chargeInvoice).mockResolvedValueOnce({ charged: true, checkoutRequestId: 'ws_CO_1' });

    const res = await changePlanAction('Growth');
    expect(res.success).toBe(true);
    // Free → paid must be pay-first: status incomplete, fresh invoice, STK fired.
    expect(updateSubscriptionPlan).toHaveBeenCalledWith('sub-1', 'plan-growth', 'incomplete', null);
    expect(createInvoice).toHaveBeenCalledWith('sub-1', 2900);
    expect(chargeInvoice).toHaveBeenCalled();
    const audit = vi.mocked(writeAuditLog).mock.calls.at(-1)![0];
    expect(audit.action).toBe('billing.plan_changed');
    expect(audit.metadata).toMatchObject({ from: 'Starter', to: 'Growth' });
  });

  it('an active payer switching between paid plans keeps access (active)', async () => {
    vi.mocked(getSubscriptionForOrganization).mockResolvedValueOnce({ id: 'sub-1', status: 'active', plan: { name: 'Growth', monthlyFee: 2900 } } as never);
    vi.mocked(getPlanByName).mockResolvedValueOnce({ id: 'plan-scale', name: 'Scale', monthlyFee: 9900 } as never);
    vi.mocked(getLatestUnpaidInvoiceForOrg).mockResolvedValueOnce({ id: 'inv-2', amount: 9900, subscription: { organization: { billingMpesaPhone: '254712345678' } } } as never);
    vi.mocked(chargeInvoice).mockResolvedValueOnce({ charged: true, checkoutRequestId: 'ws_CO_2' });

    const res = await changePlanAction('Scale');
    expect(res.success).toBe(true);
    expect(updateSubscriptionPlan).toHaveBeenCalledWith('sub-1', 'plan-scale', 'active', null);
    expect(createInvoice).toHaveBeenCalledWith('sub-1', 9900);
  });
});
