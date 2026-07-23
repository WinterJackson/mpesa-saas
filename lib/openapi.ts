import { z } from 'zod';
import {
  paymentInitiateRequestSchema,
  paymentInitiateDataSchema,
  paymentStatusDataSchema,
  payoutCreateRequestSchema,
  payoutCreateDataSchema,
  refundCreateRequestSchema,
  refundCreateDataSchema,
  transactionResourceSchema,
  transactionListDataSchema,
} from '@/lib/schemas';

/**
 * OpenAPI 3.1 description of the FROZEN PaySwift public API (`/api/v1`).
 *
 * Contract-freeze policy: `/api/v1` is stable. Backwards-incompatible changes
 * (removing/renaming a field, tightening validation, changing status codes) go
 * to a new `/api/v2` — never mutate v1 in place. Additive, optional fields are
 * allowed. This doc is the source of truth surfaced at GET /api/v1/openapi.json
 * and rendered at /docs.
 *
 * Component schemas are generated from the same Zod schemas the routes validate
 * with (lib/schemas/*), so the docs can never silently drift from enforcement.
 */

// draft-2020-12 is the JSON Schema dialect OpenAPI 3.1 uses. `io:'input'` renders
// the pre-transform shape for request bodies (phone/amount normalizers).
function toSchema(schema: z.ZodType, io: 'input' | 'output' = 'output') {
  const json = z.toJSONSchema(schema, { io, target: 'draft-2020-12', unrepresentable: 'any' }) as Record<string, unknown>;
  delete json.$schema;
  return json;
}

const bearerNote = 'All /api/v1 endpoints authenticate with your secret API key in the `x-api-key` header.';

function successEnvelope(dataRef: string) {
  return {
    type: 'object',
    properties: { success: { const: true }, data: { $ref: `#/components/schemas/${dataRef}` } },
    required: ['success', 'data'],
  };
}

const idempotencyHeader = {
  name: 'Idempotency-Key',
  in: 'header',
  required: false,
  schema: { type: 'string' },
  description: 'Cache-and-replay key. Strongly recommended on money-movement endpoints so retries never double-execute.',
};

const jsonBody = (ref: string) => ({
  required: true,
  content: { 'application/json': { schema: { $ref: `#/components/schemas/${ref}` } } },
});

const jsonResponse = (dataRef: string, description: string) => ({
  description,
  content: { 'application/json': { schema: successEnvelope(dataRef) } },
});

const errorResponse = (description: string) => ({
  description,
  content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
});

const commonErrors = {
  '400': errorResponse('Validation error'),
  '401': errorResponse('Missing or invalid API key'),
  '403': errorResponse('API key lacks the required scope'),
  '429': errorResponse('Rate limit exceeded'),
  '500': errorResponse('Internal server error'),
};

