import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendEmail, isEmailConfigured, maskEmail } from './client';

const sendMock = vi.fn();
vi.mock('resend', () => ({
  // A class is reliably constructable under `new Resend(...)`.
  Resend: class {
    emails = { send: sendMock };
  },
}));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const original = process.env.RESEND_API_KEY;

describe('email client', () => {
  beforeEach(() => {
    sendMock.mockReset();
  });
  afterEach(() => {
    if (original === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = original;
  });

  it('maskEmail keeps only the first char and the domain', () => {
    expect(maskEmail('jane.doe@acme.com')).toBe('j***@acme.com');
    expect(maskEmail('notanemail')).toBe('***');
  });

  it('fails OPEN and skips when RESEND_API_KEY is unset (never calls Resend)', async () => {
    delete process.env.RESEND_API_KEY;
    expect(isEmailConfigured()).toBe(false);

    const res = await sendEmail({ to: 'a@b.com', subject: 'Hi', html: '<p>x</p>', text: 'x' });
    expect(res).toEqual({ delivered: false, skipped: true });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('sends via Resend when configured', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    sendMock.mockResolvedValueOnce({ data: { id: 'em_1' }, error: null });

    const res = await sendEmail({ to: 'a@b.com', subject: 'Hi', html: '<p>x</p>', text: 'x' });
    expect(res.delivered).toBe(true);
    expect(res.id).toBe('em_1');
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it('rejects with no valid recipient without calling Resend', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    const res = await sendEmail({ to: 'not-an-email', subject: 'Hi', html: '<p>x</p>', text: 'x' });
    expect(res.delivered).toBe(false);
    expect(res.error).toMatch(/no valid recipient/);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('returns the error (does not throw) when Resend responds with an error', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    sendMock.mockResolvedValueOnce({ data: null, error: { message: 'domain not verified' } });
    const res = await sendEmail({ to: 'a@b.com', subject: 'Hi', html: '<p>x</p>', text: 'x' });
    expect(res.delivered).toBe(false);
    expect(res.error).toBe('domain not verified');
  });

  it('fails OPEN (never throws) when the Resend SDK throws', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    sendMock.mockRejectedValueOnce(new Error('network down'));
    const res = await sendEmail({ to: 'a@b.com', subject: 'Hi', html: '<p>x</p>', text: 'x' });
    expect(res.delivered).toBe(false);
    expect(res.error).toBe('network down');
  });
});
