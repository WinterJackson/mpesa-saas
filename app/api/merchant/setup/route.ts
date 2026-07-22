import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { prisma, TransactionClient } from '@/lib/db';
import crypto from 'node:crypto';
import { generateApiKey } from '@/lib/api-keys';
import { encryptSecret } from '@/lib/crypto';
import { logger } from '@/lib/logger';

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
    const newMerchant = await prisma.$transaction(async (tx: TransactionClient) => {
      const rawWebhookSecret = `whsec_${crypto.randomBytes(24).toString('hex')}`;
      const merchant = await tx.merchant.create({
        data: {
          clerkUserId: userId,
          businessName: businessName.trim(),
          environment: 'sandbox',
          webhookSecret: encryptSecret(rawWebhookSecret),
        },
      });

      const newKey = generateApiKey();
      const apiKey = await tx.apiKey.create({
        data: {
          merchantId: merchant.id,
          keyHash: newKey.keyHash,
          keyPrefix: newKey.keyPrefix,
        },
      });

      return {
        ...merchant,
        webhookSecret: rawWebhookSecret,
        apiKeyRaw: newKey.raw,
        apiKeys: [apiKey],
      };
    });

    // Update Clerk metadata so edge middleware knows user is onboarded
    const client = await clerkClient();
    await client.users.updateUserMetadata(userId, {
      publicMetadata: { onboarded: true },
    });

    const response = NextResponse.json(
      { success: true, data: newMerchant },
      { status: 201 }
    );
    response.cookies.set('payswift_just_onboarded', '1', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60,
      path: '/',
    });
    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Merchant Setup Error]:', message);
    return NextResponse.json(
      { success: false, error: 'Internal server error during merchant setup' },
      { status: 500 }
    );
  }
}
