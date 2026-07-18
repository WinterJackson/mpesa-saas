import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Code2, LayoutDashboard, TestTube2, Workflow, CreditCard, Activity, GitBranch, BookOpen, Check } from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { CodeSnippet } from "@/components/code-snippet";

export default async function Home() {
  const { userId } = await auth();

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground font-sans selection:bg-primary selection:text-primary-foreground">
      {/* Floating Header Wrapper */}
      <div className="fixed top-0 z-50 w-full pt-floating-header px-floating-header">
        <header className="w-full border border-primary rounded-floating-header bg-floating-header-bg backdrop-blur-md shadow-floating-header">
          <div className="flex h-16 w-full items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-2">
            <Image 
              src="/logo_d2.png" 
              alt="PaySwift Logo" 
              width={120} 
              height={40} 
              className="dark:hidden rounded-[10px]" 
            />
            <Image 
              src="/logo_l2.png" 
              alt="PaySwift Logo" 
              width={120} 
              height={40} 
              className="hidden dark:block rounded-[10px]" 
            />
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
                  <Button size="sm" className="font-medium">
                    Sign In
                  </Button>
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      </div>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="w-full pt-32 pb-24 md:pt-40 md:pb-32 lg:pt-56 lg:pb-48 relative overflow-hidden bg-hero bg-cover bg-center bg-no-repeat">
          <div className="absolute inset-0 bg-hero-overlay z-0" />
          <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:32px_32px] dark:opacity-10 opacity-0 pointer-events-none z-0" />
          <div className="container px-4 md:px-8 flex flex-col items-center text-center gap-8 relative z-10 mx-auto max-w-4xl">
            <div className="flex flex-col gap-4 items-center">
              <h1 className="text-5xl md:text-7xl font-extrabold tracking-tighter leading-[1.1]">
                Accept M-Pesa Payments <br className="hidden md:block" />
                <span className="text-foreground">on Your Website</span>
              </h1>
              <p className="max-w-[600px] text-lg md:text-xl text-foreground leading-relaxed mt-4">
                The developer-first M-Pesa integration platform. Seamlessly collect payments, automate reconciliation, and monitor revenue in real-time.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-4 mt-8 w-full sm:w-auto">
              {userId ? (
                <Link href="/dashboard" className="w-full sm:w-auto">
                  <Button size="lg" className="w-full sm:w-auto font-medium px-8 py-6 text-lg h-14">
                    Access Dashboard <ArrowRight className="ml-2 size-5" />
                  </Button>
                </Link>
              ) : (
                <Link href="/sign-up" className="w-full sm:w-auto">
                  <Button size="lg" className="w-full sm:w-auto font-medium px-8 py-6 text-lg h-14">
                    Get Started <ArrowRight className="ml-2 size-5" />
                  </Button>
                </Link>
              )}
              <Link href="/demo-store" className="w-full sm:w-auto">
                <Button variant="outline" size="lg" className="w-full sm:w-auto px-8 py-6 text-lg h-14 bg-background border-primary shadow-floating-header">
                  Try Demo
                </Button>
              </Link>
            </div>
          </div>

          {/* Layered Wavy Transition (Smoke/Fluid Effect) */}
          <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-none z-20 pointer-events-none transform translate-y-[1px]">
            <svg
              className="relative block w-[calc(100%+1.3px)] h-[80px] md:h-[150px]"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 1200 120"
              preserveAspectRatio="none"
            >
              <path
                d="M0,120V46.29c47.79,22.2,103.59,32.17,158,28,70.36-5.37,136.33-33.31,206.8-37.5C438.64,32.43,512.34,53.67,583,72.05c69.27,18,138.3,24.88,209.4,13.08,36.15-6,69.85-17.84,104.45-29.34C989.49,25,1113-14.29,1200,52.47V120Z"
                className="text-background fill-current opacity-25"
              />
              <path
                d="M0,120V15.81C13,36.92,27.64,56.86,47.69,72.05,99.41,111.27,165,111,224.58,91.58c31.15-10.15,60.09-26.07,89.67-39.8,40.92-19,84.73-46,130.83-49.67,36.26-2.85,70.9,9.42,98.6,31.56,31.77,25.39,62.32,62,103.63,73,40.44,10.79,81.35-6.69,119.13-24.28s75.16-39,116.92-43.05c59.73-5.85,113.28,22.88,168.9,38.84,30.2,8.66,59,6.17,87.09-7.5,22.43-10.89,48-26.93,60.65-49.24V120Z"
                className="text-background fill-current opacity-50"
              />
              <path
                d="M0,120V5.63C149.93,59,314.09,71.32,475.83,42.57c43-7.64,84.23-20.12,127.61-26.46,59-8.63,112.48,12.24,165.56,35.4C827.93,77.22,886,95.24,951.2,90c86.53-7,172.46-45.71,248.8-84.81V120Z"
                className="text-background fill-current"
              />
            </svg>
          </div>
        </section>

        {/* Features Grid */}
        <section className="w-full py-24 border-b border-border bg-background relative z-10">
          <div className="container px-4 md:px-8 mx-auto">
            <div className="mb-16 text-center">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Enterprise-Grade Infrastructure</h2>
              <p className="mt-4 text-lg text-muted-foreground">Everything you need to build scalable payment flows.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {/* Feature 1 */}
              <div className="group flex flex-col items-start gap-4 p-6 border border-border bg-background rounded-lg transition-all duration-300 hover:-translate-y-2 hover:border-primary hover:shadow-floating-header">
                <div className="p-3 border border-border bg-muted/50 rounded-lg transition-colors duration-300 group-hover:bg-primary/10 group-hover:border-primary/20">
                  <Code2 className="size-6 text-primary transition-transform duration-300 group-hover:scale-110" />
                </div>
                <h3 className="text-xl font-bold tracking-tight">API Integration</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Simple REST API with API key authentication. Integrate in minutes, not weeks.
                </p>
              </div>
              {/* Feature 2 */}
              <div className="group flex flex-col items-start gap-4 p-6 border border-border bg-background rounded-lg transition-all duration-300 hover:-translate-y-2 hover:border-primary hover:shadow-floating-header">
                <div className="p-3 border border-border bg-muted/50 rounded-lg transition-colors duration-300 group-hover:bg-primary/10 group-hover:border-primary/20">
                  <Workflow className="size-6 text-primary transition-transform duration-300 group-hover:scale-110" />
                </div>
                <h3 className="text-xl font-bold tracking-tight">Real-time Webhooks</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Instant payment notifications to your server. Never drop a successful transaction.
                </p>
              </div>
              {/* Feature 3 */}
              <div className="group flex flex-col items-start gap-4 p-6 border border-border bg-background rounded-lg transition-all duration-300 hover:-translate-y-2 hover:border-primary hover:shadow-floating-header">
                <div className="p-3 border border-border bg-muted/50 rounded-lg transition-colors duration-300 group-hover:bg-primary/10 group-hover:border-primary/20">
                  <LayoutDashboard className="size-6 text-primary transition-transform duration-300 group-hover:scale-110" />
                </div>
                <h3 className="text-xl font-bold tracking-tight">Merchant Dashboard</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Monitor transactions in real-time. View analytics, manage API keys, and test webhooks.
                </p>
              </div>
              {/* Feature 4 */}
              <div className="group flex flex-col items-start gap-4 p-6 border border-border bg-background rounded-lg transition-all duration-300 hover:-translate-y-2 hover:border-primary hover:shadow-floating-header">
                <div className="p-3 border border-border bg-muted/50 rounded-lg transition-colors duration-300 group-hover:bg-primary/10 group-hover:border-primary/20">
                  <TestTube2 className="size-6 text-primary transition-transform duration-300 group-hover:scale-110" />
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
        <section className="w-full py-24 border-b border-border relative overflow-hidden">
          <div className="absolute inset-0 bg-primary/5 z-0" />
          <div className="container px-4 md:px-8 mx-auto relative z-10">
            <div className="mb-16 text-center">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">How It Works</h2>
              <p className="mt-4 text-lg text-muted-foreground">Go from zero to collecting payments in three steps.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 relative">
              <div className="group relative z-10 flex flex-col items-center text-center gap-4 p-6 sm:p-8 border border-border bg-background rounded-lg shadow-sm transition-all duration-300 hover:-translate-y-2 hover:border-primary hover:shadow-floating-header">
                <div className="w-16 h-16 rounded-full border border-border bg-background flex items-center justify-center text-2xl font-bold mb-2 shadow-sm transition-all duration-300 group-hover:border-primary group-hover:text-primary group-hover:scale-110">
                  1
                </div>
                <div className="p-4 border border-border bg-muted/30 rounded-full transition-colors duration-300 group-hover:bg-primary/10 group-hover:border-primary/20">
                  <Code2 className="size-8 text-primary transition-transform duration-300 group-hover:scale-110" />
                </div>
                <h3 className="text-xl font-bold tracking-tight">Integrate</h3>
                <p className="text-muted-foreground">Add our robust REST API to your codebase and securely authenticate with your merchant keys.</p>
              </div>

              <div className="group relative z-10 flex flex-col items-center text-center gap-4 p-6 sm:p-8 border border-border bg-background rounded-lg shadow-sm transition-all duration-300 hover:-translate-y-2 hover:border-primary hover:shadow-floating-header">
                <div className="w-16 h-16 rounded-full border border-border bg-background flex items-center justify-center text-2xl font-bold mb-2 shadow-sm transition-all duration-300 group-hover:border-primary group-hover:text-primary group-hover:scale-110">
                  2
                </div>
                <div className="p-4 border border-border bg-muted/30 rounded-full transition-colors duration-300 group-hover:bg-primary/10 group-hover:border-primary/20">
                  <CreditCard className="size-8 text-primary transition-transform duration-300 group-hover:scale-110" />
                </div>
                <h3 className="text-xl font-bold tracking-tight">Collect</h3>
                <p className="text-muted-foreground">Trigger STK push prompts instantly to your customers&apos; devices. They enter their PIN, you get paid.</p>
              </div>

              <div className="group relative z-10 flex flex-col items-center text-center gap-4 p-6 sm:p-8 border border-border bg-background rounded-lg shadow-sm transition-all duration-300 hover:-translate-y-2 hover:border-primary hover:shadow-floating-header">
                <div className="w-16 h-16 rounded-full border border-border bg-background flex items-center justify-center text-2xl font-bold mb-2 shadow-sm transition-all duration-300 group-hover:border-primary group-hover:text-primary group-hover:scale-110">
                  3
                </div>
                <div className="p-4 border border-border bg-muted/30 rounded-full transition-colors duration-300 group-hover:bg-primary/10 group-hover:border-primary/20">
                  <Activity className="size-8 text-primary transition-transform duration-300 group-hover:scale-110" />
                </div>
                <h3 className="text-xl font-bold tracking-tight">Monitor</h3>
                <p className="text-muted-foreground">Receive real-time webhooks on your backend and monitor revenue live from your dashboard.</p>
              </div>
            </div>
          </div>
        </section>
        {/* Developer Integration Preview */}
        <section className="w-full py-24 border-b border-border bg-background overflow-hidden">
          <div className="container px-4 md:px-8 mx-auto">
            <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
              <div className="flex-1 space-y-6 text-center lg:text-left">
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Developer-First by Design</h2>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  Integrating M-Pesa shouldn&apos;t require a 50-page manual. Our unified API endpoint allows you to trigger payment requests instantly from any language or framework. 
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground bg-background px-4 py-2 rounded-lg border border-border">
                    <Check className="size-4 text-primary" /> No XML payloads
                  </div>
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground bg-background px-4 py-2 rounded-lg border border-border">
                    <Check className="size-4 text-primary" /> Native JSON
                  </div>
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground bg-background px-4 py-2 rounded-lg border border-border">
                    <Check className="size-4 text-primary" /> Bearer Auth
                  </div>
                </div>
              </div>
              <div className="flex-1 w-full relative">
                {/* Glow behind the code snippet */}
                <div className="absolute inset-0 bg-primary/20 blur-[100px] rounded-full pointer-events-none" />
                <div className="relative z-10 w-full">
                  <CodeSnippet />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="w-full py-24 border-b border-border relative overflow-hidden">
          <div className="absolute inset-0 bg-primary/5 z-0" />
          <div className="container px-4 md:px-8 mx-auto flex flex-col items-center text-center relative z-10">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">Ready to start collecting payments?</h2>
            <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl">
              Join the future of M-Pesa integration. Get your API keys and trigger your first payment request in seconds.
            </p>
            <Link href="/sign-up">
              <Button size="lg" className="px-10 py-6 text-lg h-14 font-medium shadow-floating-header transition-all duration-300 hover:-translate-y-1">
                Get Started <ArrowRight className="ml-2 size-5" />
              </Button>
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full py-16 border-t border-border bg-background">
        <div className="container px-4 md:px-8 mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 lg:gap-24">
            <div className="md:col-span-2 flex flex-col items-start gap-4">
              <div className="flex items-center gap-2">
                <Image 
                  src="/logo_d2.png" 
                  alt="PaySwift Logo" 
                  width={120} 
                  height={40} 
                  className="dark:hidden rounded-[10px]" 
                />
                <Image 
                  src="/logo_l2.png" 
                  alt="PaySwift Logo" 
                  width={120} 
                  height={40} 
                  className="hidden dark:block rounded-[10px]" 
                />
              </div>
              <p className="text-muted-foreground leading-relaxed max-w-sm mt-2">
                The developer-first M-Pesa integration platform. Seamlessly collect payments, automate reconciliation, and monitor revenue in real-time.
              </p>
              <p className="text-sm text-muted-foreground mt-8 uppercase tracking-wider font-medium">
                &copy; {new Date().getFullYear()} PaySwift. All rights reserved.
              </p>
            </div>
            
            <div className="flex flex-col gap-6">
              <h4 className="font-semibold text-foreground tracking-tight text-lg">Product</h4>
              <div className="flex flex-col gap-4">
                <Link href="/demo-store" className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-2 w-fit">
                  Demo Store
                </Link>
                <Link href="/sign-in" className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-2 w-fit">
                  Sign In
                </Link>
                <Link href="/sign-up" className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-2 w-fit">
                  Get Started
                </Link>
              </div>
            </div>

            <div className="flex flex-col gap-6">
              <h4 className="font-semibold text-foreground tracking-tight text-lg">Developers</h4>
              <div className="flex flex-col gap-4">
                <Link href="https://github.com/WinterJackson/mpesa-saas" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-2 w-fit">
                  <GitBranch className="size-4" /> GitHub Repository
                </Link>
                <Link href="https://github.com/WinterJackson/mpesa-saas/blob/main/README.md" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-2 w-fit">
                  <BookOpen className="size-4" /> Documentation
                </Link>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
