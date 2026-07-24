import Link from 'next/link';
import { Logo } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';

export const metadata = {
  title: 'Reliability & SLA | PaySwift Docs',
  description: 'Uptime targets, status, incident severity, and data protection.',
};

export default function ReliabilityPage() {
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

      <main className="container mx-auto max-w-3xl px-4 py-10 space-y-10">
        <div>
          <Link href="/docs" className="text-sm text-muted-foreground hover:text-foreground">← Docs</Link>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Reliability &amp; SLA</h1>
          <p className="mt-2 text-muted-foreground">
            How PaySwift keeps your payments flowing, what we commit to, and how we handle incidents.
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold tracking-tight">Status</h2>
          <p className="text-sm text-muted-foreground">
            Live component status and rolling uptime history are published at{' '}
            <Link href="/status" className="text-primary hover:underline">/status</Link>. Note that this
            page reflects PaySwift&apos;s own infrastructure and is not an independent monitor.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold tracking-tight">Uptime targets</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li><strong className="text-foreground">99.9% API uptime</strong> target for paid tiers, measured monthly on the payment-processing endpoints.</li>
            <li>Money-movement calls are protected by idempotency, so a retry after a timeout never double-charges or double-pays.</li>
            <li>Webhook delivery is retried with backoff and, when durable delivery is enabled, survives beyond a single request — failed deliveries are surfaced in your dashboard&apos;s webhook inspector for redelivery.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold tracking-tight">Incident severity</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="py-2 pr-4 font-medium">Severity</th>
                  <th className="py-2 pr-4 font-medium">Meaning</th>
                  <th className="py-2 font-medium">Response</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b border-border">
                  <td className="py-2 pr-4 font-medium text-foreground">Sev1</td>
                  <td className="py-2 pr-4">Money movement broken, or a confirmed data breach</td>
                  <td className="py-2">Immediate</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="py-2 pr-4 font-medium text-foreground">Sev2</td>
                  <td className="py-2 pr-4">Major degradation, no confirmed data loss</td>
                  <td className="py-2">Within the hour</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-foreground">Sev3</td>
                  <td className="py-2 pr-4">Minor or contained</td>
                  <td className="py-2">Next business day</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold tracking-tight">Your data</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Sensitive secrets (API keys, Daraja credentials, webhook secrets) are hashed or AES-256-GCM encrypted at rest, and never logged.</li>
            <li>You can export your organization&apos;s data at any time from the dashboard (owner/admin).</li>
            <li>Data-deletion requests are reviewed by our team — deletion is not automatic, because financial records carry legal retention obligations.</li>
            <li>We operate under the Kenya Data Protection Act, 2019, including breach-notification obligations.</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
