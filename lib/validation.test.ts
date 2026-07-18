import { describe, it, expect } from 'vitest';
import { validatePhone, validateAmount, validateWebhookUrl } from './validation';

describe('validatePhone', () => {
  it('should validate 07... numbers', () => {
    expect(validatePhone('0712345678').valid).toBe(true);
  });

  it('should validate 2547... numbers', () => {
    expect(validatePhone('254712345678').valid).toBe(true);
  });

  it('should validate +2547... numbers', () => {
    expect(validatePhone('+254712345678').valid).toBe(true);
  });

  it('should validate 7... numbers', () => {
    expect(validatePhone('712345678').valid).toBe(true);
  });

  it('should fail on invalid short numbers', () => {
    expect(validatePhone('123').valid).toBe(false);
  });

  it('should fail on letters', () => {
    expect(validatePhone('2547ABCDEFGH').valid).toBe(false);
  });

  it('should fail on empty string', () => {
    expect(validatePhone('').valid).toBe(false);
  });

  it('should fail on null or undefined', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(validatePhone(null as any).valid).toBe(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(validatePhone(undefined as any).valid).toBe(false);
  });
});

describe('validateAmount', () => {
  it('should validate 100', () => {
    expect(validateAmount(100).valid).toBe(true);
  });

  it('should fail on 0', () => {
    expect(validateAmount(0).valid).toBe(false);
  });

  it('should fail on -5', () => {
    expect(validateAmount(-5).valid).toBe(false);
  });

  it('should fail on 1.5 (floats)', () => {
    expect(validateAmount(1.5).valid).toBe(false);
  });

  it('should validate 150000', () => {
    expect(validateAmount(150000).valid).toBe(true);
  });

  it('should fail on 150001 (exceeds max)', () => {
    expect(validateAmount(150001).valid).toBe(false);
  });

  it('should fail on string "abc"', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(validateAmount('abc' as any).valid).toBe(false);
  });

  it('should fail on null or undefined', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(validateAmount(null as any).valid).toBe(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(validateAmount(undefined as any).valid).toBe(false);
  });
});

describe('validateWebhookUrl', () => {
  it('should validate a valid https URL', () => {
    expect(validateWebhookUrl('https://example.com/webhook').valid).toBe(true);
  });

  it('should fail on http URL', () => {
    expect(validateWebhookUrl('http://example.com/webhook').valid).toBe(false);
  });

  it('should fail on localhost URL', () => {
    expect(validateWebhookUrl('https://localhost/webhook').valid).toBe(false);
    expect(validateWebhookUrl('https://127.0.0.1/webhook').valid).toBe(false);
  });

  it('should fail on malformed string', () => {
    expect(validateWebhookUrl('not-a-url').valid).toBe(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(validateWebhookUrl(null as any).valid).toBe(false);
  });
});
