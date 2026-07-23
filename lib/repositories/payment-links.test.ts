import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '@/lib/db';
import {
  createPaymentLink,
  listPaymentLinks,
  findPaymentLinkById,
  deactivatePaymentLink,
  findActiveLinkBySlug,
} from './payment-links';

vi.mock('@/lib/db', () => ({
  prisma: {
    paymentLink: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

describe('payment-links repository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createPaymentLink generates a slug and stores the fixed amount', async () => {
    vi.mocked(prisma.paymentLink.create).mockResolvedValueOnce({ id: 'pl-1' } as never);
    await createPaymentLink({
      organizationId: 'org-1',
      merchantId: 'm-1',
      title: 'Blue Shirt',
      amountType: 'fixed',
      amount: 2500,
      environment: 'sandbox',
    });

    const arg = vi.mocked(prisma.paymentLink.create).mock.calls[0][0] as {
      data: { slug: string; amount: number | null; organizationId: string };
    };
    expect(arg.data.organizationId).toBe('org-1');
    expect(arg.data.amount).toBe(2500);
    expect(typeof arg.data.slug).toBe('string');
    expect(arg.data.slug.length).toBeGreaterThan(8);
  });

  it('createPaymentLink nulls the amount for a customer_set link', async () => {
    vi.mocked(prisma.paymentLink.create).mockResolvedValueOnce({ id: 'pl-2' } as never);
    await createPaymentLink({
      organizationId: 'org-1',
      merchantId: 'm-1',
      title: 'Donation',
      amountType: 'customer_set',
      amount: 999,
      environment: 'sandbox',
    });

    const arg = vi.mocked(prisma.paymentLink.create).mock.calls[0][0] as { data: { amount: number | null } };
    expect(arg.data.amount).toBeNull();
  });

  it('listPaymentLinks always filters by organizationId and maps completed-payment stats', async () => {
    vi.mocked(prisma.paymentLink.findMany).mockResolvedValueOnce([
      { id: 'pl-1', transactions: [{ amount: 100 }, { amount: 250 }] },
    ] as never);

    const result = await listPaymentLinks('org-1');
    expect(prisma.paymentLink.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: 'org-1' } })
    );
    expect(result[0].paymentsCount).toBe(2);
    expect(result[0].paymentsVolume).toBe(350);
  });

  it('findPaymentLinkById always filters by organizationId', async () => {
    vi.mocked(prisma.paymentLink.findFirst).mockResolvedValueOnce(null as never);
    await findPaymentLinkById('org-1', 'pl-1');
    expect(prisma.paymentLink.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'pl-1', organizationId: 'org-1' } })
    );
  });

  it('deactivatePaymentLink returns null when the link is not in the org', async () => {
    vi.mocked(prisma.paymentLink.findFirst).mockResolvedValueOnce(null as never);
    const result = await deactivatePaymentLink('org-1', 'pl-x');
    expect(result).toBeNull();
    expect(prisma.paymentLink.update).not.toHaveBeenCalled();
  });

  it('deactivatePaymentLink sets active:false for an owned link', async () => {
    vi.mocked(prisma.paymentLink.findFirst).mockResolvedValueOnce({ id: 'pl-1' } as never);
    vi.mocked(prisma.paymentLink.update).mockResolvedValueOnce({ id: 'pl-1', active: false } as never);
    await deactivatePaymentLink('org-1', 'pl-1');
    expect(prisma.paymentLink.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'pl-1' }, data: { active: false } })
    );
  });

  it('findActiveLinkBySlug filters on active + non-expired and exposes the org go-live gate', async () => {
    vi.mocked(prisma.paymentLink.findFirst).mockResolvedValueOnce({
      id: 'pl-1',
      slug: 'abc',
      organizationId: 'org-1',
      merchant: { id: 'm-1' },
      organization: { liveApprovedAt: null },
    } as never);

    const result = await findActiveLinkBySlug('abc');
    const whereArg = vi.mocked(prisma.paymentLink.findFirst).mock.calls[0][0] as {
      where: { slug: string; active: boolean; OR: unknown[] };
    };
    expect(whereArg.where.slug).toBe('abc');
    expect(whereArg.where.active).toBe(true);
    expect(Array.isArray(whereArg.where.OR)).toBe(true);
    expect(result?.liveApprovedAt).toBeNull();
    expect(result).not.toHaveProperty('organization');
  });

  it('findActiveLinkBySlug returns null for a missing/expired/inactive link', async () => {
    vi.mocked(prisma.paymentLink.findFirst).mockResolvedValueOnce(null as never);
    expect(await findActiveLinkBySlug('gone')).toBeNull();
  });
});
