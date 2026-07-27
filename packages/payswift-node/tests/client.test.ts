import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaySwiftClient, PaySwiftError } from '../src';
import crypto from 'node:crypto';

// Setup global fetch mock
const fetchMock = vi.fn();
global.fetch = fetchMock;

describe('PaySwiftClient', () => {
  beforeEach(() => {
    fetchMock.mockClear();
  });

  it('throws an error if instantiated without baseUrl', () => {
    expect(() => new PaySwiftClient('test_key', '')).toThrow('baseUrl is required');
  });

  it('performs a successful API call', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: { transactionId: 'test1234' } }),
    });

    const client = new PaySwiftClient('test_key', 'https://api.payswift.com');
    const result = await client.payments.status('test1234');

    expect(result.success).toBe(true);
    expect(result.data.transactionId).toBe('test1234');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    
    const request = fetchMock.mock.calls[0];
    expect(request[0]).toBe('https://api.payswift.com/api/v1/payments/status/test1234');
    expect(request[1].headers['x-api-key']).toBe('test_key');
  });

  it('throws immediately on 4xx errors without retrying', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ success: false, error: 'Validation error' }),
    });

    const client = new PaySwiftClient('test_key', 'https://api.payswift.com');

    await expect(client.payments.status('test1234')).rejects.toThrow(PaySwiftError);
    await expect(client.payments.status('test1234')).rejects.toThrow('Validation error');
    
    // Only 2 calls (the two we just made), meaning no retries inside the request
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries on 5xx errors and eventually succeeds', async () => {
    // Fail first 2 times with 502, succeed on 3rd
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 502,
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 502,
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ success: true, data: { payoutId: 'payout123' } }),
      });

    const client = new PaySwiftClient('test_key', 'https://api.payswift.com');
    const result = await client.payouts.initiate({ phone: '254700000000', amount: 100 });

    expect(result.success).toBe(true);
    expect(result.data.payoutId).toBe('payout123');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('retries on network errors (fetch throws)', async () => {
    fetchMock
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { transactions: [] } }),
      });

    const client = new PaySwiftClient('test_key', 'https://api.payswift.com');
    const result = await client.transactions.list();

    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('automatically generates an Idempotency-Key for mutating calls', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ success: true, data: { refundId: 'ref123' } }),
    });

    const client = new PaySwiftClient('test_key', 'https://api.payswift.com');
    await client.refunds.initiate({ transactionId: 'txn123' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const headers = fetchMock.mock.calls[0][1].headers;
    expect(headers['Idempotency-Key']).toBeDefined();
    // Validate UUID format
    expect(headers['Idempotency-Key']).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('respects a provided Idempotency-Key', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ success: true, data: { refundId: 'ref123' } }),
    });

    const client = new PaySwiftClient('test_key', 'https://api.payswift.com');
    await client.refunds.initiate({ transactionId: 'txn123' }, { idempotencyKey: 'custom-key-123' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const headers = fetchMock.mock.calls[0][1].headers;
    expect(headers['Idempotency-Key']).toBe('custom-key-123');
  });
});
