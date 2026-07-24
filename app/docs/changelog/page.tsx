import Link from 'next/link';
import { Logo } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';

export const metadata = {
  title: 'Changelog | PaySwift Docs',
  description: 'What is new in PaySwift.',
};

const ENTRIES = [
  {
    date: '2026-07-24',
    title: 'Scale, observability & compliance',
    items: [
      'Database-level tenant isolation (Postgres Row-Level Security) as defense-in-depth behind application scoping.',
      'Encryption keys are now rotatable without downtime.',
      'Durable webhook delivery: deliveries survive beyond a single request when enabled, with failed deliveries surfaced for redelivery.',
      'End-to-end tracing of Daraja calls and webhook dispatch in our monitoring.',
      'Public status page at /status with rolling uptime history.',
      'Self-service data export, and an admin-reviewed data-deletion request flow (Kenya DPA groundwork).',
      'Hardened webhook URL handling (SSRF protections) and added secret/dependency scanning to CI.',
    ],
  },
  {
    date: '2026-07-23',
    title: 'Merchant integration & developer experience',
    items: [
      'No-code Payment Links: shareable links, PaySwift-hosted checkout at /pay/[slug], QR codes, and an embeddable “Pay with M-Pesa” button.',
      'One-click Shopify connect: install via OAuth — orders automatically collect payment with M-Pesa and are marked paid.',
      'Public API contract frozen at /api/v1 with an OpenAPI 3.1 spec and interactive reference at /docs.',
      'Cursor pagination on transaction lists, plus a new GET /api/v1/transactions endpoint.',
      'Webhook event catalog (incl. payout.reversed), a delivery inspector with payload viewer and redelivery, and a fixed test-event signature.',
      'Per-plan API rate limits with X-RateLimit-* response headers.',
      'Dashboard Sandbox/Live view filter.',
    ],
  },
];

export default function ChangelogPage() {
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
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Changelog</h1>
        </div>
        {ENTRIES.map((entry) => (
          <section key={entry.date} className="space-y-2">
            <p className="text-sm text-muted-foreground">{entry.date}</p>
            <h2 className="text-xl font-semibold tracking-tight">{entry.title}</h2>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {entry.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ))}
      </main>
    </div>
  );
}
