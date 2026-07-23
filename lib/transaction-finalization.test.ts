import { describe, it, expect, vi } from 'vitest';
import { finalizeTransactionAsync } from './transaction-finalization';
import type { Transaction, Merchant } from '@prisma/client';

// Mocks
let afterCallback: (() => Promise<void>) | null = null;
vi.mock('next/server', () => ({
  after: vi.fn((fn) => { afterCallback = fn; }),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    webhookDelivery: {
      create: vi.fn().mockResolvedValue({}),
    },
  },
}));

vi.mock('@/lib/webhook', () => ({
  deliverWebhook: vi.fn().mockResolvedValue({ statusCode: 200, delivered: true, attempts: 1 }),
}));

vi.mock('@/lib/shopify', () => ({
  markShopifyOrderPaid: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('@/lib/crypto', () => ({
  decryptSecret: vi.fn((secret) => secret.replace('enc_', '')),
}));

describe('transaction-finalization', () => {
  it('calls webhook if merchant has webhookUrl', async () => {
    const { deliverWebhook } = await import('@/lib/webhook');
    const { prisma } = await import('@/lib/db');
    
    // reset mocks
    vi.clearAllMocks();
    
    const tx = {
      id: 'tx_123',
      amount: 100,
      phone: '254700000000',
      status: 'completed',
    } as unknown as Transaction;
    
    const merchant = {
      webhookUrl: 'https://example.com/hook',
      webhookSecret: 'enc_secret123',
    } as unknown as Merchant;
    
    finalizeTransactionAsync(tx, merchant);
    await afterCallback!();
    
    // next/server after() was mocked to be captured and executed
    expect(deliverWebhook).toHaveBeenCalledWith(
      'https://example.com/hook',
      expect.objectContaining({ event: 'payment.completed' }),
      'secret123'
    );
    expect(prisma.webhookDelivery.create).toHaveBeenCalled();
  });
  
  it('calls shopify confirmation if source is shopify and merchant has config', async () => {
    const { markShopifyOrderPaid } = await import('@/lib/shopify');
    
    vi.clearAllMocks();
    
    const tx = {
      id: 'tx_123',
      status: 'completed',
      source: 'shopify',
      orderReference: '9999',
      amount: 2500,
    } as unknown as Transaction;

    const merchant = {
      shopifyShopDomain: 'test.myshopify.com',
      shopifyAdminAccessToken: 'enc_token123',
    } as unknown as Merchant;

    finalizeTransactionAsync(tx, merchant);
    await afterCallback!();

    expect(markShopifyOrderPaid).toHaveBeenCalledWith({
      shopDomain: 'test.myshopify.com',
      accessToken: 'token123',
      orderId: '9999',
      mpesaReceipt: 'N/A',
      amount: 2500,
      currency: 'KES',
    });
  });
});
