import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';
import { prisma } from '@/lib/db';
import { auth } from '@clerk/nextjs/server';

vi.mock('@/lib/db', () => ({
  prisma: {
    merchant: {
      findUnique: vi.fn(),
    },
    transaction: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}));

function makeRequest(id: string) {
  return {
    request: new Request(`http://localhost/api/demo/status/${id}`),
    context: { params: Promise.resolve({ id }) },
  };
}

describe('GET /api/demo/status/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DEMO_API_KEY = 'test-demo-key';
  });

  it('returns 500 if DEMO_API_KEY is not configured', async () => {
    delete process.env.DEMO_API_KEY;
    const { request, context } = makeRequest('tx_1');
    const response = await GET(request, context);
    expect(response.status).toBe(500);
  });

  it('returns 404 without leaking existence when the transaction belongs to a different merchant', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ userId: 'user_signed_in' } as never);
    vi.mocked(prisma.merchant.findUnique).mockResolvedValueOnce({ id: 'merchant_signed_in' } as never);
    vi.mocked(prisma.transaction.findUnique).mockResolvedValueOnce({
      id: 'tx_1',
      merchantId: 'merchant_someone_else',
      checkoutRequestId: 'ws_123',
      status: 'pending',
      resultDesc: null,
    } as never);

    const { request, context } = makeRequest('tx_1');
    const response = await GET(request, context);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
  });

  it('returns 404 when the transaction does not exist', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ userId: null } as never);
    vi.mocked(prisma.merchant.findUnique).mockResolvedValueOnce({ id: 'merchant_demo' } as never);
    vi.mocked(prisma.transaction.findUnique).mockResolvedValueOnce(null as never);

    const { request, context } = makeRequest('tx_missing');
    const response = await GET(request, context);
    expect(response.status).toBe(404);
  });

  it('returns the transaction for the signed-in merchant that owns it', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ userId: 'user_signed_in' } as never);
    vi.mocked(prisma.merchant.findUnique).mockResolvedValueOnce({ id: 'merchant_signed_in' } as never);
    vi.mocked(prisma.transaction.findUnique).mockResolvedValueOnce({
      id: 'tx_1',
      merchantId: 'merchant_signed_in',
      checkoutRequestId: 'ws_123',
      status: 'completed',
      resultDesc: 'The service request is processed successfully.',
    } as never);

    const { request, context } = makeRequest('tx_1');
    const response = await GET(request, context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.status).toBe('completed');
  });

  it('returns the transaction for an anonymous visitor when it belongs to the shared demo merchant', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ userId: null } as never);
    vi.mocked(prisma.merchant.findUnique).mockResolvedValueOnce({ id: 'merchant_demo' } as never);
    vi.mocked(prisma.transaction.findUnique).mockResolvedValueOnce({
      id: 'tx_2',
      merchantId: 'merchant_demo',
      checkoutRequestId: 'ws_456',
      status: 'pending',
      resultDesc: null,
    } as never);

    const { request, context } = makeRequest('tx_2');
    const response = await GET(request, context);
    expect(response.status).toBe(200);
  });
});
