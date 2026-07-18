import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import crypto from 'node:crypto';

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

    const newSecret = `whsec_${crypto.randomBytes(24).toString('hex')}`;

    await prisma.merchant.update({
      where: { id: merchant.id },
      data: { webhookSecret: newSecret },
    });

    return NextResponse.json({ 
      success: true, 
      data: { secret: newSecret } 
    }, { status: 200 });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Regenerate Webhook Secret Error]:', message);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
