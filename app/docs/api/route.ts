import { ApiReference } from '@scalar/nextjs-api-reference';

// Interactive Scalar API reference for the frozen /api/v1 contract, rendered
// from the generated OpenAPI spec. Served at /docs/api and linked from the
// no-code-first docs landing at /docs.
export const GET = ApiReference({
  url: '/api/v1/openapi.json',
  metaData: {
    title: 'PaySwift API Reference',
    description: 'Collect and send M-Pesa payments with the PaySwift API.',
  },
});
