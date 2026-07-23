import { z } from 'zod';
import { phoneSchema, successResponse } from './common';

/**
 * Public hosted-checkout initiate body (POST /api/pay/[slug]/initiate). Only the
 * phone is validated here. Amount is intentionally NOT range-checked at the
 * schema level: fixed links ignore any client amount entirely, and customer_set
 * links validate it in the route (where the link type is known). Accepting it
 * loosely here keeps a stray amount on a fixed link from wrongly 400-ing.
 */
export const payLinkInitiateRequestSchema = z
  .object({
    phone: phoneSchema,
    amount: z.union([z.number(), z.string()]).optional(),
  });

export type PayLinkInitiateRequest = z.infer<typeof payLinkInitiateRequestSchema>;

export const payLinkInitiateDataSchema = z
  .object({
    transactionId: z.string(),
    checkoutRequestId: z.string().nullable(),
    status: z.string(),
    customerMessage: z.string(),
  });

export const payLinkInitiateResponseSchema = successResponse(payLinkInitiateDataSchema);

export const payLinkStatusDataSchema = z
  .object({
    transactionId: z.string(),
    status: z.string(),
    mpesaReceipt: z.string().nullable(),
    resultDesc: z.string().nullable(),
  });

export const payLinkStatusResponseSchema = successResponse(payLinkStatusDataSchema);
