import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';

export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const merchant = await prisma.merchant.findUnique({
      where: { clerkUserId: userId }
    });

    if (!merchant) {
      return NextResponse.json({ success: false, error: 'Merchant not found' }, { status: 404 });
    }

    const existingCount = await prisma.transaction.count({ 
      where: { merchantId: merchant.id } 
    });
    
    if (existingCount >= 5) {
      return NextResponse.json({ 
        success: false, 
        error: 'Demo data already seeded for this account.' 
      }, { status: 400 });
    }

    const seedData = [
      {
        merchantId: merchant.id,
        amount: 1500,
        phone: '254712345678',
        orderReference: 'ORD-77A9B1',
        status: 'completed',
        checkoutRequestId: 'ws_CO_160720261623456781',
        mpesaReceipt: 'QEG12A3B4C',
        resultCode: 0,
        resultDesc: 'The service request is processed successfully.',
        environment: merchant.environment,
        source: 'demo'
      },
      {
        merchantId: merchant.id,
        amount: 250,
        phone: '254798765432',
        orderReference: 'ORD-88B9C2',
        status: 'pending',
        checkoutRequestId: 'ws_CO_160720261625456782',
        mpesaReceipt: null,
        resultCode: null,
        resultDesc: null,
        environment: merchant.environment,
        source: 'demo'
      },
      {
        merchantId: merchant.id,
        amount: 8000,
        phone: '254700112233',
        orderReference: 'ORD-99C9D3',
        status: 'cancelled',
        checkoutRequestId: 'ws_CO_160720261627456783',
        mpesaReceipt: null,
        resultCode: 1032,
        resultDesc: 'Request cancelled by user',
        environment: merchant.environment,
        source: 'demo'
      },
      {
        merchantId: merchant.id,
        amount: 3200,
        phone: '254744556677',
        orderReference: 'ORD-11D9E4',
        status: 'completed',
        checkoutRequestId: 'ws_CO_160720261629456784',
        mpesaReceipt: 'QEG98Z7Y6X',
        resultCode: 0,
        resultDesc: 'The service request is processed successfully.',
        environment: merchant.environment,
        source: 'demo'
      },
      {
        merchantId: merchant.id,
        amount: 500,
        phone: '254799887766',
        orderReference: 'ORD-22E9F5',
        status: 'failed',
        checkoutRequestId: 'ws_CO_160720261631456785',
        mpesaReceipt: null,
        resultCode: 1,
        resultDesc: 'Insufficient funds',
        environment: merchant.environment,
        source: 'demo'
      }
    ];

    await prisma.transaction.createMany({
      data: seedData
    });

    return NextResponse.json(
      { success: true, message: 'Seeded 5 sample transactions.' },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Seed Demo Data Error]:', message);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
