import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const demoApiKey = process.env.DEMO_API_KEY;

    if (!demoApiKey) {
      return NextResponse.json(
        { success: false, error: 'DEMO_API_KEY is not configured on the server. Please visit /api/demo/seed to generate one and add it to your .env.local file.' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { phone, amount, orderReference } = body;

    // Use absolute URL since fetch requires it on the server
    const host = request.headers.get('host') || 'localhost:3000';
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const apiUrl = `${protocol}://${host}/api/v1/payments/initiate`;

    // Forward the request to the core PaySwift API using the demo API key
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': demoApiKey,
      },
      body: JSON.stringify({
        phone,
        amount,
        orderReference,
      }),
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
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
