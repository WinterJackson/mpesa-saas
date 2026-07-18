import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '10', 10);

    const merchant = await prisma.merchant.findUnique({
      where: { clerkUserId: userId },
    });

    if (!merchant) {
      return NextResponse.json({ success: false, error: 'Merchant not found' }, { status: 404 });
    }

    const deliveries = await prisma.webhookDelivery.findMany({
      where: {
        transaction: {
          merchantId: merchant.id
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        transaction: {
          select: { orderReference: true }
        }
      }
    });

    return NextResponse.json({ success: true, data: deliveries }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Get Webhook Deliveries Error]:', message);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
