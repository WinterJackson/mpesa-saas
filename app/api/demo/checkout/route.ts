import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { createAndInitiatePayment } from '@/lib/payments';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phone, amount, orderReference } = body;

    // Determine which merchant to use for this checkout
    let merchantToUse = null;

    const { userId } = await auth();
    if (userId) {
      merchantToUse = await prisma.merchant.findUnique({
        where: { clerkUserId: userId },
      });
    }

    if (!merchantToUse) {
      merchantToUse = await prisma.merchant.findUnique({
        where: { clerkUserId: 'demo_user_123' }
      });
    }

    if (!merchantToUse) {
      return NextResponse.json(
        { success: false, error: 'Demo merchant not found. Please visit /api/demo/seed first.' },
        { status: 500 }
      );
    }

    if (!merchantToUse.organizationId) {
      return NextResponse.json(
        { success: false, error: 'Account setup incomplete' },
        { status: 500 }
      );
    }

    const result = await createAndInitiatePayment({
      merchant: merchantToUse,
      organizationId: merchantToUse.organizationId,
      phone,
      amount,
      orderReference,
      source: 'demo_store',
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to initiate demo payment' },
        { status: 400 }
      );
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
