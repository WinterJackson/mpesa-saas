import Link from "next/link";
import { ArrowRight, Code2, LayoutDashboard, TestTube2, Workflow, CreditCard, Activity, Check } from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { CodeSnippet } from "@/components/code-snippet";
import { Logo } from "@/components/logo";
import { SiteFooter } from "@/components/site-footer";
import { ParticlesBackground } from "@/components/particles-background";
import { ScrollReveal } from "@/components/scroll-reveal";

export default async function Home() {
  const { userId } = await auth();

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground font-sans selection:bg-primary selection:text-primary-foreground">
      {/* Floating Header Wrapper */}
      <div className="fixed top-0 z-50 w-full pt-floating-header pl-[15px] md:pl-[30px] pr-0">
        <header className="w-full rounded-floating-header rounded-r-none bg-background text-foreground backdrop-blur-md shadow-floating-header">
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
        <section className="w-full pt-32 pb-24 md:pt-40 md:pb-32 lg:pt-48 lg:pb-40 relative overflow-hidden bg-background">
          {/* Subtle warm glow background */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/10 rounded-full blur-[120px] pointer-events-none z-0" />
          <ParticlesBackground />
          <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:32px_32px] dark:opacity-10 opacity-0 pointer-events-none z-0" />
          <div className="container px-4 md:px-8 relative z-10 mx-auto max-w-7xl">
            <ScrollReveal className="flex flex-col lg:flex-row items-center justify-between gap-12 lg:gap-8">
              {/* Left Side - Text */}
              <div className="flex-1 flex flex-col gap-6 text-left max-w-2xl">
                <h1 className="text-4xl md:text-5xl lg:text-7xl font-extrabold font-heading tracking-tight text-balance leading-[1.15]">
                  Accept M-Pesa Payments <br className="hidden md:block" />
                  <span className="text-foreground">on Your Website</span>
                </h1>
                <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-[65ch]">
                  The developer-first M-Pesa integration platform. Seamlessly collect payments, automate reconciliation, and monitor revenue in real-time.
                </p>
              </div>
              
              {/* Right Side - Buttons */}
              <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-center gap-4 w-full sm:w-auto shrink-0">
                {userId ? (
                  <Link href="/dashboard" className="w-full sm:w-auto">
                    <Button size="lg" className="w-full sm:w-auto font-medium px-8 py-6 text-lg h-14 rounded-full">
                      Access Dashboard <ArrowRight className="ml-2 size-5" />
                    </Button>
                  </Link>
                ) : (
                  <Link href="/sign-up" className="w-full sm:w-auto">
                    <Button size="lg" className="w-full sm:w-auto font-medium px-8 py-6 text-lg h-14 rounded-full">
                      Get Started <ArrowRight className="ml-2 size-5" />
                    </Button>
                  </Link>
                )}
                <Link href="/demo-store" className="w-full sm:w-auto">
                  <Button variant="outline" size="lg" className="w-full sm:w-auto px-8 py-6 text-lg h-14 bg-background/50 backdrop-blur-sm border-foreground/20 hover:border-foreground/40 shadow-sm rounded-full transition-colors">
                    Try Demo
                  </Button>
                </Link>
              </div>
            </ScrollReveal>
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
        <section className="w-full py-20 md:py-32 border-b border-border bg-background relative z-10">
          <div className="container px-4 md:px-8 mx-auto max-w-7xl">
            <ScrollReveal>
              <div className="mb-16 text-center max-w-3xl mx-auto">
                <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold font-heading tracking-tight text-balance">Enterprise-Grade Infrastructure</h2>
                <p className="mt-6 text-lg text-muted-foreground leading-relaxed">Everything you need to build scalable payment flows securely and reliably.</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 md:gap-8">
                {/* Feature 1 */}
                <div className="group flex flex-col items-start gap-3 sm:gap-5 p-5 sm:p-8 border border-border/50 bg-background rounded-2xl shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-md">
                  <div className="p-3 bg-muted/50 rounded-xl transition-colors duration-300 group-hover:bg-primary/10">
                    <Code2 className="size-6 text-primary transition-transform duration-300 group-hover:scale-110" />
                  </div>
                  <h3 className="text-xl md:text-2xl font-bold font-heading tracking-tight">API Integration</h3>
                  <p className="text-base text-muted-foreground leading-relaxed">
                    Simple REST API with API key authentication. Integrate in minutes, not weeks.
                  </p>
                </div>
                {/* Feature 2 */}
                <div className="group flex flex-col items-start gap-3 sm:gap-5 p-5 sm:p-8 border border-border/50 bg-background rounded-2xl shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-md">
                  <div className="p-3 bg-muted/50 rounded-xl transition-colors duration-300 group-hover:bg-primary/10">
                    <Workflow className="size-6 text-primary transition-transform duration-300 group-hover:scale-110" />
                  </div>
                  <h3 className="text-xl md:text-2xl font-bold font-heading tracking-tight">Real-time Webhooks</h3>
                  <p className="text-base text-muted-foreground leading-relaxed">
                    Instant payment notifications to your server. Never drop a successful transaction.
                  </p>
                </div>
                {/* Feature 3 */}
                <div className="group flex flex-col items-start gap-3 sm:gap-5 p-5 sm:p-8 border border-border/50 bg-background rounded-2xl shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-md">
                  <div className="p-3 bg-muted/50 rounded-xl transition-colors duration-300 group-hover:bg-primary/10">
                    <LayoutDashboard className="size-6 text-primary transition-transform duration-300 group-hover:scale-110" />
                  </div>
                  <h3 className="text-xl md:text-2xl font-bold font-heading tracking-tight">Merchant Dashboard</h3>
                  <p className="text-base text-muted-foreground leading-relaxed">
                    Monitor transactions in real-time. View analytics, manage API keys, and test webhooks.
                  </p>
                </div>
                {/* Feature 4 */}
                <div className="group flex flex-col items-start gap-3 sm:gap-5 p-5 sm:p-8 border border-border/50 bg-background rounded-2xl shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-md">
                  <div className="p-3 bg-muted/50 rounded-xl transition-colors duration-300 group-hover:bg-primary/10">
                    <TestTube2 className="size-6 text-primary transition-transform duration-300 group-hover:scale-110" />
                  </div>
                  <h3 className="text-xl md:text-2xl font-bold font-heading tracking-tight">Test & Live Modes</h3>
                  <p className="text-base text-muted-foreground leading-relaxed">
                    Full sandbox testing before going live. Simulate successes and failures easily.
                  </p>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* How It Works */}
        <section className="w-full py-20 md:py-32 border-b border-border relative overflow-hidden bg-muted/20">
          <ParticlesBackground id="tsparticles-howit" />
          <div className="container px-4 md:px-8 mx-auto max-w-7xl relative z-10">
            <ScrollReveal>
              <div className="mb-16 text-center max-w-3xl mx-auto">
                <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold font-heading tracking-tight text-balance">How It Works</h2>
                <p className="mt-6 text-lg text-muted-foreground leading-relaxed">Go from zero to collecting payments in three simple steps.</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 sm:gap-8 md:gap-12 relative">
                {/* Connecting Line (Desktop) */}
                <div className="hidden md:block absolute top-12 left-1/6 right-1/6 h-[2px] bg-border/50 z-0" />
                
                <div className="group relative z-10 flex flex-col items-center text-center gap-3 sm:gap-5 p-5 sm:p-8 md:p-10 border border-border/50 bg-background rounded-2xl shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-md">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full border border-border/50 bg-background flex items-center justify-center text-xl sm:text-2xl font-bold font-heading mb-1 sm:mb-2 shadow-sm transition-all duration-300 group-hover:border-primary/30 group-hover:text-primary group-hover:scale-110">
                    1
                  </div>
                  <div className="p-3 sm:p-4 bg-muted/50 rounded-2xl transition-colors duration-300 group-hover:bg-primary/10">
                    <Code2 className="size-6 sm:size-8 text-primary transition-transform duration-300 group-hover:scale-110" />
                  </div>
                  <h3 className="text-lg sm:text-xl md:text-2xl font-bold font-heading tracking-tight mt-1 sm:mt-2">Integrate</h3>
                  <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">Add our robust REST API to your codebase and securely authenticate with your merchant keys.</p>
                </div>

                <div className="group relative z-10 flex flex-col items-center text-center gap-3 sm:gap-5 p-5 sm:p-8 md:p-10 border border-border/50 bg-background rounded-2xl shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-md">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full border border-border/50 bg-background flex items-center justify-center text-xl sm:text-2xl font-bold font-heading mb-1 sm:mb-2 shadow-sm transition-all duration-300 group-hover:border-primary/30 group-hover:text-primary group-hover:scale-110">
                    2
                  </div>
                  <div className="p-3 sm:p-4 bg-muted/50 rounded-2xl transition-colors duration-300 group-hover:bg-primary/10">
                    <CreditCard className="size-6 sm:size-8 text-primary transition-transform duration-300 group-hover:scale-110" />
                  </div>
                  <h3 className="text-lg sm:text-xl md:text-2xl font-bold font-heading tracking-tight mt-1 sm:mt-2">Collect</h3>
                  <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">Trigger STK push prompts instantly to your customers&apos; devices. They enter their PIN, you get paid.</p>
                </div>

                <div className="group relative z-10 flex flex-col items-center text-center gap-3 sm:gap-5 p-5 sm:p-8 md:p-10 border border-border/50 bg-background rounded-2xl shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-md col-span-2 md:col-span-1">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full border border-border/50 bg-background flex items-center justify-center text-xl sm:text-2xl font-bold font-heading mb-1 sm:mb-2 shadow-sm transition-all duration-300 group-hover:border-primary/30 group-hover:text-primary group-hover:scale-110">
                    3
                  </div>
                  <div className="p-3 sm:p-4 bg-muted/50 rounded-2xl transition-colors duration-300 group-hover:bg-primary/10">
                    <Activity className="size-6 sm:size-8 text-primary transition-transform duration-300 group-hover:scale-110" />
                  </div>
                  <h3 className="text-lg sm:text-xl md:text-2xl font-bold font-heading tracking-tight mt-1 sm:mt-2">Monitor</h3>
                  <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">Receive real-time webhooks on your backend and monitor revenue live from your dashboard.</p>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </section>
        
        {/* Developer Integration Preview (Forced Dark Mode) */}
        <section className="dark w-full py-20 md:py-32 bg-background text-foreground overflow-hidden">
          <div className="container px-4 md:px-8 mx-auto max-w-7xl">
            <ScrollReveal className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
              <div className="flex-1 space-y-8 text-center lg:text-left">
                <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold font-heading tracking-tight text-balance">Developer-First by Design</h2>
                <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-[50ch] mx-auto lg:mx-0">
                  Integrating M-Pesa shouldn&apos;t require a 50-page manual. Our unified API endpoint allows you to trigger payment requests instantly from any language or framework. 
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground bg-card px-5 py-3 rounded-full border border-border/50 shadow-sm">
                    <Check className="size-4 text-primary" /> No XML payloads
                  </div>
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground bg-card px-5 py-3 rounded-full border border-border/50 shadow-sm">
                    <Check className="size-4 text-primary" /> Native JSON
                  </div>
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground bg-card px-5 py-3 rounded-full border border-border/50 shadow-sm">
                    <Check className="size-4 text-primary" /> Bearer Auth
                  </div>
                </div>
              </div>
              <div className="flex-1 w-full relative">
                {/* Glow behind the code snippet */}
                <div className="absolute inset-0 bg-primary/20 blur-[100px] rounded-full pointer-events-none" />
                <div className="relative z-10 w-full shadow-2xl rounded-xl border border-border/30 overflow-hidden">
                  <CodeSnippet />
                </div>
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* Final CTA */}
        <section className="w-full py-24 md:py-40 relative overflow-hidden bg-primary/5">
          <ParticlesBackground id="tsparticles-cta" />
          <div className="container px-4 md:px-8 mx-auto flex flex-col items-center text-center relative z-10 max-w-4xl">
            <ScrollReveal className="flex flex-col items-center">
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold font-heading tracking-tight mb-6 text-balance">Ready to start collecting payments?</h2>
              <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl leading-relaxed">
                Join the future of M-Pesa integration. Get your API keys and trigger your first payment request in seconds.
              </p>
              <Link href="/sign-up">
                <Button size="lg" className="px-10 py-7 text-lg h-14 font-medium shadow-floating-header transition-all duration-300 hover:-translate-y-1 hover:shadow-xl rounded-full">
                  Get Started <ArrowRight className="ml-2 size-5" />
                </Button>
              </Link>
            </ScrollReveal>
          </div>
        </section>
      </main>

      {/* Footer */}
      <SiteFooter />
    </div>
  );
}
