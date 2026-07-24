import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleWebhookDeliver } from './inngest-functions';
import { deliverWebhook } from '@/lib/webhook';
import { recordDelivery } from '@/lib/repositories/webhook-deliveries';

vi.mock('@/lib/webhook', () => ({ deliverWebhook: vi.fn() }));
vi.mock('@/lib/repositories/webhook-deliveries', () => ({ recordDelivery: vi.fn() }));

describe('handleWebhookDeliver (Inngest function handler)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('delivers the webhook and records the attempt, resourceType-agnostic', async () => {
    vi.mocked(deliverWebhook).mockResolvedValueOnce({ delivered: true, statusCode: 200, attempts: 2 });

    const result = await handleWebhookDeliver({
      event: {
        data: {
          organizationId: 'org-1',
          event: 'payout.completed',
          url: 'https://merchant.example/hook',
          payload: { a: 1 },
          secret: 'shh',
          payoutId: 'payout-1',
        },
      },
    });

    expect(deliverWebhook).toHaveBeenCalledWith(
      'https://merchant.example/hook',
      { a: 1 },
      'shh',
      undefined,
      undefined,
      'org-1'
    );
    expect(recordDelivery).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        event: 'payout.completed',
        payoutId: 'payout-1',
        transactionId: null,
        refundId: null,
        statusCode: 200,
        success: true,
        attempt: 2,
      })
    );
    expect(result).toEqual({ delivered: true, statusCode: 200, attempts: 2 });
  });

  it('still records a failed delivery (dead-letter path)', async () => {
    vi.mocked(deliverWebhook).mockResolvedValueOnce({ delivered: false, statusCode: 500, attempts: 3 });

    await handleWebhookDeliver({
      event: { data: { organizationId: 'org-1', event: 'payment.failed', url: 'https://h', payload: {} } },
    });

    expect(recordDelivery).toHaveBeenCalledWith(expect.objectContaining({ success: false, statusCode: 500 }));
  });
});
