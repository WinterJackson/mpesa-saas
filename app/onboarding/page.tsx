import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { OnboardingForm } from '@/components/onboarding-form';
import { CreditCard } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';

export const metadata = {
  title: 'Setup your Merchant Account | PaySwift',
  description: 'Complete your business registration to start accepting M-Pesa payments.',
};

export default async function OnboardingPage() {
  const { userId } = await auth();

  // 1. Must be logged in — redirect unauthenticated users
  if (!userId) {
    redirect('/sign-in');
  }

  // 2. Database source-of-truth check: if merchant exists, skip onboarding.
  // This handles edge cases where publicMetadata is out of sync (e.g. fresh login
  // before the session token refreshes with the new claim).
  const existingMerchant = await prisma.merchant.findUnique({
    where: { clerkUserId: userId },
    select: { id: true },
  });

  if (existingMerchant) {
    redirect('/dashboard');
  }

  // 3. Render the client-side onboarding form
  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center p-4 bg-background">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary text-primary-foreground mb-4">
            <CreditCard className="w-6 h-6" />
          </div>
        </div>

        <OnboardingForm />

        <p className="text-center text-sm text-muted-foreground mt-8">
          By completing this setup, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
