import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { resolveUserLanding } from '@/lib/auth-routing';
import { OnboardingWizard } from '@/components/onboarding/onboarding-wizard';
import { CreditCard } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';

export const metadata = {
  title: 'Setup your Merchant Account | PaySwift',
  description: 'Complete your business registration to start accepting M-Pesa payments.',
};

const SELF_SERVE_PLANS = ['Starter', 'Growth', 'Scale'];

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const { userId, orgId } = await auth();
  const { plan } = await searchParams;
  const selectedPlan = plan && SELF_SERVE_PLANS.includes(plan) ? plan : null;

  // 1. Must be logged in — redirect unauthenticated users
  if (!userId) {
    redirect('/sign-in');
  }

  const landing = await resolveUserLanding(userId, orgId);
  if (landing.destination === '/admin') {
    redirect('/admin');
  }
  if (landing.destination === '/dashboard') {
    redirect('/dashboard');
  }

  // 3. Render the client-side onboarding wizard
  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center p-4 bg-background">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary text-primary-foreground mb-4">
            <CreditCard className="w-6 h-6" />
          </div>
        </div>

        <OnboardingWizard selectedPlan={selectedPlan} />

        <p className="text-center text-sm text-muted-foreground mt-8">
          By completing this setup, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
