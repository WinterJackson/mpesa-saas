import { z } from 'zod';
import { phoneSchema, amountSchema, successResponse } from './common';

export const paymentInitiateRequestSchema = z
  .object({
    phone: phoneSchema,
    amount: amountSchema,
    orderReference: z
      .string()
      .optional()
      .nullable()
      .transform((v) => (v ? v.substring(0, 50) : null)),
  })
  .meta({ id: 'PaymentInitiateRequest' });

export type PaymentInitiateRequest = z.infer<typeof paymentInitiateRequestSchema>;

export const paymentInitiateDataSchema = z
  .object({
    transactionId: z.string(),
    checkoutRequestId: z.string().nullable(),
    status: z.string(),
    merchantRequestID: z.string(),
    customerMessage: z.string(),
  })
  .meta({ id: 'PaymentInitiateData' });

export const paymentInitiateResponseSchema = successResponse(paymentInitiateDataSchema);

export const paymentStatusDataSchema = z
  .object({
    transactionId: z.string(),
    status: z.string(),
    amount: z.number(),
    phone: z.string(),
    mpesaReceipt: z.string().nullable(),
    resultCode: z.number().nullable(),
    resultDesc: z.string().nullable(),
    orderReference: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .meta({ id: 'PaymentStatusData' });

export const paymentStatusResponseSchema = successResponse(paymentStatusDataSchema);
