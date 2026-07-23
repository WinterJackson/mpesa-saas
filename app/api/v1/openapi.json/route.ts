import { NextResponse } from 'next/server';
import { buildOpenApiDocument } from '@/lib/openapi';

/**
 * GET /api/v1/openapi.json — the machine-readable OpenAPI 3.1 spec for the
 * frozen public API. Served publicly (no auth) so it can power /docs, client
 * SDK generation, and Postman/Insomnia imports.
 */
export function GET() {
  return NextResponse.json(buildOpenApiDocument(), {
    headers: { 'Cache-Control': 'public, max-age=300' },
  });
}
