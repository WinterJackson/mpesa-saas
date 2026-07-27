import { Inngest } from 'inngest';

// Webhook-delivery durability only (Phase 4, Stage 5) — the 3 existing
// app/api/cron/* jobs stay on cron-job.org per the recent, deliberate
// decision to move scheduling there. Dormant until INNGEST_EVENT_KEY is set
// (see isInngestConfigured below), matching this repo's pattern for
// optional-until-configured integrations (Shopify, R2, certs).

export interface WebhookDeliverEventData {
  organizationId: string;
  event: string;
  url: string;
  payload: Record<string, unknown>;
  secret?: string;
  headers?: Record<string, string>;
  transactionId?: string | null;
  payoutId?: string | null;
  refundId?: string | null;
}

export const WEBHOOK_DELIVER_EVENT = 'webhook/deliver' as const;

export interface BulkPayoutProcessEventData {
  organizationId: string;
  payoutId: string;
  environment: 'sandbox' | 'live';
  amount: number;
  phone: string;
  commandId?: string;
  remarks?: string;
  occasion?: string;
}

export const BULK_PAYOUT_PROCESS_EVENT = 'payout/bulk-process' as const;

export const inngest = new Inngest({ id: 'payswift' });

/** Whether Inngest is configured to actually send/receive events in this environment. */
export function isInngestConfigured(): boolean {
  return Boolean(process.env.INNGEST_EVENT_KEY);
}
