import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import { prisma } from '@/lib/db';
import { getDecryptedCredentials, isLiveCredentialConfigured } from '@/lib/repositories/daraja-credentials';
import { getAccessToken, initiateSTKPush, querySTKPushStatus, isLiveModeConfigured } from './daraja';

vi.mock('@/lib/db', () => ({
  prisma: {
    darajaToken: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock('@/lib/repositories/daraja-credentials', () => ({
  getDecryptedCredentials: vi.fn(),
  isLiveCredentialConfigured: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const SANDBOX_CREDS = {
  consumerKey: 'ck',
  consumerSecret: 'cs',
  shortcode: '174379',
  passkey: 'pk',
  callbackUrl: 'https://example.com/callback',
};

describe('lib/daraja per-organization credential resolution', () => {
  let fetchMock: MockInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    global.fetch = fetchMock as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isLiveModeConfigured', () => {
    it('delegates to the per-organization credential check', async () => {
      vi.mocked(isLiveCredentialConfigured).mockResolvedValueOnce(true);
      const result = await isLiveModeConfigured('org-1');
      expect(isLiveCredentialConfigured).toHaveBeenCalledWith('org-1');
      expect(result).toBe(true);
    });
  });

  describe('getAccessToken', () => {
    it('returns the cached token scoped to organizationId_environment without hitting Daraja', async () => {
      vi.mocked(prisma.darajaToken.findUnique).mockResolvedValueOnce({
        id: 'org-1_sandbox',
        accessToken: 'cached-token',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      } as never);

      const token = await getAccessToken('org-1', 'sandbox');

      expect(prisma.darajaToken.findUnique).toHaveBeenCalledWith({ where: { id: 'org-1_sandbox' } });
      expect(token).toBe('cached-token');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('fetches and caches a fresh token per-organization when none is cached', async () => {
      vi.mocked(prisma.darajaToken.findUnique).mockResolvedValueOnce(null);
      vi.mocked(getDecryptedCredentials).mockResolvedValueOnce(SANDBOX_CREDS);
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'fresh-token' }),
      });
      vi.mocked(prisma.darajaToken.upsert).mockResolvedValueOnce({} as never);

      const token = await getAccessToken('org-1', 'sandbox');

      expect(getDecryptedCredentials).toHaveBeenCalledWith('org-1', 'sandbox');
      expect(token).toBe('fresh-token');
      expect(prisma.darajaToken.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'org-1_sandbox' } })
      );
    });

    it('throws a clear error when sandbox credentials are not configured for the organization', async () => {
      vi.mocked(prisma.darajaToken.findUnique).mockResolvedValueOnce(null);
      vi.mocked(getDecryptedCredentials).mockResolvedValueOnce(null);

      await expect(getAccessToken('org-without-creds', 'sandbox')).rejects.toThrow(
        'Sandbox M-Pesa credentials are not configured for this organization.'
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('throws a clear error when live is requested but no live credentials are configured', async () => {
      vi.mocked(prisma.darajaToken.findUnique).mockResolvedValueOnce(null);
      vi.mocked(getDecryptedCredentials).mockResolvedValueOnce(null);

      await expect(getAccessToken('org-1', 'live')).rejects.toThrow(
        'Live M-Pesa credentials are not configured for this organization.'
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('initiateSTKPush', () => {
    it('resolves credentials for the requesting organization and sends its shortcode', async () => {
      vi.mocked(getDecryptedCredentials).mockResolvedValue(SANDBOX_CREDS);
      vi.mocked(prisma.darajaToken.findUnique).mockResolvedValueOnce({
        id: 'org-1_sandbox',
        accessToken: 'token',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      } as never);
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          MerchantRequestID: 'm-1',
          CheckoutRequestID: 'c-1',
          ResponseCode: '0',
          ResponseDescription: 'Success',
          CustomerMessage: 'Success',
        }),
      });

      await initiateSTKPush({
        organizationId: 'org-1',
        phone: '254712345678',
        amount: 100,
        environment: 'sandbox',
      });

      expect(getDecryptedCredentials).toHaveBeenCalledWith('org-1', 'sandbox');
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.BusinessShortCode).toBe(SANDBOX_CREDS.shortcode);
    });
  });

  describe('querySTKPushStatus', () => {
    it('resolves credentials and access token scoped to the given organization', async () => {
      vi.mocked(getDecryptedCredentials).mockResolvedValue(SANDBOX_CREDS);
      vi.mocked(prisma.darajaToken.findUnique).mockResolvedValueOnce({
        id: 'org-2_sandbox',
        accessToken: 'token',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      } as never);
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ResponseCode: '0',
          ResponseDescription: 'Success',
          MerchantRequestID: 'm-1',
          CheckoutRequestID: 'c-1',
          ResultCode: '0',
          ResultDesc: 'Success',
        }),
      });

      await querySTKPushStatus('c-1', 'org-2', 'sandbox');

      expect(prisma.darajaToken.findUnique).toHaveBeenCalledWith({ where: { id: 'org-2_sandbox' } });
      expect(getDecryptedCredentials).toHaveBeenCalledWith('org-2', 'sandbox');
    });
  });
});
