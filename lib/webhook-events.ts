/**
 * Canonical webhook event catalog. The single source of truth for the event
 * strings PaySwift emits, so every emit site and the docs stay in sync. An event
 * name is `<resource>.<terminal-state>`.
 */

export const WEBHOOK_EVENTS = {
  PAYMENT_COMPLETED: 'payment.completed',
  PAYMENT_CANCELLED: 'payment.cancelled',
  PAYMENT_FAILED: 'payment.failed',
  PAYOUT_COMPLETED: 'payout.completed',
  PAYOUT_FAILED: 'payout.failed',
  PAYOUT_REVERSED: 'payout.reversed',
  REFUND_COMPLETED: 'refund.completed',
  REFUND_FAILED: 'refund.failed',
  WEBHOOK_TEST: 'webhook.test',
} as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[keyof typeof WEBHOOK_EVENTS];

/** All event names, for docs and the "send test event" picker. */
export const ALL_WEBHOOK_EVENTS: WebhookEvent[] = Object.values(WEBHOOK_EVENTS);

/**
 * Maps a resource's terminal status to its event name. Statuses are the same
 * strings the Transaction/Payout/Refund records use. Unknown statuses fall back
 * to `<resource>.<status>` so we never silently drop an event.
 */
export function paymentEvent(status: string): string {
  return `payment.${status}`;
}
export function payoutEvent(status: string): string {
  return `payout.${status}`;
}
export function refundEvent(status: string): string {
  return `refund.${status}`;
}
