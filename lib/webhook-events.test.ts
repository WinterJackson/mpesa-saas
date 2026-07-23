import { describe, it, expect } from 'vitest';
import { WEBHOOK_EVENTS, ALL_WEBHOOK_EVENTS, paymentEvent, payoutEvent, refundEvent } from './webhook-events';

describe('webhook event catalog', () => {
  it('exposes the canonical event names including payout.reversed and webhook.test', () => {
    expect(ALL_WEBHOOK_EVENTS).toContain('payment.completed');
    expect(ALL_WEBHOOK_EVENTS).toContain('payout.reversed');
    expect(ALL_WEBHOOK_EVENTS).toContain('refund.failed');
    expect(ALL_WEBHOOK_EVENTS).toContain('webhook.test');
    expect(WEBHOOK_EVENTS.PAYOUT_REVERSED).toBe('payout.reversed');
  });

  it('builds event names from a resource status', () => {
    expect(paymentEvent('completed')).toBe('payment.completed');
    expect(payoutEvent('reversed')).toBe('payout.reversed');
    expect(refundEvent('failed')).toBe('refund.failed');
  });
});
