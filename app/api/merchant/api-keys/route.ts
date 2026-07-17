import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma, TransactionClient } from '@/lib/db';
import crypto from 'crypto';

function generateApiKey() {
  return `pk_${crypto.randomBytes(24).toString('hex')}`;
}

export async function POST() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const merchant = await prisma.merchant.findUnique({
      where: { clerkUserId: userId },
    });

    if (!merchant) {
      return NextResponse.json({ success: false, error: 'Merchant not found' }, { status: 404 });
    }

    const newApiKey = generateApiKey();

    const result = await prisma.$transaction(async (tx: TransactionClient) => {
      // Invalidate existing active keys
      await tx.apiKey.updateMany({
        where: { merchantId: merchant.id, revoked: false },
        data: { revoked: true },
      });

      // Create new key
      const keyRecord = await tx.apiKey.create({
        data: {
          merchantId: merchant.id,
          key: newApiKey,
          revoked: false,
        },
      });

      return keyRecord;
    });

    return NextResponse.json({ 
      success: true, 
      data: { key: result.key } 
    }, { status: 200 });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API Key Regeneration Error]:', message);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
