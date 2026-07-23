import Link from 'next/link';
import { Logo } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link2, Plug, Code2, ArrowRight } from 'lucide-react';

export const metadata = {
  title: 'Docs | PaySwift',
  description: 'Start collecting M-Pesa payments — with no code, or with the API.',
};

export default function DocsLandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="sticky top-0 z-50 w-full pt-floating-header px-floating-header pb-4">
        <header className="w-full rounded-floating-header bg-background/80 backdrop-blur-md shadow-floating-header">
          <div className="flex h-16 w-full items-center justify-between px-4 md:px-6">
            <Link href="/"><Logo /></Link>
            <ThemeToggle />
          </div>
        </header>
      </div>

      <main className="container mx-auto max-w-4xl px-4 py-10 space-y-12">
        <div className="space-y-3">
          <h1 className="text-3xl font-bold tracking-tight">PaySwift documentation</h1>
          <p className="text-muted-foreground text-lg">
            Take M-Pesa payments in minutes. Most stores don&apos;t need any code — start with a Payment
            Link. Developers can use the API for full control.
          </p>
        </div>

        {/* No-code quickstart — leads, matching the product priority. */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">No-code quickstart</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <Link2 className="size-5 text-primary" />
                <CardTitle className="text-base">1. Create a Payment Link</CardTitle>
                <CardDescription>
                  In your dashboard, open Payment Links and create one — a fixed price or let the
                  customer enter the amount.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <ArrowRight className="size-5 text-primary" />
                <CardTitle className="text-base">2. Share it</CardTitle>
                <CardDescription>
                  Send the link, show its QR code, or paste the &ldquo;Pay with M-Pesa&rdquo; button on
                  your site. Customers pay on a secure hosted page.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <Plug className="size-5 text-primary" />
                <CardTitle className="text-base">3. Connect Shopify (optional)</CardTitle>
                <CardDescription>
                  Run a Shopify store? Connect it in one click from Integrations — new orders
                  automatically prompt the customer to pay.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/payment-links">
              <Button>
                <Link2 className="size-4" /> Create a Payment Link
              </Button>
            </Link>
            <Link href="/integrations">
              <Button variant="outline">
                <Plug className="size-4" /> Connect Shopify
              </Button>
            </Link>
          </div>
        </section>

        {/* Developer API */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">Developer API</h2>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Code2 className="size-5" /> REST API reference
              </CardTitle>
              <CardDescription>
                Authenticate with your <code className="bg-muted px-1 py-0.5 rounded text-xs">x-api-key</code>{' '}
                and call <code className="bg-muted px-1 py-0.5 rounded text-xs">/api/v1</code> to initiate
                payments, send payouts, issue refunds, and list transactions. The interactive reference
                is generated from our OpenAPI 3.1 spec.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Link href="/docs/api">
                <Button>
                  Open API reference <ArrowRight className="size-4" />
                </Button>
              </Link>
              <a href="/api/v1/openapi.json" target="_blank" rel="noopener noreferrer">
                <Button variant="outline">Download OpenAPI spec</Button>
              </a>
            </CardContent>
          </Card>
          <p className="text-xs text-muted-foreground">
            The <code className="bg-muted px-1 py-0.5 rounded">/api/v1</code> contract is frozen — we only
            add optional fields. Breaking changes will ship under a new version.
          </p>
        </section>
      </main>
    </div>
  );
}
