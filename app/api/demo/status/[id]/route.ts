import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const demoApiKey = process.env.DEMO_API_KEY;

    if (!demoApiKey) {
      return NextResponse.json(
        { success: false, error: 'DEMO_API_KEY is not configured.' },
        { status: 500 }
      );
    }

    // Determine which merchant is allowed to see this transaction — mirrors
    // the same resolution order used in app/api/demo/checkout/route.ts:
    // the signed-in merchant if authenticated, otherwise the shared demo
    // merchant used for anonymous visitors.
    let merchantToUse = null;

    const { userId } = await auth();
    if (userId) {
      merchantToUse = await prisma.merchant.findUnique({
        where: { clerkUserId: userId },
      });
    }

    if (!merchantToUse) {
      merchantToUse = await prisma.merchant.findUnique({
        where: { clerkUserId: 'demo_user_123' },
      });
    }

    if (!merchantToUse) {
      return NextResponse.json(
        { success: false, error: 'Transaction not found' },
        { status: 404 }
      );
    }

    const tx = await prisma.transaction.findUnique({
      where: { id },
      select: {
        id: true,
        merchantId: true,
        checkoutRequestId: true,
        status: true,
        resultDesc: true,
      },
    });

    // Return 404 (not 403) both when the transaction doesn't exist AND when
    // it exists but belongs to a different merchant — this avoids confirming
    // to an unauthenticated caller that a given transaction ID is valid.
    if (!tx || tx.merchantId !== merchantToUse.id) {
      return NextResponse.json(
        { success: false, error: 'Transaction not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        transactionId: tx.id,
        checkoutRequestId: tx.checkoutRequestId,
        status: tx.status,
        merchantRequestID: tx.id, // mapped to id for consistency if merchantRequestID isn't separate
        customerMessage: tx.resultDesc || null,
      }
    }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
