import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';

export async function PATCH(request: Request) {
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

    const body = await request.json();

    const updateData: any = {};

    if (body.environment !== undefined) {
      if (body.environment !== 'sandbox' && body.environment !== 'live') {
        return NextResponse.json({ success: false, error: 'Invalid environment value' }, { status: 400 });
      }
      updateData.environment = body.environment;
    }

    if (body.webhookUrl !== undefined) {
      if (body.webhookUrl !== null) {
        try {
          const parsed = new URL(body.webhookUrl);
          if (parsed.protocol !== 'https:') {
            return NextResponse.json({ success: false, error: 'Webhook URL must use HTTPS protocol' }, { status: 400 });
          }
        } catch {
          return NextResponse.json({ success: false, error: 'Invalid Webhook URL format' }, { status: 400 });
        }
      }
      updateData.webhookUrl = body.webhookUrl;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
    }

    const updatedMerchant = await prisma.merchant.update({
      where: { id: merchant.id },
      data: updateData,
    });

    return NextResponse.json({ 
      success: true, 
      data: {
        environment: updatedMerchant.environment,
        webhookUrl: updatedMerchant.webhookUrl
      }
    }, { status: 200 });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Settings Update Error]:', message);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
