import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '@/lib/db';
import {
  getDecryptedInitiator,
  setInitiatorCredential,
  isInitiatorConfigured,
  getCredentialSummary,
} from './daraja-credentials';

vi.mock('@/lib/db', () => ({
  prisma: {
    organizationDarajaCredential: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// Deterministic fake crypto so tests assert on encrypt/decrypt wiring, not AES.
vi.mock('@/lib/crypto', () => ({
  encryptSecret: vi.fn((v: string) => `enc:${v}`),
  decryptSecret: vi.fn((v: string | null) => (v == null ? null : v.replace(/^enc:/, ''))),
}));

describe('daraja-credentials initiator functions', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('getDecryptedInitiator', () => {
    it('returns null when no credential row exists', async () => {
      vi.mocked(prisma.organizationDarajaCredential.findUnique).mockResolvedValueOnce(null as never);
      expect(await getDecryptedInitiator('org-1', 'sandbox')).toBeNull();
    });

    it('returns decrypted sandbox initiator', async () => {
      vi.mocked(prisma.organizationDarajaCredential.findUnique).mockResolvedValueOnce({
        initiatorName: 'testapi',
        initiatorPasswordEncrypted: 'enc:Safaricom999!*!',
      } as never);
      expect(await getDecryptedInitiator('org-1', 'sandbox')).toEqual({
        name: 'testapi',
        password: 'Safaricom999!*!',
      });
    });

    it('returns null for live when live initiator not configured', async () => {
      vi.mocked(prisma.organizationDarajaCredential.findUnique).mockResolvedValueOnce({
        initiatorName: 'testapi',
        initiatorPasswordEncrypted: 'enc:x',
        initiatorNameLive: null,
        initiatorPasswordLiveEncrypted: null,
      } as never);
      expect(await getDecryptedInitiator('org-1', 'live')).toBeNull();
    });
  });

  describe('setInitiatorCredential', () => {
    it('encrypts the password and writes sandbox fields', async () => {
      vi.mocked(prisma.organizationDarajaCredential.update).mockResolvedValueOnce({} as never);
      await setInitiatorCredential('org-1', 'sandbox', { name: 'testapi', password: 'pw' });
      expect(prisma.organizationDarajaCredential.update).toHaveBeenCalledWith({
        where: { organizationId: 'org-1' },
        data: { initiatorName: 'testapi', initiatorPasswordEncrypted: 'enc:pw' },
      });
    });

    it('writes the *Live fields for live', async () => {
      vi.mocked(prisma.organizationDarajaCredential.update).mockResolvedValueOnce({} as never);
      await setInitiatorCredential('org-1', 'live', { name: 'prodapi', password: 'pw2' });
      expect(prisma.organizationDarajaCredential.update).toHaveBeenCalledWith({
        where: { organizationId: 'org-1' },
        data: { initiatorNameLive: 'prodapi', initiatorPasswordLiveEncrypted: 'enc:pw2' },
      });
    });
  });

  describe('isInitiatorConfigured', () => {
    it('true only when both name and password present for the environment', async () => {
      vi.mocked(prisma.organizationDarajaCredential.findUnique).mockResolvedValueOnce({
        initiatorName: 'testapi',
        initiatorPasswordEncrypted: 'enc:x',
        initiatorNameLive: null,
        initiatorPasswordLiveEncrypted: null,
      } as never);
      expect(await isInitiatorConfigured('org-1', 'sandbox')).toBe(true);
    });

    it('false when the row is missing', async () => {
      vi.mocked(prisma.organizationDarajaCredential.findUnique).mockResolvedValueOnce(null as never);
      expect(await isInitiatorConfigured('org-1', 'live')).toBe(false);
    });
  });

  describe('getCredentialSummary', () => {
    it('surfaces initiator presence without leaking secrets', async () => {
      vi.mocked(prisma.organizationDarajaCredential.findUnique).mockResolvedValueOnce({
        shortcode: '174379',
        isPooledSandbox: true,
        shortcodeLive: null,
        initiatorName: 'testapi',
        initiatorPasswordEncrypted: 'enc:x',
        initiatorNameLive: null,
        initiatorPasswordLiveEncrypted: null,
      } as never);
      const summary = await getCredentialSummary('org-1');
      expect(summary).toEqual({
        sandboxShortcode: '174379',
        isPooledSandbox: true,
        liveShortcode: null,
        hasLiveCredentials: false,
        hasSandboxInitiator: true,
        hasLiveInitiator: false,
      });
    });
  });
});
