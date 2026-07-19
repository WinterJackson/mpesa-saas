import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phone, amount, orderReference } = body;

    // Determine which API key to use for this checkout:
    // 1. If the visitor is signed in AND has completed onboarding (has a
    //    merchant account), use THEIR OWN API key — this makes their demo
    //    transactions show up on their own dashboard in real time.
    // 2. Otherwise (anonymous visitor just browsing, no account yet), fall
    //    back to the shared demo merchant's key so the page still works
    //    without requiring sign-up first.
    let apiKeyToUse: string | null = null;

    const { userId } = await auth();
    if (userId) {
      const merchant = await prisma.merchant.findUnique({
        where: { clerkUserId: userId },
        include: { apiKeys: { where: { revoked: false }, take: 1 } },
      });
      if (merchant && merchant.apiKeys.length > 0) {
        apiKeyToUse = merchant.apiKeys[0].key;
      }
    }

    if (!apiKeyToUse) {
      apiKeyToUse = process.env.DEMO_API_KEY ?? null;
    }

    if (!apiKeyToUse) {
      return NextResponse.json(
        { success: false, error: 'DEMO_API_KEY is not configured on the server. Please visit /api/demo/seed to generate one and add it to your .env.local file.' },
        { status: 500 }
      );
    }

    const host = request.headers.get('host') || 'localhost:3000';
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const apiUrl = `${protocol}://${host}/api/v1/payments/initiate`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKeyToUse,
      },
      body: JSON.stringify({ phone, amount, orderReference }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: data.error || 'Failed to initiate demo payment' },
        { status: response.status }
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
