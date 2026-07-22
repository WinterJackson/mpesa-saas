import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma, TransactionClient } from '@/lib/db';
import { generateApiKey } from '@/lib/api-keys';
import { getOrganizationContext } from '@/lib/repositories/organizations';
import { revokeActiveApiKeys, createApiKey } from '@/lib/repositories/api-keys';
import { logger } from '@/lib/logger';

export async function POST() {
  try {
    const { userId, orgId } = await auth();

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const context = await getOrganizationContext(userId, orgId);

    if (!context || !context.merchant) {
      return NextResponse.json({ success: false, error: 'Merchant not found' }, { status: 404 });
    }

    const { organization, merchant } = context;
    const newApiKey = generateApiKey();

    const result = await prisma.$transaction(async (tx: TransactionClient) => {
      // Invalidate existing active keys
      await revokeActiveApiKeys(tx, organization.id);

      // Create new key
      const keyRecord = await createApiKey(tx, {
        organizationId: organization.id,
        merchantId: merchant.id,
        key: newApiKey,
      });

      return { keyRecord, rawKey: newApiKey.raw };
    });

    return NextResponse.json({ 
      success: true, 
      data: { key: result.rawKey } 
    }, { status: 200 });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[API Key Regeneration Error]:', message);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
