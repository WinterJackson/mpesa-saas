import { NextResponse } from 'next/server';
import { processCommandResult } from '@/lib/daraja-command-result';
import type { DarajaResultPayload } from '@/lib/types';
import { logger } from '@/lib/logger';

// Transaction Status Query result — recorded on the DarajaCommand for
// reconciliation/admin review only. Deliberately NO auto-heal of transaction
// status (guardrail #4: never trust a query for failure). Always returns 200.
export async function POST(request: Request) {
  try {
    let body: DarajaResultPayload;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: true }, { status: 200 });
    }
    await processCommandResult(body, 'Transaction Status');
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: unknown) {
    logger.error('[Transaction Status Result Error]:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ success: true }, { status: 200 });
  }
}
