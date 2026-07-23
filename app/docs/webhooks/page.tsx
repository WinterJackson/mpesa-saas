import Link from 'next/link';
import { Logo } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { ALL_WEBHOOK_EVENTS } from '@/lib/webhook-events';

export const metadata = {
  title: 'Webhooks | PaySwift Docs',
  description: 'Webhook events, payloads, and signature verification.',
};

export default function WebhooksGuidePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="sticky top-0 z-50 w-full pt-floating-header px-floating-header pb-4">
        <header className="w-full rounded-floating-header bg-background/80 backdrop-blur-md shadow-floating-header">
          <div className="flex h-16 w-full items-center justify-between px-4 md:px-6">
            <Link href="/docs"><Logo /></Link>
            <ThemeToggle />
          </div>
        </header>
      </div>

      <main className="container mx-auto max-w-3xl px-4 py-10 space-y-8">
        <div>
          <Link href="/docs" className="text-sm text-muted-foreground hover:text-foreground">← Docs</Link>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Webhooks</h1>
          <p className="text-muted-foreground text-lg">
            PaySwift POSTs a JSON event to your configured URL whenever a payment, payout, or refund
            reaches a terminal state. Configure the URL and signing secret in Settings.
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold tracking-tight">Events</h2>
          <p className="text-sm text-muted-foreground">Every event name PaySwift can send:</p>
          <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {ALL_WEBHOOK_EVENTS.map((e) => (
              <li key={e}>
                <code className="rounded bg-muted px-1.5 py-0.5 text-sm">{e}</code>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold tracking-tight">Payload shape</h2>
          <pre className="overflow-x-auto rounded-lg border border-border bg-muted p-4 text-xs">
            <code>{`{
  "event": "payment.completed",
  "data": {
    "transactionId": "clx...",
    "amount": 2500,
    "phone": "254712345678",
    "status": "completed",
    "mpesaReceipt": "SF1A2B3C4D",
    "orderReference": "ORDER-1024",
    "resultCode": 0,
    "resultDesc": "The service request is processed successfully.",
    "createdAt": "2026-07-23T10:00:00.000Z",
    "updatedAt": "2026-07-23T10:00:12.000Z"
  }
}`}</code>
          </pre>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold tracking-tight">Verifying the signature</h2>
          <p className="text-sm text-muted-foreground">
            Each request includes an <code className="rounded bg-muted px-1 py-0.5 text-xs">x-payswift-signature</code>{' '}
            header — an HMAC-SHA256 of the raw request body, keyed with your signing secret. Recompute it
            and compare in constant time before trusting the payload.
          </p>
          <pre className="overflow-x-auto rounded-lg border border-border bg-muted p-4 text-xs">
            <code>{`import crypto from 'node:crypto';

function verify(rawBody, signature, secret) {
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}`}</code>
          </pre>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold tracking-tight">Delivery, retries &amp; redelivery</h2>
          <p className="text-sm text-muted-foreground">
            PaySwift retries failed deliveries (with backoff) and does not retry on 4xx responses. Every
            attempt is logged. Inspect payloads, HTTP responses, and manually redeliver failed events
            from the <Link href="/settings/webhooks" className="text-primary hover:underline">Webhook Deliveries</Link>{' '}
            inspector. Send a <code className="rounded bg-muted px-1 py-0.5 text-xs">webhook.test</code>{' '}
            event to check your endpoint end-to-end.
          </p>
        </section>
      </main>
    </div>
  );
}
