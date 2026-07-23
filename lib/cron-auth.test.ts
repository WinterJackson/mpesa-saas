import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isAuthorizedCronRequest } from './cron-auth';

function req(bearer?: string) {
  return new Request('http://localhost/api/cron/x', bearer ? { headers: { authorization: `Bearer ${bearer}` } } : undefined);
}

describe('isAuthorizedCronRequest', () => {
  const original = process.env;
  beforeEach(() => { process.env = { ...original }; });
  afterEach(() => { process.env = original; });

  it('fails closed when CRON_SECRET is not configured', () => {
    delete process.env.CRON_SECRET;
    // Even an empty Bearer must NOT be authorized when no secret is set.
    expect(isAuthorizedCronRequest(req())).toBe(false);
    expect(isAuthorizedCronRequest(req('anything'))).toBe(false);
  });

  it('rejects a wrong token', () => {
    process.env.CRON_SECRET = 'the-real-secret';
    expect(isAuthorizedCronRequest(req('wrong'))).toBe(false);
    expect(isAuthorizedCronRequest(req())).toBe(false);
  });

  it('accepts the exact Bearer token', () => {
    process.env.CRON_SECRET = 'the-real-secret';
    expect(isAuthorizedCronRequest(req('the-real-secret'))).toBe(true);
  });
});
