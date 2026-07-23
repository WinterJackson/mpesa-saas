import { NextResponse } from 'next/server';
import { findLinkTransactionStatus } from '@/lib/repositories/payment-links';
import { logger } from '@/lib/logger';

/**
 * Public status poller for a hosted Payment Link checkout. Scoped to the link's
 * slug + the transaction it created (see findLinkTransactionStatus). Returns 404
 * for any mismatch rather than confirming a transaction id exists.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; transactionId: string }> }
) {
  try {
    const { slug, transactionId } = await params;

    const status = await findLinkTransactionStatus(slug, transactionId);
    if (!status) {
      return NextResponse.json({ success: false, error: 'Transaction not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: status }, { status: 200 });
  } catch (error: unknown) {
    logger.error('[Payment Link Status Error]:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
