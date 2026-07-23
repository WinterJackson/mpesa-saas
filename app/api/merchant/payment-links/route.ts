import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getOrganizationContext } from '@/lib/repositories/organizations';
import { createPaymentLink, listPaymentLinks } from '@/lib/repositories/payment-links';
import { requireRole } from '@/lib/rbac';
import { validateAmount } from '@/lib/validation';
import { writeAuditLog } from '@/lib/repositories/audit-log';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    const { userId, orgId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const context = await getOrganizationContext(userId, orgId);
    if (!context || !context.merchant) {
      return NextResponse.json({ success: false, error: 'Merchant not found' }, { status: 404 });
    }

    const links = await listPaymentLinks(context.organization.id);
    return NextResponse.json({ success: true, data: links }, { status: 200 });
  } catch (error: unknown) {
    logger.error('[Payment Links List Error]:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

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

    // Owner/Admin/Developer may manage payment links; Finance is read-only.
    const rbac = await requireRole(organization.id, userId, ['owner', 'admin', 'developer']);
    if (!rbac.allowed) {
      return NextResponse.json({ success: false, error: rbac.error }, { status: rbac.status });
    }

    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title) {
      return NextResponse.json({ success: false, error: 'Title is required' }, { status: 400 });
    }

    const amountType = body.amountType === 'customer_set' ? 'customer_set' : 'fixed';

    let amount: number | null = null;
    if (amountType === 'fixed') {
      const amountCheck = validateAmount(body.amount);
      if (!amountCheck.valid) {
        return NextResponse.json({ success: false, error: amountCheck.error }, { status: 400 });
      }
      amount = amountCheck.sanitized!;
    }

    const description =
      typeof body.description === 'string' && body.description.trim()
        ? body.description.trim()
        : null;

    let expiresAt: Date | null = null;
    if (body.expiresAt) {
      const parsed = new Date(body.expiresAt as string);
      if (isNaN(parsed.getTime())) {
        return NextResponse.json({ success: false, error: 'Invalid expiry date' }, { status: 400 });
      }
      if (parsed.getTime() <= Date.now()) {
        return NextResponse.json({ success: false, error: 'Expiry date must be in the future' }, { status: 400 });
      }
      expiresAt = parsed;
    }

    // The link inherits the merchant's current operational environment. A 'live'
    // environment is only ever reached via the admin-gated go-live flow
    // (approveGoLive sets both org.liveApprovedAt and merchant.environment), so a
    // live link is inherently gated behind admin approval — no self-flip here.
    const link = await createPaymentLink({
      organizationId: organization.id,
      merchantId: merchant.id,
      title,
      description,
      amountType,
      amount,
      environment: merchant.environment,
      expiresAt,
    });

    await writeAuditLog({
      organizationId: organization.id,
      actorId: userId,
      action: 'payment_link.created',
      metadata: { paymentLinkId: link.id, amountType, amount },
    });

    return NextResponse.json({ success: true, data: link }, { status: 201 });
  } catch (error: unknown) {
    logger.error('[Payment Link Create Error]:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
