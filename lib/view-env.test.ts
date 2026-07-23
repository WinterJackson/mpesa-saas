import { describe, it, expect, vi, beforeEach } from 'vitest';

const cookieStore = { get: vi.fn() };
vi.mock('next/headers', () => ({ cookies: () => Promise.resolve(cookieStore) }));

import { getViewEnvironment } from './view-env';

describe('getViewEnvironment', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the cookie value when it is a valid environment', async () => {
    cookieStore.get.mockReturnValue({ value: 'live' });
    expect(await getViewEnvironment('sandbox')).toBe('live');
  });

  it('falls back to the merchant environment when the cookie is unset', async () => {
    cookieStore.get.mockReturnValue(undefined);
    expect(await getViewEnvironment('live')).toBe('live');
    expect(await getViewEnvironment('sandbox')).toBe('sandbox');
  });

  it('ignores a garbage cookie value and uses the fallback', async () => {
    cookieStore.get.mockReturnValue({ value: 'nonsense' });
    expect(await getViewEnvironment('sandbox')).toBe('sandbox');
  });
});
