import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { auth } from '@clerk/nextjs/server';
import { getOrganizationContext } from '@/lib/repositories/organizations';
import { findDelivery, recordDelivery } from '@/lib/repositories/webhook-deliveries';
import { requireRole } from '@/lib/rbac';
import { deliverWebhook } from '@/lib/webhook';

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));
vi.mock('@/lib/repositories/organizations', () => ({ getOrganizationContext: vi.fn() }));
vi.mock('@/lib/repositories/webhook-deliveries', () => ({ findDelivery: vi.fn(), recordDelivery: vi.fn() }));
vi.mock('@/lib/rbac', () => ({ requireRole: vi.fn() }));
vi.mock('@/lib/webhook', () => ({ deliverWebhook: vi.fn() }));
vi.mock('@/lib/crypto', () => ({ decryptSecret: (v: string) => `dec(${v})` }));

const ctx = { params: Promise.resolve({ id: 'wd-1' }) };

describe('POST webhook-deliveries/[id]/redeliver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ userId: 'u-1', orgId: null } as never);
    vi.mocked(getOrganizationContext).mockResolvedValue({
      organization: { id: 'org-1' },
      membership: { role: 'owner' },
      merchant: { webhookUrl: 'https://hook', webhookSecret: 'enc' },
    } as never);
    vi.mocked(requireRole).mockResolvedValue({ allowed: true, membership: { role: 'owner' } as never });
    vi.mocked(findDelivery).mockResolvedValue({
      id: 'wd-1', event: 'payment.completed', url: 'https://old', statusCode: 500, success: false,
      status: 'failed', attempt: 3, createdAt: new Date(), resourceType: 'transaction', resourceId: 'tx-1',
      payload: { event: 'payment.completed' }, organizationId: 'org-1',
    } as never);
    vi.mocked(deliverWebhook).mockResolvedValue({ delivered: true, statusCode: 200, attempts: 1 });
  });

  it('403s a non-owner/admin (developer)', async () => {
    vi.mocked(requireRole).mockResolvedValueOnce({ allowed: false, error: 'no', status: 403 });
    const res = await POST(new Request('http://localhost'), ctx);
    expect(res.status).toBe(403);
    expect(deliverWebhook).not.toHaveBeenCalled();
  });

  it('404s an unknown delivery for this org', async () => {
    vi.mocked(findDelivery).mockResolvedValueOnce(null);
    const res = await POST(new Request('http://localhost'), ctx);
    expect(res.status).toBe(404);
  });

  it('re-delivers to the current webhook URL and records a fresh attempt', async () => {
    const res = await POST(new Request('http://localhost'), ctx);
    expect(res.status).toBe(200);
    expect(deliverWebhook).toHaveBeenCalledWith(
      'https://hook',
      expect.objectContaining({ event: 'payment.completed' }),
      'dec(enc)',
      expect.objectContaining({ 'x-payswift-redelivery': 'true' })
    );
    expect(recordDelivery).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-1', event: 'payment.completed', transactionId: 'tx-1', success: true })
    );
  });
});
