import { NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/auth';
import { registerC2BUrls } from '@/lib/daraja-c2b';
import { writeAuditLog } from '@/lib/repositories/audit-log';
import { logger } from '@/lib/logger';

/**
 * POST /api/v1/c2b/register-urls — registers PaySwift's C2B Confirmation/
 * Validation URLs against the caller's shortcode. read_write scope only.
 */
export async function POST(request: Request) {
  try {
    const authResult = await authenticateApiKey(request);
    if (!authResult.success) {
      return NextResponse.json({ success: false, error: authResult.error }, { status: authResult.status });
    }
    if (authResult.apiKey.scope === 'read_only') {
      return NextResponse.json({ success: false, error: 'This API key is read-only and cannot register C2B URLs' }, { status: 403 });
    }

    const environment = authResult.merchant.environment as 'sandbox' | 'live';

    try {
      const result = await registerC2BUrls({ organizationId: authResult.organizationId, environment });
      await writeAuditLog({
        organizationId: authResult.organizationId,
        actorId: `apikey:${authResult.apiKey.id}`,
        action: 'c2b.urls_registered',
        metadata: { environment },
      });
      return NextResponse.json({ success: true, data: { responseDescription: result.ResponseDescription } }, { status: 200 });
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : 'Registration failed';
      return NextResponse.json({ success: false, error }, { status: 502 });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[C2B Register URLs Error]:', message);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
