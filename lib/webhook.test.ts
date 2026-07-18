import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { deliverWebhook } from './webhook';

import { type MockInstance } from 'vitest';

describe('deliverWebhook', () => {
  let fetchMock: MockInstance;

  beforeEach(() => {
    fetchMock = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    global.fetch = fetchMock as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should include x-payswift-signature header if secretKey is provided', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200 });

    await deliverWebhook('https://example.com', { test: true }, 'mysecret');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const options = fetchMock.mock.calls[0][1];
    expect(options.headers).toHaveProperty('x-payswift-signature');
    expect(options.headers['x-payswift-signature']).not.toBe('');
  });

  it('should omit x-payswift-signature header if secretKey is NOT provided', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200 });

    await deliverWebhook('https://example.com', { test: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const options = fetchMock.mock.calls[0][1];
    expect(options.headers).not.toHaveProperty('x-payswift-signature');
  });

  it('should retry on 500 response up to 3 times', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: false, status: 500 });

    const result = await deliverWebhook('https://example.com', { test: true }, undefined, undefined, 3);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.delivered).toBe(false);
    expect(result.statusCode).toBe(500);
    expect(result.attempts).toBe(3);
  });

  it('should not retry on 400 response and stop after 1 attempt', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 400 });

    const result = await deliverWebhook('https://example.com', { test: true }, undefined, undefined, 3);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.delivered).toBe(false);
    expect(result.statusCode).toBe(400);
    expect(result.attempts).toBe(1);
  });

  it('should return delivered true and stop after 1 attempt on 200 response', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200 });

    const result = await deliverWebhook('https://example.com', { test: true }, undefined, undefined, 3);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.delivered).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(result.attempts).toBe(1);
  });
});
