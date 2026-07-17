import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';

/**
 * POST /api/merchant/setup
 *
 * Called during onboarding to provision a merchant record + initial API key.
 * Auth: Clerk session (userId)
 * Idempotent: If the merchant already exists, returns existing data.
 */
export async function POST(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    const businessName = body.businessName;

    if (!businessName || typeof businessName !== 'string' || businessName.trim().length < 2) {
      return NextResponse.json(
        { success: false, error: 'Business name is required and must be at least 2 characters long' },
        { status: 400 }
      );
    }

    // Idempotency: Check if merchant already exists for this Clerk user
    const existingMerchant = await prisma.merchant.findUnique({
      where: { clerkUserId: userId },
      include: { apiKeys: { where: { revoked: false } } },
    });

    if (existingMerchant) {
      return NextResponse.json(
        { success: true, data: existingMerchant },
        { status: 200 }
      );
    }

    // Create Merchant and initial API key atomically
    const newMerchant = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const merchant = await tx.merchant.create({
        data: {
          clerkUserId: userId,
          businessName: businessName.trim(),
          environment: 'sandbox',
        },
      });

      const apiKey = await tx.apiKey.create({
        data: {
          merchantId: merchant.id,
        },
      });

      return {
        ...merchant,
        apiKeys: [apiKey],
      };
    });

    // Update Clerk metadata so edge middleware knows user is onboarded
    const client = await clerkClient();
    await client.users.updateUserMetadata(userId, {
      publicMetadata: { onboarded: true },
    });

    return NextResponse.json(
      { success: true, data: newMerchant },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Merchant Setup Error]:', message);
    return NextResponse.json(
      { success: false, error: 'Internal server error during merchant setup' },
      { status: 500 }
    );
  }
}
