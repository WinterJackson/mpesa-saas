import { NextResponse } from 'next/server';
import { findActiveLinkBySlug } from '@/lib/repositories/payment-links';
import { createAndInitiatePayment } from '@/lib/payments';
import { parseWith, payLinkInitiateRequestSchema } from '@/lib/schemas';
import { validateAmount } from '@/lib/validation';
import { logger } from '@/lib/logger';

/**
 * Public, unauthenticated payment initiation for a hosted Payment Link.
 * No API key — the slug is the capability, and the route is IP-rate-limited in
 * proxy.ts (the callback limiter). Fixed-amount links ignore any client-supplied
 * amount; customer_set links require a valid one.
 */
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;

    const link = await findActiveLinkBySlug(slug);
    if (!link) {
      return NextResponse.json({ success: false, error: 'Payment link not found or inactive' }, { status: 404 });
    }

    // A live link must not transact until the org is admin-approved for go-live.
    if (link.environment === 'live' && !link.liveApprovedAt) {
      return NextResponse.json(
        { success: false, error: 'This payment link is not yet active for live payments' },
        { status: 403 }
      );
    }

    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = parseWith(payLinkInitiateRequestSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });
    }

    // Fixed links use their stored amount and ignore the client entirely.
    let amount: number;
    if (link.amountType === 'fixed') {
      if (link.amount == null) {
        return NextResponse.json({ success: false, error: 'Payment link is misconfigured' }, { status: 500 });
      }
      amount = link.amount;
    } else {
      const amountCheck = validateAmount(parsed.data.amount);
      if (!amountCheck.valid) {
        return NextResponse.json({ success: false, error: amountCheck.error }, { status: 400 });
      }
      amount = amountCheck.sanitized!;
    }

    const result = await createAndInitiatePayment({
      merchant: link.merchant,
      organizationId: link.organizationId,
      phone: parsed.data.phone,
      amount,
      orderReference: link.title.substring(0, 32),
      source: 'payment_link',
      paymentLinkId: link.id,
    });

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          transactionId: result.transaction.id,
          checkoutRequestId: result.checkoutRequestId,
          status: result.transaction.status,
          customerMessage: result.customerMessage,
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    logger.error('[Payment Link Initiate Error]:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
