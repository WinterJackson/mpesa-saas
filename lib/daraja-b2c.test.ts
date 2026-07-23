import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import { getAccessToken } from '@/lib/daraja';
import { getDecryptedCredentials, getDecryptedInitiator } from '@/lib/repositories/daraja-credentials';
import { generateSecurityCredential } from '@/lib/daraja-security-credential';
import { initiateB2C } from './daraja-b2c';

vi.mock('@/lib/daraja', () => ({
  DARAJA_BASE_URLS: { sandbox: 'https://sandbox.safaricom.co.ke', live: 'https://api.safaricom.co.ke' },
  getAccessToken: vi.fn(),
}));
vi.mock('@/lib/repositories/daraja-credentials', () => ({
  getDecryptedCredentials: vi.fn(),
  getDecryptedInitiator: vi.fn(),
}));
vi.mock('@/lib/daraja-security-credential', () => ({
  generateSecurityCredential: vi.fn(),
}));
vi.mock('@/lib/daraja-urls', () => ({
  b2cResultUrl: () => 'https://app.example.com/api/mpesa/b2c/result',
  b2cTimeoutUrl: () => 'https://app.example.com/api/mpesa/b2c/timeout',
}));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const CREDS = { consumerKey: 'ck', consumerSecret: 'cs', shortcode: '600000', passkey: 'pk', callbackUrl: 'https://x/cb' };
const INITIATOR = { name: 'testapi', password: 'Safaricom999!*!' };

describe('initiateB2C', () => {
  let fetchMock: MockInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    global.fetch = fetchMock as any;
    vi.mocked(getDecryptedCredentials).mockResolvedValue(CREDS);
    vi.mocked(getDecryptedInitiator).mockResolvedValue(INITIATOR);
    vi.mocked(generateSecurityCredential).mockReturnValue('SEC_CRED_BASE64');
    vi.mocked(getAccessToken).mockResolvedValue('token');
  });

  afterEach(() => vi.restoreAllMocks());

  it('resolves per-org credentials + initiator, RSA-signs, and posts the B2C payload', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ConversationID: 'AG_1',
        OriginatorConversationID: 'OC_1',
        ResponseCode: '0',
        ResponseDescription: 'Accept the service request successfully.',
      }),
    });

    const res = await initiateB2C({ organizationId: 'org-1', environment: 'sandbox', amount: 500, phone: '254712345678', remarks: 'Payout' });

    expect(getDecryptedCredentials).toHaveBeenCalledWith('org-1', 'sandbox');
    expect(getDecryptedInitiator).toHaveBeenCalledWith('org-1', 'sandbox');
    expect(generateSecurityCredential).toHaveBeenCalledWith('Safaricom999!*!', 'sandbox');

    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('https://sandbox.safaricom.co.ke/mpesa/b2c/v3/paymentrequest');
    const body = JSON.parse(opts.body);
    expect(body.InitiatorName).toBe('testapi');
    expect(body.SecurityCredential).toBe('SEC_CRED_BASE64');
    expect(body.PartyA).toBe('600000');
    expect(body.PartyB).toBe('254712345678');
    expect(body.CommandID).toBe('BusinessPayment');
    expect(body.ResultURL).toBe('https://app.example.com/api/mpesa/b2c/result');
    expect(res.OriginatorConversationID).toBe('OC_1');
  });

  it('throws a clear error when initiator credentials are not configured', async () => {
    vi.mocked(getDecryptedInitiator).mockResolvedValueOnce(null);
    await expect(initiateB2C({ organizationId: 'org-1', environment: 'sandbox', amount: 500, phone: '254712345678' }))
      .rejects.toThrow(/initiator credentials are not configured/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws a clear error when live credentials are missing', async () => {
    vi.mocked(getDecryptedCredentials).mockResolvedValueOnce(null);
    await expect(initiateB2C({ organizationId: 'org-1', environment: 'live', amount: 500, phone: '254712345678' }))
      .rejects.toThrow(/Live M-Pesa credentials are not configured/i);
  });

  it('sanitizes a non-OK gateway response', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ errorMessage: 'boom' }) });
    await expect(initiateB2C({ organizationId: 'org-1', environment: 'sandbox', amount: 500, phone: '254712345678' }))
      .rejects.toThrow(/Payment gateway rejected the payout request/i);
  });
});
