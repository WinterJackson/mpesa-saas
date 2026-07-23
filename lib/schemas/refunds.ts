import { z } from 'zod';
import { amountSchema, successResponse } from './common';

export const refundCreateRequestSchema = z
  .object({
    transactionId: z.string({ message: 'transactionId is required' }).min(1, 'transactionId is required'),
    // Optional partial amount; defaults to the full transaction amount in the
    // route. The ceiling (must not exceed the original) is a domain check that
    // stays in the route since it needs the looked-up transaction.
    amount: amountSchema.optional(),
    reason: z
      .string()
      .optional()
      .nullable()
      .transform((v) => (v ? v.substring(0, 100) : null)),
  })
  .meta({ id: 'RefundCreateRequest' });

export type RefundCreateRequest = z.infer<typeof refundCreateRequestSchema>;

export const refundCreateDataSchema = z
  .object({
    refundId: z.string(),
    status: z.string(),
    amount: z.number(),
    conversationId: z.string().nullable(),
    originatorConversationId: z.string().nullable(),
  })
  .meta({ id: 'RefundCreateData' });

export const refundCreateResponseSchema = successResponse(refundCreateDataSchema);
