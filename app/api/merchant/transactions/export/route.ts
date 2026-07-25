import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getOrganizationContext } from '@/lib/repositories/organizations';
import { listTransactionsForExport } from '@/lib/repositories/transactions';
import { logger } from '@/lib/logger';

/**
 * GET /api/merchant/transactions/export?environment=&status=
 *
 * Streams the org's transactions as a CSV download (their OWN data — no role gate
 * beyond org membership, mirroring who can view the transactions table). Honours
 * the optional environment (sandbox/live view) and status filters.
 */
const HEADERS = ['Date', 'Status', 'Amount (KES)', 'Phone', 'Reference', 'M-Pesa Receipt', 'Source', 'Environment'];

/** RFC-4180 CSV field escaping: wrap in quotes and double any embedded quotes. */
function csvField(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(request: Request) {
  try {
    const { userId, orgId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const context = await getOrganizationContext(userId, orgId);
    if (!context) {
      return NextResponse.json({ success: false, error: 'Organization not found' }, { status: 404 });
    }

    const url = new URL(request.url);
    const envParam = url.searchParams.get('environment');
    const statusParam = url.searchParams.get('status');
    const environment = envParam === 'sandbox' || envParam === 'live' ? envParam : undefined;
    const status = statusParam && ['completed', 'pending', 'failed', 'cancelled'].includes(statusParam) ? statusParam : undefined;

    const rows = await listTransactionsForExport(context.organization.id, { environment, status });

    const lines = [HEADERS.join(',')];
    for (const r of rows) {
      lines.push(
        [
          csvField(r.createdAt.toISOString()),
          csvField(r.status),
          csvField(r.amount),
          csvField(r.phone),
          csvField(r.orderReference),
          csvField(r.mpesaReceipt),
          csvField(r.source),
          csvField(r.environment),
        ].join(',')
      );
    }
    // Prepend a UTF-8 BOM so Excel opens the file with correct encoding.
    const csv = '﻿' + lines.join('\r\n') + '\r\n';

    const filename = `payswift-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: unknown) {
    logger.error('[Transactions Export Error]:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
