import { auth } from '@clerk/nextjs/server';
import { getOrganizationContext } from '@/lib/repositories/organizations';
import { getInvoiceForOrg } from '@/lib/repositories/billing';
import { buildInvoicePdf } from '@/lib/billing/invoice-pdf';
import { logger } from '@/lib/logger';

/**
 * GET /api/merchant/billing/invoices/[id]/pdf
 *
 * Streams the merchant's OWN invoice as a PDF. Ownership-scoped: the invoice must
 * belong to the caller's organization (getInvoiceForOrg filters by organizationId),
 * so one org can never fetch another's invoice by guessing an id. Any member of
 * the org may download their own invoices (it is their data, no secrets).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { userId, orgId } = await auth();
    if (!userId) return new Response('Unauthorized', { status: 401 });

    const context = await getOrganizationContext(userId, orgId);
    if (!context) return new Response('Organization not found', { status: 404 });

    const invoice = await getInvoiceForOrg(id, context.organization.id);
    if (!invoice) return new Response('Invoice not found', { status: 404 });

    const org = invoice.subscription.organization;
    const invoiceNumber = `PSW-${invoice.issuedAt.getFullYear()}-${invoice.id.slice(-6).toUpperCase()}`;

    const pdf = await buildInvoicePdf({
      invoiceNumber,
      issuedAt: invoice.issuedAt,
      status: invoice.status,
      paidAt: invoice.paidAt,
      mpesaReceipt: invoice.mpesaReceipt,
      amount: invoice.amount,
      planName: invoice.subscription.plan.name,
      buyerName: org.businessName,
      buyerKraPin: org.kraPin,
      // Interim invoices carry no eTIMS stamp; wired once VAT-registered (lib/billing/etims.ts).
      etims: null,
    });

    return new Response(pdf as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${invoiceNumber}.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error: unknown) {
    logger.error('[Invoice PDF Error]:', error instanceof Error ? error.message : 'unknown');
    return new Response('Could not generate invoice', { status: 500 });
  }
}
