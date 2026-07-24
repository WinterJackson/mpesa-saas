import { NextResponse, after } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import crypto from 'node:crypto';
import { encryptSecret } from '@/lib/crypto';
import { getOrganizationContext, updateMerchantForOrganization } from '@/lib/repositories/organizations';
import { notifyWebhookSecretRotated } from '@/lib/email/notifications';
import { writeAuditLog } from '@/lib/repositories/audit-log';
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

    const { organization } = context;
    const newSecret = `whsec_${crypto.randomBytes(24).toString('hex')}`;

    await updateMerchantForOrganization(organization.id, { webhookSecret: encryptSecret(newSecret) });

    await writeAuditLog({
      organizationId: organization.id,
      actorId: userId,
      action: 'webhook_secret.rotated',
    });

    after(() => notifyWebhookSecretRotated(organization.id));

    return NextResponse.json({
      success: true,
      data: { secret: newSecret }
    }, { status: 200 });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Regenerate Webhook Secret Error]:', message);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
