import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import crypto from 'crypto';
import { deliverWebhook } from '@/lib/webhook';

export async function POST() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const merchant = await prisma.merchant.findUnique({
      where: { clerkUserId: userId },
    });

    if (!merchant) {
      return NextResponse.json({ success: false, error: 'Merchant not found' }, { status: 404 });
    }

    if (!merchant.webhookUrl) {
      return NextResponse.json({ success: false, error: 'No webhook URL configured' }, { status: 400 });
    }

    // Fetch the most recent completed transaction for realism
    let transaction = await prisma.transaction.findFirst({
      where: { merchantId: merchant.id, status: 'completed' },
      orderBy: { createdAt: 'desc' },
    });

    // If no completed transaction exists, fetch any transaction
    if (!transaction) {
      transaction = await prisma.transaction.findFirst({
        where: { merchantId: merchant.id },
        orderBy: { createdAt: 'desc' },
      });
    }

    // If still no transaction exists (e.g. they haven't seeded), use mock data
    const payloadData = transaction ? {
      event: "payment.completed",
      data: {
        transactionId: transaction.id,
        amount: transaction.amount,
        phone: transaction.phone,
        status: transaction.status,
        orderReference: transaction.orderReference,
        mpesaReceipt: transaction.mpesaReceipt || "MOCK" + Math.floor(Math.random() * 1000000),
        timestamp: transaction.createdAt.toISOString()
      }
    } : {
      event: "payment.completed",
      data: {
        transactionId: "txn_" + crypto.randomBytes(12).toString('hex'),
        amount: 1000,
        phone: "254712345678",
        status: "completed",
        orderReference: "TEST-ORDER-001",
        mpesaReceipt: "OAB123CDEF",
        timestamp: new Date().toISOString()
      }
    };

    // Use deliverWebhook to ensure signatures and timeouts are consistent
    const result = await deliverWebhook(
      merchant.webhookUrl,
      payloadData,
      merchant.webhookSecret ?? undefined,
      {
        'x-payswift-event': 'payment.completed',
        'x-payswift-test': 'true'
      }
    );

    // Add audit log IF the transactionId doesn't start with "txn_" (which is our synthetic mock ID)
    if (!payloadData.data.transactionId.startsWith('txn_')) {
      await prisma.webhookDelivery.create({
        data: {
          transactionId: payloadData.data.transactionId,
          url: merchant.webhookUrl,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          payload: payloadData as any,
          statusCode: result.statusCode ?? null,
          success: result.delivered,
          attempt: result.attempts,
        }
      });
    }

    return NextResponse.json({ 
      success: true, 
      data: { 
        statusCode: result.statusCode,
        delivered: result.delivered
      } 
    }, { status: 200 });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Test Webhook Error]:', message);
    return NextResponse.json({ success: false, error: 'Failed to deliver webhook payload to destination.' }, { status: 500 });
  }
}
