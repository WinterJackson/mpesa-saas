import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, BookOpen, Check, Minus } from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Logo } from "@/components/logo";
import { SiteFooter } from "@/components/site-footer";
import { ScrollReveal } from "@/components/scroll-reveal";
import { PricingClient } from "@/components/pricing/pricing-client";
import { PRICING_TIERS, FEATURE_MATRIX, PRICING_FAQ } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Pricing — PaySwift",
  description:
    "Flat, predictable M-Pesa pricing. A simple monthly plan plus a small flat fee per extra payment — PaySwift never takes a percentage of your sales.",
};

export default async function PricingPage() {
  const { userId } = await auth();
  const tierNames = PRICING_TIERS.map((t) => t.name);

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground font-sans selection:bg-primary selection:text-primary-foreground">
      {/* Floating Header */}
      <div className="fixed top-0 z-50 w-full pt-floating-header pl-[15px] md:pl-[30px] pr-0">
        <header className="w-full rounded-l-[40px] rounded-r-none bg-background text-foreground backdrop-blur-md shadow-[0_10px_40px_-10px_rgba(19,42,19,0.25)] dark:shadow-[0_10px_40px_-10px_rgba(19,42,19,0.6)]">
          <div className="flex h-20 w-full items-center justify-between px-4 md:px-6">
            <Logo />
            <nav className="flex items-center gap-4">
              <ThemeToggle />
              {userId ? (
                <Link href="/dashboard">
                  <Button variant="outline" size="sm">
                    Dashboard
                  </Button>
                </Link>
              ) : (
                <Link href="/sign-in">
                  <Button size="sm" className="font-medium">
                    Sign In
                  </Button>
                </Link>
              )}
            </nav>
          </div>
        </header>
      </div>

      <main className="flex-1">
        {/* Hero */}
        <section className="w-full pt-40 pb-16 md:pt-48 md:pb-24 relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-primary/10 rounded-full blur-[120px] pointer-events-none z-0" />
          <div className="container px-4 md:px-8 relative z-10 mx-auto max-w-4xl text-center">
            <ScrollReveal className="flex flex-col items-center gap-6">
              <span className="rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
                We never take a cut of your sales
              </span>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold font-heading tracking-tight text-balance leading-[1.1]">
                Simple, flat pricing.
                <br />
                <span className="text-primary">Keep 100% of every payment.</span>
              </h1>
              <p className="max-w-2xl text-base md:text-lg text-muted-foreground leading-relaxed">
                A predictable monthly plan plus a small flat fee for payments beyond your included
                volume. No percentage of your revenue, no surprise cutoffs, no card required — you pay
                by M-Pesa.
              </p>
            </ScrollReveal>
          </div>
        </section>

        {/* Plans + estimator */}
        <section className="w-full pb-24">
          <div className="container px-4 md:px-8 mx-auto max-w-7xl">
            <ScrollReveal>
              <PricingClient />
            </ScrollReveal>
          </div>
        </section>

        {/* Feature comparison */}
        <section className="w-full py-20 md:py-28 bg-sidebar text-sidebar-foreground">
          <div className="container px-4 md:px-8 mx-auto max-w-7xl">
            <ScrollReveal>
              <div className="mb-12 text-center max-w-2xl mx-auto">
                <h2 className="text-3xl md:text-4xl font-bold font-heading tracking-tight">
                  Compare every plan
                </h2>
                <p className="mt-4 text-sidebar-foreground/70">
                  Everything is included where you see a check. What you pay for is the product — not a
                  higher rate on your sales.
                </p>
              </div>
              <div className="overflow-x-auto rounded-2xl border border-sidebar-foreground/10">
                <table className="w-full min-w-[720px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-sidebar-foreground/10">
                      <th className="p-4 text-left font-semibold">Feature</th>
                      {tierNames.map((name) => (
                        <th key={name} className="p-4 text-center font-semibold">
                          {name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {FEATURE_MATRIX.map((row) => (
                      <tr key={row.label} className="border-b border-sidebar-foreground/10 last:border-0">
                        <td className="p-4 text-left font-medium">{row.label}</td>
                        {tierNames.map((name) => {
                          const v = row.values[name];
                          return (
                            <td key={name} className="p-4 text-center text-sidebar-foreground/80">
                              {v === true ? (
                                <Check className="mx-auto size-4 text-primary" />
                              ) : v === false ? (
                                <Minus className="mx-auto size-4 text-sidebar-foreground/30" />
                              ) : (
                                <span>{v}</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* FAQ */}
        <section className="w-full py-20 md:py-28">
          <div className="container px-4 md:px-8 mx-auto max-w-3xl">
            <ScrollReveal>
              <h2 className="mb-10 text-center text-3xl md:text-4xl font-bold font-heading tracking-tight">
                Questions, answered
              </h2>
              <div className="flex flex-col gap-3">
                {PRICING_FAQ.map((item) => (
                  <details
                    key={item.q}
                    className="group rounded-xl border border-border bg-background p-5 [&_summary]:cursor-pointer"
                  >
                    <summary className="flex items-center justify-between font-medium list-none">
                      {item.q}
                      <span className="ml-4 text-muted-foreground transition-transform group-open:rotate-45">
                        +
                      </span>
                    </summary>
                    <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{item.a}</p>
                  </details>
                ))}
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* Enterprise + CTA */}
        <section id="enterprise" className="w-full pb-28">
          <div className="container px-4 md:px-8 mx-auto max-w-5xl">
            <ScrollReveal>
              <div className="rounded-3xl border border-primary/20 bg-primary/5 p-8 md:p-12 text-center">
                <h2 className="text-2xl md:text-3xl font-bold font-heading tracking-tight">
                  Need custom volume, white-label, or a contractual SLA?
                </h2>
                <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
                  Enterprise plans cover multi-branch and franchise operations, marketplaces, and large
                  integrations, with negotiated pricing and a dedicated account manager.
                </p>
                <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
                  <Link href="/sign-up" className="w-full sm:w-auto">
                    <Button size="lg" className="w-full sm:w-auto rounded-full px-8">
                      Start free, no code needed <ArrowRight className="ml-2 size-5" />
                    </Button>
                  </Link>
                  <Link href="/docs" className="w-full sm:w-auto">
                    <Button
                      variant="outline"
                      size="lg"
                      className="w-full sm:w-auto rounded-full px-8"
                    >
                      <BookOpen className="mr-2 size-5" /> View API docs
                    </Button>
                  </Link>
                </div>
                <p className="mt-6 text-sm text-muted-foreground">
                  Enterprise enquiries:{" "}
                  <a
                    href="mailto:sales@payswift.co.ke"
                    className="font-medium text-primary underline underline-offset-4"
                  >
                    sales@payswift.co.ke
                  </a>
                </p>
              </div>
            </ScrollReveal>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
