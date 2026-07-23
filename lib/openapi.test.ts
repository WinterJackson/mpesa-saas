import { describe, it, expect } from 'vitest';
import { buildOpenApiDocument } from './openapi';

describe('buildOpenApiDocument', () => {
  const doc = buildOpenApiDocument();

  it('is a valid OpenAPI 3.1 document with the frozen v1 paths', () => {
    expect(doc.openapi).toBe('3.1.0');
    expect(doc.paths['/api/v1/payments/initiate']).toBeDefined();
    expect(doc.paths['/api/v1/payouts']).toBeDefined();
    expect(doc.paths['/api/v1/transactions']).toBeDefined();
  });

  it('generates request component schemas from the Zod schemas (input side)', () => {
    const req = doc.components.schemas.PaymentInitiateRequest as Record<string, unknown>;
    expect(req.type).toBe('object');
    expect((req.properties as Record<string, unknown>).phone).toBeDefined();
    expect((req.properties as Record<string, unknown>).amount).toBeDefined();
  });

  it('declares the x-api-key security scheme', () => {
    expect(doc.components.securitySchemes.ApiKeyAuth).toEqual({ type: 'apiKey', in: 'header', name: 'x-api-key' });
  });

  it('emits no leftover $schema or $defs keys (clean for OpenAPI tooling)', () => {
    const s = JSON.stringify(doc);
    expect(s.includes('"$schema"')).toBe(false);
    expect(s.includes('$defs')).toBe(false);
  });
});
