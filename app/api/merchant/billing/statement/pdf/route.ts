import { auth } from '@clerk/nextjs/server';
import { getOrganizationContext } from '@/lib/repositories/organizations';
import { prisma } from '@/lib/db';
import { buildStatementPdf } from '@/lib/billing/statement-pdf';
import { logger } from '@/lib/logger';
import { requireRole, BILLING_ROLES } from '@/lib/rbac';

/**
 * GET /api/merchant/billing/statement/pdf
 *
 * Streams an annual billing statement for the merchant's organization.
 */
export async function GET(request: Request) {
  try {
    const { userId, orgId } = await auth();
    if (!userId) return new Response('Unauthorized', { status: 401 });

    const context = await getOrganizationContext(userId, orgId);
    if (!context) return new Response('Organization not found', { status: 404 });

    const rbac = await requireRole(context.organization.id, userId, BILLING_ROLES);
    if (!rbac.allowed) {
      return new Response(rbac.error, { status: 403 });
    }

    const url = new URL(request.url);
    const yearParam = url.searchParams.get('year');
    const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year + 1, 0, 1);

    // Fetch all invoices issued in the requested year for this organization's subscription
    const invoices = await prisma.invoice.findMany({
      where: {
        subscription: {
          organizationId: context.organization.id,
        },
        issuedAt: {
          gte: startOfYear,
          lt: endOfYear,
        },
      },
      orderBy: {
        issuedAt: 'asc',
      },
    });

    const pdf = await buildStatementPdf({
      year,
      generatedAt: new Date(),
      buyerName: context.organization.businessName,
      buyerKraPin: context.organization.kraPin,
      invoices: invoices.map(inv => ({
        invoiceNumber: `PSW-${inv.issuedAt.getFullYear()}-${inv.id.slice(-6).toUpperCase()}`,
        issuedAt: inv.issuedAt,
        amount: inv.amount,
        status: inv.status,
      })),
    });

    return new Response(pdf as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="PaySwift-Statement-${year}.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error: unknown) {
    logger.error('[Statement PDF Error]:', error instanceof Error ? error.message : 'unknown');
    return new Response('Could not generate statement', { status: 500 });
  }
}
