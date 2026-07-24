import { NextResponse } from 'next/server';
import { isAuthorizedCronRequest } from '@/lib/cron-auth';
import { prisma } from '@/lib/db';
import { redis } from '@/lib/rate-limit';
import { recordHealthCheck, type HealthCheckResult } from '@/lib/repositories/health-checks';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

// Periodic self-check backing the public /status page (Phase 4, Stage 7).
// Add this route to the same cron-job.org schedule as the other 3
// app/api/cron/* jobs (every few minutes is enough — this is not a
// sub-minute uptime monitor). A component whose prerequisite env vars aren't
// configured is simply omitted, never reported as a misleading status.

async function checkDatabase(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { component: 'database', status: 'operational', latencyMs: Date.now() - start };
  } catch {
    return { component: 'database', status: 'down', latencyMs: Date.now() - start };
  }
}

async function checkRedis(): Promise<HealthCheckResult | null> {
  if (!redis) return null; // not configured
  const start = Date.now();
  try {
    await redis.ping();
    return { component: 'redis', status: 'operational', latencyMs: Date.now() - start };
  } catch {
    return { component: 'redis', status: 'down', latencyMs: Date.now() - start };
  }
}

async function checkDarajaSandbox(): Promise<HealthCheckResult | null> {
  const key = process.env.MPESA_CONSUMER_KEY;
  const secret = process.env.MPESA_CONSUMER_SECRET;
  if (!key || !secret) return null; // not configured

  const start = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);
  try {
    const auth = Buffer.from(`${key}:${secret}`).toString('base64');
    const response = await fetch('https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
      headers: { Authorization: `Basic ${auth}` },
      signal: controller.signal as AbortSignal,
    });
    clearTimeout(timeoutId);
    return {
      component: 'daraja_sandbox',
      status: response.ok ? 'operational' : 'degraded',
      latencyMs: Date.now() - start,
    };
  } catch {
    clearTimeout(timeoutId);
    return { component: 'daraja_sandbox', status: 'down', latencyMs: Date.now() - start };
  }
}

export async function GET(request: Request) {
  try {
    if (!isAuthorizedCronRequest(request)) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const results = (await Promise.all([checkDatabase(), checkRedis(), checkDarajaSandbox()])).filter(
      (r): r is HealthCheckResult => r !== null
    );

    for (const result of results) {
      await recordHealthCheck(result);
    }

    logger.info(`[Health Check] Recorded ${results.length} component check(s).`);
    return NextResponse.json({ success: true, results });
  } catch (error: unknown) {
    logger.error('[Health Check Error]:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
