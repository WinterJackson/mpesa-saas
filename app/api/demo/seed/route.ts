import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { generateApiKey } from '@/lib/api-keys';

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token');
    
    if (process.env.DEMO_SEED_TOKEN) {
      if (token !== process.env.DEMO_SEED_TOKEN) {
        return NextResponse.json(
          { success: false, error: 'Invalid or missing seed token' },
          { status: 403 }
        );
      }
    }

    // 1. Create or find the demo merchant
    const merchant = await prisma.merchant.upsert({
      where: { clerkUserId: 'demo_user_123' },
      update: {},
      create: {
        clerkUserId: 'demo_user_123',
        businessName: 'PaySwift Demo Store',
        environment: 'sandbox',
      },
    });

    // 2. Check if API key exists, revoke, and always create fresh
    await prisma.apiKey.updateMany({
      where: { merchantId: merchant.id, revoked: false },
      data: { revoked: true },
    });

    const newKey = generateApiKey();
    await prisma.apiKey.create({
      data: {
        merchantId: merchant.id,
        keyHash: newKey.keyHash,
        keyPrefix: newKey.keyPrefix,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Demo Merchant Seeded Successfully. Add DEMO_API_KEY to your .env.local file to use the demo store.",
      data: {
        merchantId: merchant.id,
        demoApiKey: newKey.raw,
      }
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