export function buildOpenApiDocument() {
  return {
    openapi: '3.1.0',
    info: {
      title: 'PaySwift API',
      version: '1.0.0',
      description:
        `PaySwift lets you collect and send M-Pesa payments. ${bearerNote}\n\n` +
        'Prefer no code? Create a Payment Link in the dashboard and share the hosted checkout — no integration required.',
    },
    servers: [{ url: '/', description: 'This PaySwift instance' }],
    security: [{ ApiKeyAuth: [] }],
    tags: [
      { name: 'Payments', description: 'Collect money from customers (STK Push).' },
      { name: 'Payouts', description: 'Send money to customers (B2C).' },
      { name: 'Refunds', description: 'Refund a completed transaction.' },
      { name: 'C2B', description: 'Register C2B validation/confirmation URLs.' },
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: { type: 'apiKey', in: 'header', name: 'x-api-key' },
      },
      schemas: {
        ErrorResponse: {
          type: 'object',
          properties: { success: { const: false }, error: { type: 'string' } },
          required: ['success', 'error'],
        },
        PaymentInitiateRequest: toSchema(paymentInitiateRequestSchema, 'input'),
        PaymentInitiateData: toSchema(paymentInitiateDataSchema),
        PaymentStatusData: toSchema(paymentStatusDataSchema),
        PayoutCreateRequest: toSchema(payoutCreateRequestSchema, 'input'),
        PayoutCreateData: toSchema(payoutCreateDataSchema),
        RefundCreateRequest: toSchema(refundCreateRequestSchema, 'input'),
        RefundCreateData: toSchema(refundCreateDataSchema),
        Transaction: toSchema(transactionResourceSchema),
        TransactionListData: toSchema(transactionListDataSchema),
      },
    },
    paths: {
      '/api/v1/payments/initiate': {
        post: {
          tags: ['Payments'],
          summary: 'Initiate an STK Push payment',
          operationId: 'initiatePayment',
          parameters: [idempotencyHeader],
          requestBody: jsonBody('PaymentInitiateRequest'),
          responses: {
            '201': jsonResponse('PaymentInitiateData', 'Payment initiated; STK Push sent'),
            ...commonErrors,
            '502': errorResponse('Payment gateway (Daraja) error'),
          },
        },
      },
      '/api/v1/payments/status/{id}': {
        get: {
          tags: ['Payments'],
          summary: 'Get a payment status',
          operationId: 'getPaymentStatus',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            '200': jsonResponse('PaymentStatusData', 'Current transaction status'),
            '401': commonErrors['401'],
            '404': errorResponse('Transaction not found'),
            '500': commonErrors['500'],
          },
        },
      },
      '/api/v1/transactions': {
        get: {
          tags: ['Payments'],
          summary: 'List transactions (cursor-paginated)',
          operationId: 'listTransactions',
          parameters: [
            { name: 'cursor', in: 'query', required: false, schema: { type: 'string' }, description: 'Opaque cursor from a previous page (nextCursor).' },
            { name: 'limit', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 100 } },
            { name: 'status', in: 'query', required: false, schema: { type: 'string' } },
            { name: 'environment', in: 'query', required: false, schema: { type: 'string', enum: ['sandbox', 'live'] } },
          ],
          responses: {
            '200': jsonResponse('TransactionListData', 'A page of transactions'),
            '401': commonErrors['401'],
            '429': commonErrors['429'],
            '500': commonErrors['500'],
          },
        },
      },
      '/api/v1/payouts': {
        post: {
          tags: ['Payouts'],
          summary: 'Send a B2C payout',
          operationId: 'createPayout',
          parameters: [idempotencyHeader],
          requestBody: jsonBody('PayoutCreateRequest'),
          responses: {
            '201': jsonResponse('PayoutCreateData', 'Payout accepted; pending confirmation'),
            ...commonErrors,
            '502': errorResponse('Payment gateway (Daraja) error'),
          },
        },
      },
      '/api/v1/refunds': {
        post: {
          tags: ['Refunds'],
          summary: 'Refund a completed transaction',
          operationId: 'createRefund',
          parameters: [idempotencyHeader],
          requestBody: jsonBody('RefundCreateRequest'),
          responses: {
            '201': jsonResponse('RefundCreateData', 'Refund accepted; pending confirmation'),
            ...commonErrors,
            '404': errorResponse('Transaction not found'),
            '502': errorResponse('Payment gateway (Daraja) error'),
          },
        },
      },
      '/api/v1/c2b/register-urls': {
        post: {
          tags: ['C2B'],
          summary: 'Register C2B validation/confirmation URLs',
          operationId: 'registerC2bUrls',
          responses: {
            '200': {
              description: 'URLs registered',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { const: true },
                      data: { type: 'object', properties: { responseDescription: { type: 'string' } } },
                    },
                    required: ['success', 'data'],
                  },
                },
              },
            },
            '401': commonErrors['401'],
            '403': commonErrors['403'],
            '500': commonErrors['500'],
          },
        },
      },
    },
  };
}
