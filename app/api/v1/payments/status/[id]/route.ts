import { NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { querySTKPushStatus } from '@/lib/daraja';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Authenticate Request
    const authResult = await authenticateApiKey(request);
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.status }
      );
    }

    const { merchant } = authResult;
    const { id } = await params;

    // 2. Fetch Transaction
    const transaction = await prisma.transaction.findUnique({
      where: { id },
    });

    if (!transaction) {
      return NextResponse.json(
        { success: false, error: 'Transaction not found' },
        { status: 404 }
      );
    }

    // 3. Verify Ownership — prevents cross-tenant data leakage
    if (transaction.merchantId !== merchant.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized access to transaction' },
        { status: 403 }
      );
    }

    // 4. Self-Healing: Query Daraja if transaction is still pending
    // Daraja callbacks can fail due to network issues. If the transaction
    // is still pending and has a checkoutRequestId, we proactively query
    // Daraja to resolve the true status.
    let resolvedStatus = transaction.status;
    let resolvedResultCode = transaction.resultCode;
    let resolvedResultDesc = transaction.resultDesc;
    let resolvedMpesaReceipt = transaction.mpesaReceipt;

    if (transaction.status === 'pending' && transaction.checkoutRequestId) {
      try {
        const queryResult = await querySTKPushStatus(transaction.checkoutRequestId);

        if (queryResult.ResultCode === '0') {
          // Transaction completed successfully — self-heal the DB
          const updated = await prisma.transaction.update({
            where: { id: transaction.id },
            data: {
              status: 'completed',
              resultCode: 0,
              resultDesc: queryResult.ResultDesc,
            },
          });
          resolvedStatus = updated.status;
          resolvedResultCode = updated.resultCode;
          resolvedResultDesc = updated.resultDesc;
          resolvedMpesaReceipt = updated.mpesaReceipt;
        } else if (queryResult.ResultCode === '1032') {
          // Cancelled by user
          const updated = await prisma.transaction.update({
            where: { id: transaction.id },
            data: {
              status: 'cancelled',
              resultCode: 1032,
              resultDesc: queryResult.ResultDesc,
            },
          });
          resolvedStatus = updated.status;
          resolvedResultCode = updated.resultCode;
          resolvedResultDesc = updated.resultDesc;
        } else if (queryResult.ResultCode && queryResult.ResultCode !== '0') {
          // Any other non-zero ResultCode means failure
          const updated = await prisma.transaction.update({
            where: { id: transaction.id },
            data: {
              status: 'failed',
              resultCode: parseInt(queryResult.ResultCode, 10) || null,
              resultDesc: queryResult.ResultDesc,
            },
          });
          resolvedStatus = updated.status;
          resolvedResultCode = updated.resultCode;
          resolvedResultDesc = updated.resultDesc;
        }
      } catch (queryError: unknown) {
        // Daraja query failed — log and return current DB state
        const msg = queryError instanceof Error ? queryError.message : 'Unknown error';
        console.warn(`[Payment Status] Daraja query failed for ${transaction.id}: ${msg}`);
      }
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          id: transaction.id,
          amount: transaction.amount,
          phone: transaction.phone,
          status: resolvedStatus,
          orderReference: transaction.orderReference,
          mpesaReceipt: resolvedMpesaReceipt,
          resultCode: resolvedResultCode,
          resultDesc: resolvedResultDesc,
          createdAt: transaction.createdAt,
          updatedAt: transaction.updatedAt,
        },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Payment Status Error]:', message);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
