import Link from "next/link";
import { ArrowRight, Link2, LayoutDashboard, ShoppingBag, ShieldCheck, Smartphone, Rocket, Check } from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import { Button } from "@/components/ui/button";
import { CodeSnippet } from "@/components/code-snippet";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ParticlesBackground } from "@/components/particles-background";
import { ScrollReveal } from "@/components/scroll-reveal";

export default async function Home() {
  const { userId } = await auth();

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground font-sans selection:bg-primary selection:text-primary-foreground">
      {/* Floating Header Wrapper */}
      <SiteHeader />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="w-full min-h-[100dvh] flex flex-col justify-center pt-32 pb-24 md:pt-40 md:pb-32 lg:pt-48 lg:pb-40 relative overflow-hidden bg-background">
          {/* Subtle warm glow background */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/10 rounded-full blur-[120px] pointer-events-none z-0" />
          <ParticlesBackground />
          <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:32px_32px] dark:opacity-10 opacity-0 pointer-events-none z-0" />
          <div className="container px-4 md:px-8 relative z-10 mx-auto max-w-7xl">
            <ScrollReveal className="flex flex-col lg:flex-row items-center justify-between gap-12 lg:gap-8">
              {/* Left Side - Text */}
              <div className="flex-1 flex flex-col gap-6 text-left max-w-2xl">
                <h1 className="text-4xl md:text-5xl lg:text-7xl font-extrabold font-heading tracking-tight text-balance leading-[1.15]">
                  Get paid. Track revenue. <br className="hidden md:block" />
                  <span className="text-foreground">Run your business.</span>
                </h1>
                <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-[65ch]">
                  Share a payment link, add a checkout button, or connect your online store — every transaction lands straight in one dashboard built for your business, with M-Pesa built in. No coding needed to get started.
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
                className="text-sidebar fill-current opacity-25"
              />
              <path
                d="M0,120V15.81C13,36.92,27.64,56.86,47.69,72.05,99.41,111.27,165,111,224.58,91.58c31.15-10.15,60.09-26.07,89.67-39.8,40.92-19,84.73-46,130.83-49.67,36.26-2.85,70.9,9.42,98.6,31.56,31.77,25.39,62.32,62,103.63,73,40.44,10.79,81.35-6.69,119.13-24.28s75.16-39,116.92-43.05c59.73-5.85,113.28,22.88,168.9,38.84,30.2,8.66,59,6.17,87.09-7.5,22.43-10.89,48-26.93,60.65-49.24V120Z"
                className="text-sidebar fill-current opacity-50"
              />
              <path
                d="M0,120V5.63C149.93,59,314.09,71.32,475.83,42.57c43-7.64,84.23-20.12,127.61-26.46,59-8.63,112.48,12.24,165.56,35.4C827.93,77.22,886,95.24,951.2,90c86.53-7,172.46-45.71,248.8-84.81V120Z"
                className="text-sidebar fill-current"
              />
            </svg>
          </div>
        </section>

        {/* Features Grid */}
        <section className="w-full py-20 md:py-32 bg-sidebar text-sidebar-foreground relative z-10 -mt-[1px]">
          <div className="container px-4 md:px-8 mx-auto max-w-7xl">
            <ScrollReveal>
              <div className="mb-16 text-center max-w-3xl mx-auto">
                <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold font-heading tracking-tight text-balance">Everything you need to get paid</h2>
                <p className="mt-6 text-lg text-sidebar-foreground/70 leading-relaxed">Simple tools for busy business owners — no tech skills required.</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 md:gap-8">
                {/* Feature 1 */}
                <div className="group flex flex-col items-start gap-3 sm:gap-5 p-5 sm:p-8 border border-sidebar-border bg-sidebar-accent/50 rounded-2xl shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-sidebar-border/80 hover:shadow-md hover:bg-sidebar-accent">
                  <div className="p-3 bg-white/10 rounded-xl transition-colors duration-300 group-hover:bg-white/20">
                    <Link2 className="size-6 text-sidebar-foreground transition-transform duration-300 group-hover:scale-110" />
                  </div>
                  <h3 className="text-xl md:text-2xl font-bold font-heading tracking-tight">Links &amp; QR codes</h3>
                  <p className="text-base text-sidebar-foreground/70 leading-relaxed">
                    Make a payment link or QR code in seconds and share it on WhatsApp, Instagram, or in your shop. Customers just tap and pay.
                  </p>
                </div>
                {/* Feature 2 */}
                <div className="group flex flex-col items-start gap-3 sm:gap-5 p-5 sm:p-8 border border-sidebar-border bg-sidebar-accent/50 rounded-2xl shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-sidebar-border/80 hover:shadow-md hover:bg-sidebar-accent">
                  <div className="p-3 bg-white/10 rounded-xl transition-colors duration-300 group-hover:bg-white/20">
                    <LayoutDashboard className="size-6 text-sidebar-foreground transition-transform duration-300 group-hover:scale-110" />
                  </div>
                  <h3 className="text-xl md:text-2xl font-bold font-heading tracking-tight">One simple dashboard</h3>
                  <p className="text-base text-sidebar-foreground/70 leading-relaxed">
                    See every payment the moment it happens, send receipts, and know exactly what you&apos;ve earned — all in one place.
                  </p>
                </div>
                {/* Feature 3 */}
                <div className="group flex flex-col items-start gap-3 sm:gap-5 p-5 sm:p-8 border border-sidebar-border bg-sidebar-accent/50 rounded-2xl shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-sidebar-border/80 hover:shadow-md hover:bg-sidebar-accent">
                  <div className="p-3 bg-white/10 rounded-xl transition-colors duration-300 group-hover:bg-white/20">
                    <ShoppingBag className="size-6 text-sidebar-foreground transition-transform duration-300 group-hover:scale-110" />
                  </div>
                  <h3 className="text-xl md:text-2xl font-bold font-heading tracking-tight">Works with your store</h3>
                  <p className="text-base text-sidebar-foreground/70 leading-relaxed">
                    Selling on Shopify? Connect in one click and collect M-Pesa automatically on every order.
                  </p>
                </div>
                {/* Feature 4 */}
                <div className="group flex flex-col items-start gap-3 sm:gap-5 p-5 sm:p-8 border border-sidebar-border bg-sidebar-accent/50 rounded-2xl shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-sidebar-border/80 hover:shadow-md hover:bg-sidebar-accent">
                  <div className="p-3 bg-white/10 rounded-xl transition-colors duration-300 group-hover:bg-white/20">
                    <ShieldCheck className="size-6 text-sidebar-foreground transition-transform duration-300 group-hover:scale-110" />
                  </div>
                  <h3 className="text-xl md:text-2xl font-bold font-heading tracking-tight">Safe &amp; reliable</h3>
                  <p className="text-base text-sidebar-foreground/70 leading-relaxed">
                    Strong security, automatic matching of every payment, and a free practice mode so you can try it all before going live.
                  </p>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* How It Works */}
        <section className="w-full py-20 md:py-32 relative overflow-hidden bg-muted/20">
          <ParticlesBackground id="tsparticles-howit" />
          <div className="container px-4 md:px-8 mx-auto max-w-7xl relative z-10">
            <ScrollReveal>
              <div className="mb-16 text-center max-w-3xl mx-auto">
                <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold font-heading tracking-tight text-balance">How it works</h2>
                <p className="mt-6 text-lg text-muted-foreground leading-relaxed">Start collecting M-Pesa payments in three simple steps.</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 sm:gap-8 md:gap-12 relative">
                {/* Connecting Line (Desktop) */}
                <div className="hidden md:block absolute top-12 left-1/6 right-1/6 h-[2px] bg-border/50 z-0" />
                
                <div className="group relative z-10 flex flex-col items-start text-left gap-3 sm:gap-5 p-5 sm:p-8 md:p-10 border border-border/50 bg-background rounded-2xl shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-md">
                  <div className="flex w-full items-center justify-between mb-1 sm:mb-2">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full border border-border/50 bg-background flex items-center justify-center text-xl sm:text-2xl font-bold font-heading shadow-sm transition-all duration-300 group-hover:border-primary/30 group-hover:text-primary group-hover:scale-110">
                      1
                    </div>
                    <div className="p-3 sm:p-4 bg-muted/50 rounded-2xl transition-colors duration-300 group-hover:bg-primary/10">
                      <Rocket className="size-6 sm:size-8 text-primary dark:text-white transition-transform duration-300 group-hover:scale-110" />
                    </div>
                  </div>
                  <h3 className="text-lg sm:text-xl md:text-2xl font-bold font-heading tracking-tight mt-1 sm:mt-2">Set up in minutes</h3>
                  <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">Sign up, add your M-Pesa Till, and create your first payment link — no technical setup needed.</p>
                </div>

                <div className="group relative z-10 flex flex-col items-start text-left gap-3 sm:gap-5 p-5 sm:p-8 md:p-10 border border-border/50 bg-background rounded-2xl shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-md">
                  <div className="flex w-full items-center justify-between mb-1 sm:mb-2">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full border border-border/50 bg-background flex items-center justify-center text-xl sm:text-2xl font-bold font-heading shadow-sm transition-all duration-300 group-hover:border-primary/30 group-hover:text-primary group-hover:scale-110">
                      2
                    </div>
                    <div className="p-3 sm:p-4 bg-muted/50 rounded-2xl transition-colors duration-300 group-hover:bg-primary/10">
                      <Smartphone className="size-6 sm:size-8 text-primary dark:text-white transition-transform duration-300 group-hover:scale-110" />
                    </div>
                  </div>
                  <h3 className="text-lg sm:text-xl md:text-2xl font-bold font-heading tracking-tight mt-1 sm:mt-2">Your customer pays</h3>
                  <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">They get a prompt on their phone, enter their M-Pesa PIN, and the payment is done in seconds.</p>
                </div>

                <div className="group relative z-10 flex flex-col items-start text-left gap-3 sm:gap-5 p-5 sm:p-8 md:p-10 border border-border/50 bg-background rounded-2xl shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-md col-span-2 md:col-span-1">
                  <div className="flex w-full items-center justify-between mb-1 sm:mb-2">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full border border-border/50 bg-background flex items-center justify-center text-xl sm:text-2xl font-bold font-heading shadow-sm transition-all duration-300 group-hover:border-primary/30 group-hover:text-primary group-hover:scale-110">
                      3
                    </div>
                    <div className="p-3 sm:p-4 bg-muted/50 rounded-2xl transition-colors duration-300 group-hover:bg-primary/10">
                      <LayoutDashboard className="size-6 sm:size-8 text-primary dark:text-white transition-transform duration-300 group-hover:scale-110" />
                    </div>
                  </div>
                  <h3 className="text-lg sm:text-xl md:text-2xl font-bold font-heading tracking-tight mt-1 sm:mt-2">Track everything</h3>
                  <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">Watch payments arrive live in your dashboard, and get an instant alert for every sale you make.</p>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </section>
        
        {/* Developer Integration Preview (Forced Dark Mode) */}
        <section className="w-full pr-[10px]">
          <div className="w-full py-20 md:py-32 bg-sidebar text-sidebar-foreground overflow-hidden rounded-r-[40px]">
          <div className="container px-4 md:px-8 mx-auto max-w-7xl">
            <ScrollReveal className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
              <div className="flex-1 space-y-8 text-center lg:text-left">
                <span className="inline-block rounded-full border border-sidebar-border bg-sidebar-accent/50 px-4 py-1.5 text-sm font-medium text-sidebar-foreground/80">For developers</span>
                <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold font-heading tracking-tight text-balance">Got a developer? They&apos;ll love it too</h2>
                <p className="text-lg md:text-xl text-sidebar-foreground/70 leading-relaxed max-w-[50ch] mx-auto lg:mx-0">
                  Want to build payments right into your own app or website? PaySwift comes with a clean,
                  well-documented API and instant payment alerts — so your developer can go live fast.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-sidebar-foreground bg-sidebar-accent/50 px-5 py-3 rounded-full border border-sidebar-border shadow-sm">
                    <Check className="size-4 text-sidebar-foreground" /> Simple API
                  </div>
                  <div className="flex items-center gap-2 text-sm font-medium text-sidebar-foreground bg-sidebar-accent/50 px-5 py-3 rounded-full border border-sidebar-border shadow-sm">
                    <Check className="size-4 text-sidebar-foreground" /> Clear docs
                  </div>
                  <div className="flex items-center gap-2 text-sm font-medium text-sidebar-foreground bg-sidebar-accent/50 px-5 py-3 rounded-full border border-sidebar-border shadow-sm">
                    <Check className="size-4 text-sidebar-foreground" /> Instant alerts
                  </div>
                </div>
              </div>
              <div className="flex-1 w-full relative">
                {/* Glow behind the code snippet */}
                <div className="absolute inset-0 bg-sidebar-primary/20 blur-[100px] rounded-full pointer-events-none" />
                <div className="relative z-10 w-full shadow-2xl rounded-xl border border-sidebar-border/50 overflow-hidden">
                  <CodeSnippet />
                </div>
              </div>
            </ScrollReveal>
          </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="w-full py-24 md:py-40 relative overflow-hidden bg-primary/5">
          <ParticlesBackground id="tsparticles-cta" />
          <div className="container px-4 md:px-8 mx-auto flex flex-col items-center text-center relative z-10 max-w-4xl">
            <ScrollReveal className="flex flex-col items-center">
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold font-heading tracking-tight mb-6 text-balance">Ready to start collecting payments?</h2>
              <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl leading-relaxed">
                Create your free account and share your first payment link in minutes. No code, no card, and no monthly fee until your business grows.
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
