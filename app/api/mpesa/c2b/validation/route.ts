import { NextResponse } from 'next/server';
import { findOrgContextByShortcode } from '@/lib/repositories/daraja-credentials';
import type { DarajaC2BPayload } from '@/lib/types';
import { logger } from '@/lib/logger';

/**
 * Safaricom C2B Validation — fired BEFORE completing a payment, but only if the
 * shortcode has External Validation enabled (a production feature Safaricom must
 * turn on). We accept any payment to a shortcode we recognize, and reject
 * (C2B00012 "Invalid Account Number") for a shortcode no org owns. A missing/
 * malformed payload also accepts, to avoid blocking legitimate payments.
 *
 * Daraja accept:  { ResultCode: 0,         ResultDesc: 'Accepted' }
 * Daraja reject:  { ResultCode: 'C2B00012', ResultDesc: '...' }
 */
export async function POST(request: Request) {
  const accept = () => NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' }, { status: 200 });
  const reject = (desc: string) => NextResponse.json({ ResultCode: 'C2B00012', ResultDesc: desc }, { status: 200 });

  try {
    let body: DarajaC2BPayload;
    try {
      body = await request.json();
    } catch {
      return accept();
    }

    if (!body?.BusinessShortCode) return accept();

    const context = await findOrgContextByShortcode(String(body.BusinessShortCode));
    if (!context) {
      logger.warn(`[C2B Validation] Rejecting payment to unrecognized shortcode ${body.BusinessShortCode}`);
      return reject('Unknown shortcode');
    }
    return accept();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[C2B Validation Processing Error]:', message);
    // On our own error, accept rather than block a real customer payment.
    return accept();
  }
}
