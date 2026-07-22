import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { verifyShopifyCredentials } from '@/lib/shopify';
import { decryptSecret } from '@/lib/crypto';
import { logger } from '@/lib/logger';

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

    if (!merchant.shopifyShopDomain || !merchant.shopifyAdminAccessToken) {
      return NextResponse.json({ success: false, error: 'Missing Shopify configuration' }, { status: 400 });
    }

    const result = await verifyShopifyCredentials(merchant.shopifyShopDomain, decryptSecret(merchant.shopifyAdminAccessToken)!);
    
    return NextResponse.json({ success: true, data: result }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Shopify Test Connection Error]:', message);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
