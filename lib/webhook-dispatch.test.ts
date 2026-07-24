import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dispatchWebhook } from './webhook-dispatch';
import { inngest, isInngestConfigured } from '@/lib/inngest';
import { deliverWebhook } from '@/lib/webhook';
import { recordDelivery } from '@/lib/repositories/webhook-deliveries';

vi.mock('@/lib/inngest', () => ({
  inngest: { send: vi.fn() },
  isInngestConfigured: vi.fn(),
  WEBHOOK_DELIVER_EVENT: 'webhook/deliver',
}));
vi.mock('@/lib/webhook', () => ({ deliverWebhook: vi.fn() }));
vi.mock('@/lib/repositories/webhook-deliveries', () => ({ recordDelivery: vi.fn() }));
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

const baseInput = {
  organizationId: 'org-1',
  event: 'payment.completed',
  url: 'https://merchant.example/hook',
  payload: { a: 1 },
  secret: 'shh',
};

describe('dispatchWebhook', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sends an Inngest event and does NOT call deliverWebhook/recordDelivery directly when Inngest is configured', async () => {
    vi.mocked(isInngestConfigured).mockReturnValue(true);

    await dispatchWebhook(baseInput);

    expect(inngest.send).toHaveBeenCalledWith({ name: 'webhook/deliver', data: baseInput });
    expect(deliverWebhook).not.toHaveBeenCalled();
    expect(recordDelivery).not.toHaveBeenCalled();
  });

  it('falls back to direct delivery + recordDelivery when Inngest is NOT configured', async () => {
    vi.mocked(isInngestConfigured).mockReturnValue(false);
    vi.mocked(deliverWebhook).mockResolvedValueOnce({ delivered: true, statusCode: 200, attempts: 1 });

    await dispatchWebhook(baseInput);

    expect(inngest.send).not.toHaveBeenCalled();
    expect(deliverWebhook).toHaveBeenCalledWith(
      baseInput.url,
      baseInput.payload,
      baseInput.secret,
      undefined,
      undefined,
      baseInput.organizationId
    );
    expect(recordDelivery).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        event: 'payment.completed',
        url: baseInput.url,
        statusCode: 200,
        success: true,
        attempt: 1,
      })
    );
  });

  it('does not throw when the direct delivery fails — it only logs a warning', async () => {
    vi.mocked(isInngestConfigured).mockReturnValue(false);
    vi.mocked(deliverWebhook).mockResolvedValueOnce({ delivered: false, statusCode: 500, attempts: 3 });

    await expect(dispatchWebhook(baseInput)).resolves.toBeUndefined();
    expect(recordDelivery).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });
});
