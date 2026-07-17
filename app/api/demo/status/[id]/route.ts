import { NextResponse } from 'next/server';

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

    const host = request.headers.get('host') || 'localhost:3000';
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const apiUrl = `${protocol}://${host}/api/v1/payments/status/${id}`;

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'x-api-key': demoApiKey,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: data.error || 'Failed to fetch status' },
        { status: response.status }
      );
    }

    return NextResponse.json(data, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
