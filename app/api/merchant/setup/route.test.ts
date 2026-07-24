import { describe, it, expect, vi, beforeEach } from 'vitest';

// Real next/server after() throws outside a request scope; stub it to a
// no-op so fire-and-forget email dispatch doesn't break the route under test.
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: () => {},
}));
import { POST } from './route';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { seedPooledSandboxCredential } from '@/lib/repositories/daraja-credentials';
import { ensurePlansSeeded, ensureTrialSubscription } from '@/lib/repositories/billing';

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
  clerkClient: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    $transaction: vi.fn(),
    merchant: { findUnique: vi.fn() },
  },
  TransactionClient: {},
}));

vi.mock('@/lib/repositories/daraja-credentials', () => ({
  seedPooledSandboxCredential: vi.fn(),
}));

vi.mock('@/lib/repositories/audit-log', () => ({
  writeAuditLog: vi.fn(),
}));

vi.mock('@/lib/repositories/billing', () => ({
  ensurePlansSeeded: vi.fn(),
  getPlanByName: vi.fn().mockResolvedValue({ id: 'plan-starter', name: 'Starter', monthlyFee: 0, txFeeBps: 150, txCapMonthly: 200 }),
  ensureTrialSubscription: vi.fn(),
}));

vi.mock('@/lib/crypto', () => ({
  encryptSecret: vi.fn((v: string) => `enc:${v}`),
  decryptSecret: vi.fn((v: string) => v),
}));

vi.mock('@/lib/env', () => ({
  env: {
    MPESA_CONSUMER_KEY: 'ck',
    MPESA_CONSUMER_SECRET: 'cs',
    MPESA_SHORTCODE: '174379',
    MPESA_PASSKEY: 'pk',
    MPESA_CALLBACK_URL: 'https://example.com/callback',
  },
}));

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/merchant/setup', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('POST /api/merchant/setup', () => {
  const updateUserMetadata = vi.fn();
  const createOrganization = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(clerkClient).mockResolvedValue({
      users: { updateUserMetadata },
      organizations: { createOrganization },
    } as never);
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ userId: null, orgId: null } as never);
    const response = await POST(makeRequest({ businessName: 'Acme' }));
    expect(response.status).toBe(401);
  });

  it('returns 400 for a too-short business name', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ userId: 'user-1', orgId: null } as never);
    const response = await POST(makeRequest({ businessName: 'A' }));
    expect(response.status).toBe(400);
  });

  it('is idempotent by clerkUserId: self-heals an existing merchant without creating a new Clerk org', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ userId: 'user-1', orgId: null } as never);
    vi.mocked(prisma.merchant.findUnique).mockResolvedValueOnce({
      id: 'merchant-1', clerkUserId: 'user-1', organizationId: 'org-1', businessName: 'Acme',
    } as never);

    const response = await POST(makeRequest({ businessName: 'Acme' }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.id).toBe('merchant-1');
    expect(createOrganization).not.toHaveBeenCalled();
    // Self-heal: idempotently ensure credentials, subscription, and onboarded flag.
    expect(seedPooledSandboxCredential).toHaveBeenCalledWith('org-1', expect.objectContaining({ consumerKey: 'ck' }));
    expect(ensureTrialSubscription).toHaveBeenCalledWith('org-1', 'plan-starter');
    expect(updateUserMetadata).toHaveBeenCalledWith('user-1', { publicMetadata: { onboarded: true } });
  });

  it('creates a Clerk Organization, local Organization/Membership/Merchant, and provisions credentials + subscription', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ userId: 'user-1', orgId: null } as never);
    vi.mocked(prisma.merchant.findUnique).mockResolvedValueOnce(null);
    createOrganization.mockResolvedValueOnce({ id: 'clerk-org-1' });

    const tx = {
      organization: { create: vi.fn().mockResolvedValue({ id: 'org-1', clerkOrgId: 'clerk-org-1' }) },
      membership: { create: vi.fn().mockResolvedValue({}) },
      merchant: { create: vi.fn().mockResolvedValue({ id: 'merchant-1', clerkUserId: 'user-1', organizationId: 'org-1' }) },
      apiKey: { create: vi.fn().mockResolvedValue({ id: 'key-1' }) },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.$transaction).mockImplementationOnce(((cb: (tx: unknown) => unknown) => cb(tx)) as any);

    const response = await POST(makeRequest({ businessName: 'Acme Ltd' }));
    const data = await response.json();

    expect(createOrganization).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Acme Ltd', createdBy: 'user-1' })
    );
    expect(seedPooledSandboxCredential).toHaveBeenCalledWith(
      'org-1',
      expect.objectContaining({ consumerKey: 'ck', shortcode: '174379' })
    );
    expect(ensurePlansSeeded).toHaveBeenCalled();
    expect(ensureTrialSubscription).toHaveBeenCalledWith('org-1', 'plan-starter');
    expect(updateUserMetadata).toHaveBeenCalledWith('user-1', { publicMetadata: { onboarded: true } });
    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(response.cookies.get('payswift_just_onboarded')).toBeTruthy();
  });
});
