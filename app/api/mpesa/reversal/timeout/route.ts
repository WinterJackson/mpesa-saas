import { NextResponse } from 'next/server';
import { logCommandTimeout } from '@/lib/daraja-command-result';
import type { DarajaResultPayload } from '@/lib/types';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
  try {
    let body: DarajaResultPayload;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: true }, { status: 200 });
    }
    await logCommandTimeout(body, 'Reversal');
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: unknown) {
    logger.error('[Reversal Timeout Error]:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ success: true }, { status: 200 });
  }
}
