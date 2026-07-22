import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const demoApiKey = process.env.DEMO_API_KEY;

    if (!demoApiKey) {
      return NextResponse.json(
        { success: false, error: 'DEMO_API_KEY is not configured.' },
        { status: 500 }
      );
    }

    // Direct database fetch to avoid hitting edge network limits from internal self-referencing
    const tx = await prisma.transaction.findUnique({
      where: { id },
      select: {
        id: true,
        checkoutRequestId: true,
        status: true,
        resultDesc: true,
      }
    });

    if (!tx) {
      return NextResponse.json(
        { success: false, error: 'Transaction not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        transactionId: tx.id,
        checkoutRequestId: tx.checkoutRequestId,
        status: tx.status,
        merchantRequestID: tx.id, // mapped to id for consistency if merchantRequestID isn't separate
        customerMessage: tx.resultDesc || null,
      }
    }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
