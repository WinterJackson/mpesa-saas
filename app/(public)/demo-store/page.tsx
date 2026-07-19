import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import DemoStoreClient from './demo-store-client';

export const metadata = {
  title: 'Demo Store | PaySwift',
  description: 'Experience a live M-Pesa checkout flow powered by PaySwift.',
};

export default async function DemoStorePage() {
  const { userId } = await auth();
  let businessName: string | null = null;
  let isSignedIn = false;

  if (userId) {
    isSignedIn = true;
    const merchant = await prisma.merchant.findUnique({
      where: { clerkUserId: userId },
      select: { businessName: true }
    });
    if (merchant && merchant.businessName) {
      businessName = merchant.businessName;
    }
  }

  return <DemoStoreClient isSignedIn={isSignedIn} businessName={businessName} />;
}
