import Link from "next/link";
import { ArrowRight, Code2, Globe, LayoutDashboard, TestTube2, Workflow, CreditCard, Activity } from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function Home() {
  const { userId } = await auth();

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground font-sans selection:bg-primary selection:text-primary-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4 md:px-8">
          <div className="flex items-center gap-2">
            <Globe className="size-6 text-primary" />
            <span className="text-xl font-bold tracking-tight">PaySwift</span>
          </div>
          <nav className="flex items-center gap-4">
            <ThemeToggle />
            {userId ? (
              <Link href="/dashboard">
                <Button variant="outline" size="sm">
                  Dashboard
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/sign-in">
                  <Button variant="ghost" size="sm" className="hidden sm:inline-flex">
                    Sign In
                  </Button>
                </Link>
                <Link href="/sign-up">
                  <Button size="sm">Get Started</Button>
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="w-full py-24 md:py-32 lg:py-48 border-b border-border relative overflow-hidden">
          <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:32px_32px] dark:opacity-10 opacity-0 pointer-events-none" />
          <div className="container px-4 md:px-8 flex flex-col items-center text-center gap-8 relative z-10 mx-auto max-w-4xl">
            <div className="flex flex-col gap-4 items-center">
              <h1 className="text-5xl md:text-7xl font-extrabold tracking-tighter leading-[1.1]">
                Accept M-Pesa Payments <br className="hidden md:block" />
                <span className="text-muted-foreground">on Your Website</span>
              </h1>
              <p className="max-w-[600px] text-lg md:text-xl text-muted-foreground leading-relaxed mt-4">
                The developer-first M-Pesa integration platform. Seamlessly collect payments, automate reconciliation, and monitor revenue in real-time.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-4 mt-8 w-full sm:w-auto">
              {userId ? (
                <Link href="/dashboard" className="w-full sm:w-auto">
                  <Button size="lg" className="w-full sm:w-auto font-medium rounded-none px-8 py-6 text-lg h-14">
                    Access Dashboard <ArrowRight className="ml-2 size-5" />
                  </Button>
                </Link>
              ) : (
                <Link href="/sign-up" className="w-full sm:w-auto">
                  <Button size="lg" className="w-full sm:w-auto font-medium rounded-none px-8 py-6 text-lg h-14">
                    Get Started <ArrowRight className="ml-2 size-5" />
                  </Button>
                </Link>
              )}
              <Link href="/demo-store" className="w-full sm:w-auto">
                <Button variant="outline" size="lg" className="w-full sm:w-auto rounded-none px-8 py-6 text-lg h-14 bg-background">
                  Try Demo
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="w-full py-24 border-b border-border bg-muted/30">
          <div className="container px-4 md:px-8 mx-auto">
            <div className="mb-16 text-center">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Enterprise-Grade Infrastructure</h2>
              <p className="mt-4 text-lg text-muted-foreground">Everything you need to build scalable payment flows.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {/* Feature 1 */}
              <div className="flex flex-col items-start gap-4 p-6 border border-border bg-background rounded-none">
                <div className="p-3 border border-border bg-muted/50">
                  <Code2 className="size-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold tracking-tight">API Integration</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Simple REST API with API key authentication. Integrate in minutes, not weeks.
                </p>
              </div>
              {/* Feature 2 */}
              <div className="flex flex-col items-start gap-4 p-6 border border-border bg-background rounded-none">
                <div className="p-3 border border-border bg-muted/50">
                  <Workflow className="size-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold tracking-tight">Real-time Webhooks</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Instant payment notifications to your server. Never drop a successful transaction.
                </p>
              </div>
              {/* Feature 3 */}
              <div className="flex flex-col items-start gap-4 p-6 border border-border bg-background rounded-none">
                <div className="p-3 border border-border bg-muted/50">
                  <LayoutDashboard className="size-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold tracking-tight">Merchant Dashboard</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Monitor transactions in real-time. View analytics, manage API keys, and test webhooks.
                </p>
              </div>
              {/* Feature 4 */}
              <div className="flex flex-col items-start gap-4 p-6 border border-border bg-background rounded-none">
                <div className="p-3 border border-border bg-muted/50">
                  <TestTube2 className="size-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold tracking-tight">Test & Live Modes</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Full sandbox testing before going live. Simulate successes and failures easily.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="w-full py-24 border-b border-border">
          <div className="container px-4 md:px-8 mx-auto">
            <div className="mb-16 text-center">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">How It Works</h2>
              <p className="mt-4 text-lg text-muted-foreground">Go from zero to collecting payments in three steps.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
              <div className="hidden md:block absolute top-12 left-[15%] right-[15%] h-[1px] bg-border z-0" />
              
              <div className="flex flex-col items-center text-center gap-4 relative z-10">
                <div className="w-16 h-16 rounded-full border border-border bg-background flex items-center justify-center text-2xl font-bold mb-4 shadow-sm">
                  1
                </div>
                <div className="p-4 border border-border bg-muted/30 rounded-full mb-2">
                  <Code2 className="size-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold tracking-tight">Integrate</h3>
                <p className="text-muted-foreground">Add our robust REST API to your codebase and securely authenticate with your merchant keys.</p>
              </div>

              <div className="flex flex-col items-center text-center gap-4 relative z-10">
                <div className="w-16 h-16 rounded-full border border-border bg-background flex items-center justify-center text-2xl font-bold mb-4 shadow-sm">
                  2
                </div>
                <div className="p-4 border border-border bg-muted/30 rounded-full mb-2">
                  <CreditCard className="size-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold tracking-tight">Collect</h3>
                <p className="text-muted-foreground">Trigger STK push prompts instantly to your customers' devices. They enter their PIN, you get paid.</p>
              </div>

              <div className="flex flex-col items-center text-center gap-4 relative z-10">
                <div className="w-16 h-16 rounded-full border border-border bg-background flex items-center justify-center text-2xl font-bold mb-4 shadow-sm">
                  3
                </div>
                <div className="p-4 border border-border bg-muted/30 rounded-full mb-2">
                  <Activity className="size-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold tracking-tight">Monitor</h3>
                <p className="text-muted-foreground">Receive real-time webhooks on your backend and monitor revenue live from your dashboard.</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-border py-8 bg-background">
        <div className="container px-4 md:px-8 mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Globe className="size-4" />
            <span className="font-semibold">PaySwift</span>
          </div>
          <p className="text-sm text-muted-foreground uppercase tracking-wider">
            &copy; {new Date().getFullYear()} PaySwift. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
