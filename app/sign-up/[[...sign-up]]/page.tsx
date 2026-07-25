import { ThemedSignUp } from '@/components/auth/themed-sign-up';
import { ThemeToggle } from '@/components/theme-toggle';
import { ParticlesBackground } from '@/components/particles-background';
import { Logo } from '@/components/logo';
import Link from 'next/link';
import Image from 'next/image';

const SELF_SERVE_PLANS = ['Starter', 'Growth', 'Scale'];

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; redirect_url?: string }>;
}) {
  // Carry the plan chosen on /pricing through Clerk sign-up into onboarding, so
  // a paid selection (Growth/Scale) becomes a real subscription + first invoice.
  const { plan, redirect_url } = await searchParams;
  const selectedPlan = plan && SELF_SERVE_PLANS.includes(plan) ? plan : null;

  // A safe internal redirect target (e.g. an admin invite links to /admin) takes
  // precedence over onboarding — must be a same-site relative path, never an
  // absolute/external URL (open-redirect guard).
  const safeRedirect =
    redirect_url && redirect_url.startsWith('/') && !redirect_url.startsWith('//') ? redirect_url : null;

  const onboardingUrl =
    safeRedirect ??
    (selectedPlan ? `/onboarding?plan=${encodeURIComponent(selectedPlan)}` : '/onboarding');

  return (
    <div className="flex min-h-screen w-full flex-col md:flex-row bg-background relative overflow-hidden">
      {/* Left Half (Primary Green on Medium/Large Screens, Hidden on Small) */}
      <div className="hidden md:flex md:w-1/2 bg-primary relative flex-col p-8 lg:p-12 z-10">
        <div className="flex-none">
          <Link href="/">
            <Logo inverted />
          </Link>
        </div>

        {/* Centered Image */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="relative w-full max-w-md aspect-square drop-shadow-2xl">
            <Image
              src="/mobile-payment.png"
              alt="Mobile Payment Illustration"
              fill
              sizes="(max-width: 768px) 0vw, 50vw"
              quality={90}
              className="object-contain"
              priority
            />
          </div>
        </div>

        <div className="flex-none text-primary-foreground space-y-4 max-w-lg">
          <h1 className="text-4xl lg:text-5xl font-bold tracking-tight">Create your account</h1>
          <p className="text-lg opacity-80">The complete payment platform to seamlessly collect, manage, and scale your revenue.</p>
        </div>
      </div>

      {/* Right Half / Full Screen on Small */}
      <div className="flex flex-1 w-full md:w-1/2 items-center justify-center relative p-4 z-10 bg-background">
        {/* Particles background */}
        <div className="absolute inset-0 z-0 bg-background">
           <ParticlesBackground />
           <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:32px_32px] dark:opacity-10 opacity-0 pointer-events-none z-0" />
        </div>
        
        {/* Floating Theme Toggle on top right */}
        <div className="absolute top-4 right-4 z-20">
          <ThemeToggle />
        </div>

        {/* The Form */}
        <div className="relative z-10 w-full max-w-md">
          {/* Show logo on small screens since left side is hidden */}
          <div className="flex md:hidden justify-center mb-8">
             <Logo />
          </div>
          <ThemedSignUp fallbackRedirectUrl={onboardingUrl} />
        </div>
      </div>
    </div>
  );
}
