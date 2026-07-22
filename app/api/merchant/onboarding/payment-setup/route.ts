import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getOrganizationContext } from '@/lib/repositories/organizations';
import { setSandboxCredential, setLiveCredential, type DarajaCredentialSet } from '@/lib/repositories/daraja-credentials';
import { getAccessToken } from '@/lib/daraja';
import { writeAuditLog } from '@/lib/repositories/audit-log';
import { logger } from '@/lib/logger';

/**
 * POST /api/merchant/onboarding/payment-setup
 *
 * Lets an organization optionally override its pooled sandbox credentials or
 * supply its own live Daraja credentials (Model B — live is always the
 * organization's own, never pooled). Per master plan Section 16.4, the
 * credential is validated with a real getAccessToken call immediately, so a
 * typo is caught here rather than on the org's first real transaction.
 */
export async function POST(request: Request) {
  try {
    const { userId, orgId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const context = await getOrganizationContext(userId, orgId);
    if (!context) {
      return NextResponse.json({ success: false, error: 'Organization not found' }, { status: 404 });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON payload' }, { status: 400 });
    }

    const { mode, consumerKey, consumerSecret, shortcode, passkey, callbackUrl } = body;

    if (mode !== 'sandbox' && mode !== 'live') {
      return NextResponse.json({ success: false, error: 'mode must be "sandbox" or "live"' }, { status: 400 });
    }

    for (const [field, value] of Object.entries({ consumerKey, consumerSecret, shortcode, passkey, callbackUrl })) {
      if (typeof value !== 'string' || value.trim().length === 0) {
        return NextResponse.json({ success: false, error: `${field} is required` }, { status: 400 });
      }
    }

    try {
      new URL(callbackUrl as string);
    } catch {
      return NextResponse.json({ success: false, error: 'callbackUrl must be a valid URL' }, { status: 400 });
    }

    const credentials: DarajaCredentialSet = {
      consumerKey: consumerKey as string,
      consumerSecret: consumerSecret as string,
      shortcode: shortcode as string,
      passkey: passkey as string,
      callbackUrl: callbackUrl as string,
    };

    if (mode === 'live') {
      await setLiveCredential(context.organization.id, credentials);
    } else {
      await setSandboxCredential(context.organization.id, credentials);
    }

    await writeAuditLog({
      organizationId: context.organization.id,
      actorId: userId,
      action: mode === 'live' ? 'daraja_credential.live_set' : 'daraja_credential.sandbox_set',
      metadata: { shortcode: credentials.shortcode },
    });

    // Validate immediately against Safaricom rather than waiting for the
    // organization's first real transaction to surface a typo.
    try {
      await getAccessToken(context.organization.id, mode);
    } catch (validationError: unknown) {
      const message = validationError instanceof Error ? validationError.message : 'Validation failed';
      return NextResponse.json(
        { success: false, error: `Credentials saved but could not be validated with Safaricom: ${message}` },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true, data: { mode, validated: true } }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Payment Setup Error]:', message);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
