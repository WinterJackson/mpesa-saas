import { z } from 'zod';
import { phoneSchema, amountSchema, successResponse } from './common';

export const B2C_COMMANDS = ['BusinessPayment', 'SalaryPayment', 'PromotionPayment'] as const;

export const payoutCreateRequestSchema = z
  .object({
    phone: phoneSchema,
    amount: amountSchema,
    commandId: z.enum(B2C_COMMANDS, { message: `commandId must be one of: ${B2C_COMMANDS.join(', ')}` }).optional(),
    remarks: z
      .string()
      .optional()
      .nullable()
      .transform((v) => (v ? v.substring(0, 100) : null)),
    occasion: z
      .string()
      .optional()
      .nullable()
      .transform((v) => (v ? v.substring(0, 100) : null)),
  })
  .meta({ id: 'PayoutCreateRequest' });

export type PayoutCreateRequest = z.infer<typeof payoutCreateRequestSchema>;

export const payoutCreateDataSchema = z
  .object({
    payoutId: z.string(),
    status: z.string(),
    conversationId: z.string().nullable(),
    originatorConversationId: z.string().nullable(),
  })
  .meta({ id: 'PayoutCreateData' });

export const payoutCreateResponseSchema = successResponse(payoutCreateDataSchema);
