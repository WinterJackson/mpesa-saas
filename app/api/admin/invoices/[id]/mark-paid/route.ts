import { NextResponse, after } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { requireAdminCapability } from '@/lib/admin-auth';
import { markInvoicePaid } from '@/lib/repositories/billing';
import { notifyInvoicePaid } from '@/lib/email/notifications';
import { writeAuditLog } from '@/lib/repositories/audit-log';
import { logger } from '@/lib/logger';

/**
 * POST /api/admin/invoices/[id]/mark-paid
 *
 * Manual collection fallback: this phase does not integrate a live payment
 * provider (Flutterwave/Paystack), so an admin marks an Invoice paid after
 * confirming payment out-of-band (e.g. a Paybill deposit). Automated
 * collection is explicitly deferred, per this phase's scope decision.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const adminAuth = await requireAdminCapability(userId, 'billing:write');
    if (!adminAuth.allowed) {
      return NextResponse.json({ success: false, error: adminAuth.error }, { status: adminAuth.status });
    }

    const { id } = await params;
    const invoice = await markInvoicePaid(id);

    await writeAuditLog({
      actorId: userId,
      action: 'invoice.marked_paid',
      metadata: { invoiceId: id, amount: invoice.amount },
    });

    const organizationId = invoice.subscription?.organizationId;
    if (organizationId) {
      after(() => notifyInvoicePaid(organizationId, invoice.amount));
    }

    return NextResponse.json({ success: true, data: invoice }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Admin Mark Invoice Paid Error]:', message);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
