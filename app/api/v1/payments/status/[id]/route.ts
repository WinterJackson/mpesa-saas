import { NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticateApiKey(request);
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.status }
      );
    }

    const { merchant } = authResult;
    const { id } = await params;

    const transaction = await prisma.transaction.findUnique({ where: { id } });

    if (!transaction) {
      return NextResponse.json(
        { success: false, error: 'Transaction not found' },
        { status: 404 }
      );
    }

    if (transaction.merchantId !== merchant.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized access to transaction' },
        { status: 403 }
      );
    }

    // Status is read directly from the database. The webhook callback
    // (app/api/mpesa/callback/route.ts) is the SOLE writer of terminal
    // status — do not add a Query-API self-healing path here. Safaricom's
    // sandbox Query endpoint is independently documented as unreliable,
    // capable of returning a false "failed" result for pending or even
    // genuinely successful transactions. Trusting it here would reintroduce
    // exactly the false-failure bug this route was fixed to remove.
    return NextResponse.json(
      {
        success: true,
        data: {
          id: transaction.id,
          amount: transaction.amount,
          phone: transaction.phone,
          status: transaction.status,
          orderReference: transaction.orderReference,
          mpesaReceipt: transaction.mpesaReceipt,
          resultCode: transaction.resultCode,
          resultDesc: transaction.resultDesc,
          createdAt: transaction.createdAt,
          updatedAt: transaction.updatedAt,
        },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Payment Status Error]:', message);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
