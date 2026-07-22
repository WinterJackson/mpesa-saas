import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma, TransactionClient } from '@/lib/db';
import { generateApiKey } from '@/lib/api-keys';
import { getOrganizationContext } from '@/lib/repositories/organizations';
import { revokeActiveApiKeys, createApiKey } from '@/lib/repositories/api-keys';
import { requireRole } from '@/lib/rbac';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
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

    // Owner/Admin/Developer may manage API keys; Finance is read-only.
    const rbac = await requireRole(organization.id, userId, ['owner', 'admin', 'developer']);
    if (!rbac.allowed) {
      return NextResponse.json({ success: false, error: rbac.error }, { status: rbac.status });
    }

    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch {
      // No body is fine — defaults to read_write below.
    }

    const requestedScope = body.scope === 'read_only' ? 'read_only' : 'read_write';

    if (requestedScope === 'read_write' && !['owner', 'admin'].includes(rbac.membership.role)) {
      return NextResponse.json(
        { success: false, error: 'Only owners and admins can create a read_write API key' },
        { status: 403 }
      );
    }

    const newApiKey = generateApiKey();

    const result = await prisma.$transaction(async (tx: TransactionClient) => {
      // Invalidate existing active keys
      await revokeActiveApiKeys(tx, organization.id);

      // Create new key
      const keyRecord = await createApiKey(tx, {
        organizationId: organization.id,
        merchantId: merchant.id,
        key: newApiKey,
        scope: requestedScope,
      });

      return { keyRecord, rawKey: newApiKey.raw };
    });

    return NextResponse.json({
      success: true,
      data: { key: result.rawKey, scope: requestedScope }
    }, { status: 200 });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[API Key Regeneration Error]:', message);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
