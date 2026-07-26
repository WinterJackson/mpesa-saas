import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getOrganizationContext } from '@/lib/repositories/organizations';
import {
  deactivatePaymentLink,
  getPaymentLinkDetail,
  updatePaymentLink,
  type PaymentLinkEditableFields,
} from '@/lib/repositories/payment-links';
import { requireRole } from '@/lib/rbac';
import { validateAmount } from '@/lib/validation';
import { writeAuditLog } from '@/lib/repositories/audit-log';
import { logger } from '@/lib/logger';

const MANAGE_ROLES = ['owner', 'admin', 'developer'] as const;

// Full per-link detail for the inspector drawer (any member may read).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId, orgId } = await auth();
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const context = await getOrganizationContext(userId, orgId);
  if (!context) return NextResponse.json({ success: false, error: 'Merchant not found' }, { status: 404 });

  const detail = await getPaymentLinkDetail(context.organization.id, id);
  if (!detail) return NextResponse.json({ success: false, error: 'Payment link not found' }, { status: 404 });

  return NextResponse.json({ success: true, data: detail }, { status: 200 });
}

// Edit a payment link (owner/admin/developer). Only provided fields change.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { userId, orgId } = await auth();
    if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const context = await getOrganizationContext(userId, orgId);
    if (!context || !context.merchant) {
      return NextResponse.json({ success: false, error: 'Merchant not found' }, { status: 404 });
    }

    const rbac = await requireRole(context.organization.id, userId, [...MANAGE_ROLES]);
    if (!rbac.allowed) return NextResponse.json({ success: false, error: rbac.error }, { status: rbac.status });

    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    const fields: PaymentLinkEditableFields = {};

    if (typeof body.title === 'string') {
      const title = body.title.trim();
      if (!title) return NextResponse.json({ success: false, error: 'Title cannot be empty' }, { status: 400 });
      fields.title = title;
    }
    if ('description' in body) {
      fields.description = typeof body.description === 'string' && body.description.trim() ? body.description.trim() : null;
    }
    if (body.amountType === 'fixed' || body.amountType === 'customer_set') {
      fields.amountType = body.amountType;
    }
    if (fields.amountType === 'fixed' || (fields.amountType === undefined && body.amount !== undefined)) {
      if (body.amount !== undefined && body.amount !== null && body.amount !== '') {
        const check = validateAmount(body.amount);
        if (!check.valid) return NextResponse.json({ success: false, error: check.error }, { status: 400 });
        fields.amount = check.sanitized!;
      }
    }
    if ('expiresAt' in body) {
      if (!body.expiresAt) {
        fields.expiresAt = null;
      } else {
        const parsed = new Date(body.expiresAt as string);
        if (isNaN(parsed.getTime())) return NextResponse.json({ success: false, error: 'Invalid expiry date' }, { status: 400 });
        fields.expiresAt = parsed;
      }
    }
    if ('redirectUrl' in body) {
      const raw = typeof body.redirectUrl === 'string' ? body.redirectUrl.trim() : '';
      if (!raw) {
        fields.redirectUrl = null;
      } else {
        try {
          const u = new URL(raw);
          if (u.protocol !== 'https:') throw new Error('not https');
          fields.redirectUrl = raw;
        } catch {
          return NextResponse.json({ success: false, error: 'Redirect URL must be a valid https:// link' }, { status: 400 });
        }
      }
    }
    if ('successMessage' in body) {
      fields.successMessage = typeof body.successMessage === 'string' && body.successMessage.trim() ? body.successMessage.trim().slice(0, 300) : null;
    }
    if ('collectContact' in body) fields.collectContact = Boolean(body.collectContact);
    if ('active' in body) fields.active = Boolean(body.active);

    const updated = await updatePaymentLink(context.organization.id, id, fields);
    if (!updated) return NextResponse.json({ success: false, error: 'Payment link not found' }, { status: 404 });

    await writeAuditLog({
      organizationId: context.organization.id,
      actorId: userId,
      action: 'payment_link.updated',
      metadata: { paymentLinkId: id, fields: Object.keys(fields) },
    });

    return NextResponse.json({ success: true, data: updated }, { status: 200 });
  } catch (error: unknown) {
    logger.error('[Payment Link Update Error]:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// Deactivate a payment link (soft — the record and its past payments are kept;
// the public /pay/[slug] page stops resolving it via findActiveLinkBySlug).
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { userId, orgId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const context = await getOrganizationContext(userId, orgId);
    if (!context || !context.merchant) {
      return NextResponse.json({ success: false, error: 'Merchant not found' }, { status: 404 });
    }

    const rbac = await requireRole(context.organization.id, userId, ['owner', 'admin', 'developer']);
    if (!rbac.allowed) {
      return NextResponse.json({ success: false, error: rbac.error }, { status: rbac.status });
    }

    const link = await deactivatePaymentLink(context.organization.id, id);
    if (!link) {
      return NextResponse.json({ success: false, error: 'Payment link not found' }, { status: 404 });
    }

    await writeAuditLog({
      organizationId: context.organization.id,
      actorId: userId,
      action: 'payment_link.deactivated',
      metadata: { paymentLinkId: id },
    });

    return NextResponse.json({ success: true, data: link }, { status: 200 });
  } catch (error: unknown) {
    logger.error('[Payment Link Deactivate Error]:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
