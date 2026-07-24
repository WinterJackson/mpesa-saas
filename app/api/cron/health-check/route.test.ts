import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET } from './route';
import { isAuthorizedCronRequest } from '@/lib/cron-auth';
import { prisma } from '@/lib/db';
import { redis } from '@/lib/rate-limit';
import { recordHealthCheck } from '@/lib/repositories/health-checks';

vi.mock('@/lib/cron-auth', () => ({ isAuthorizedCronRequest: vi.fn() }));
vi.mock('@/lib/db', () => ({ prisma: { $queryRaw: vi.fn() } }));
vi.mock('@/lib/rate-limit', () => ({ redis: null }));
vi.mock('@/lib/repositories/health-checks', () => ({ recordHealthCheck: vi.fn() }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

function makeRequest() {
  return new Request('http://localhost/api/cron/health-check');
}

describe('GET /api/cron/health-check', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isAuthorizedCronRequest).mockReturnValue(true);
    delete process.env.MPESA_CONSUMER_KEY;
    delete process.env.MPESA_CONSUMER_SECRET;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns 401 when the cron request is not authorized', async () => {
    vi.mocked(isAuthorizedCronRequest).mockReturnValueOnce(false);
    const response = await GET(makeRequest());
    expect(response.status).toBe(401);
    expect(recordHealthCheck).not.toHaveBeenCalled();
  });

  it('records "operational" for the database when the query succeeds', async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ '?column?': 1 }]);
    const response = await GET(makeRequest());
    expect(response.status).toBe(200);
    expect(recordHealthCheck).toHaveBeenCalledWith(
      expect.objectContaining({ component: 'database', status: 'operational' })
    );
  });

  it('records "down" for the database when the query throws', async () => {
    vi.mocked(prisma.$queryRaw).mockRejectedValueOnce(new Error('connection refused'));
    const response = await GET(makeRequest());
    expect(response.status).toBe(200);
    expect(recordHealthCheck).toHaveBeenCalledWith(
      expect.objectContaining({ component: 'database', status: 'down' })
    );
  });

  it('omits redis entirely when it is not configured (redis === null)', async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([]);
    await GET(makeRequest());
    const calledComponents = vi.mocked(recordHealthCheck).mock.calls.map((c) => c[0].component);
    expect(calledComponents).not.toContain('redis');
    expect(redis).toBeNull();
  });

  it('omits the Daraja sandbox check when MPESA_CONSUMER_KEY/SECRET are unset', async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([]);
    await GET(makeRequest());
    const calledComponents = vi.mocked(recordHealthCheck).mock.calls.map((c) => c[0].component);
    expect(calledComponents).not.toContain('daraja_sandbox');
  });

  it('records "operational" for the Daraja sandbox when configured and reachable', async () => {
    process.env.MPESA_CONSUMER_KEY = 'k';
    process.env.MPESA_CONSUMER_SECRET = 's';
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: true }) as any;

    await GET(makeRequest());

    expect(recordHealthCheck).toHaveBeenCalledWith(
      expect.objectContaining({ component: 'daraja_sandbox', status: 'operational' })
    );
  });
});
