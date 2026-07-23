import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import { getAccessToken } from '@/lib/daraja';
import { getDecryptedCredentials, getDecryptedInitiator } from '@/lib/repositories/daraja-credentials';
import { generateSecurityCredential } from '@/lib/daraja-security-credential';
import { buildInitiatorAuth, postInitiatorCommand } from './daraja-initiator';

vi.mock('@/lib/daraja', () => ({
  DARAJA_BASE_URLS: { sandbox: 'https://sandbox.safaricom.co.ke', live: 'https://api.safaricom.co.ke' },
  getAccessToken: vi.fn(),
}));
vi.mock('@/lib/repositories/daraja-credentials', () => ({
  getDecryptedCredentials: vi.fn(),
  getDecryptedInitiator: vi.fn(),
}));
vi.mock('@/lib/daraja-security-credential', () => ({ generateSecurityCredential: vi.fn() }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

describe('buildInitiatorAuth', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws when credentials are missing', async () => {
    vi.mocked(getDecryptedCredentials).mockResolvedValueOnce(null);
    await expect(buildInitiatorAuth('org-1', 'live')).rejects.toThrow(/Live M-Pesa credentials are not configured/i);
  });

  it('throws when the initiator is missing', async () => {
    vi.mocked(getDecryptedCredentials).mockResolvedValueOnce({ consumerKey: 'k', consumerSecret: 's', shortcode: '600', passkey: 'p', callbackUrl: 'u' });
    vi.mocked(getDecryptedInitiator).mockResolvedValueOnce(null);
    await expect(buildInitiatorAuth('org-1', 'sandbox')).rejects.toThrow(/initiator credentials are not configured/i);
  });

  it('assembles shortcode, initiator name, RSA credential and token', async () => {
    vi.mocked(getDecryptedCredentials).mockResolvedValueOnce({ consumerKey: 'k', consumerSecret: 's', shortcode: '600', passkey: 'p', callbackUrl: 'u' });
    vi.mocked(getDecryptedInitiator).mockResolvedValueOnce({ name: 'testapi', password: 'pw' });
    vi.mocked(generateSecurityCredential).mockReturnValueOnce('SEC');
    vi.mocked(getAccessToken).mockResolvedValueOnce('token');

    const auth = await buildInitiatorAuth('org-1', 'sandbox');
    expect(generateSecurityCredential).toHaveBeenCalledWith('pw', 'sandbox');
    expect(auth).toEqual({ shortcode: '600', initiatorName: 'testapi', securityCredential: 'SEC', accessToken: 'token' });
  });
});

describe('postInitiatorCommand', () => {
  let fetchMock: MockInstance;
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    global.fetch = fetchMock as any;
  });
  afterEach(() => vi.restoreAllMocks());

  it('posts to the environment base URL and returns the parsed response', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ OriginatorConversationID: 'OC', ConversationID: 'C', ResponseCode: '0', ResponseDescription: 'ok' }) });
    const res = await postInitiatorCommand('sandbox', '/mpesa/reversal/v1/request', { a: 1 }, 'token', 'Reversal');
    expect(fetchMock.mock.calls[0][0]).toBe('https://sandbox.safaricom.co.ke/mpesa/reversal/v1/request');
    expect(res.OriginatorConversationID).toBe('OC');
  });

  it('sanitizes a non-OK gateway response', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({ errorMessage: 'bad' }) });
    await expect(postInitiatorCommand('sandbox', '/x', {}, 'token', 'Reversal')).rejects.toThrow(/Payment gateway rejected the Reversal request/i);
  });
});
