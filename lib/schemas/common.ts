import { z } from 'zod';
import { validatePhone, validateAmount } from '@/lib/validation';

/**
 * Shared Zod building blocks for the API contract. Phone and amount reuse the
 * canonical validators in lib/validation.ts as normalizers (single source of
 * truth for the M-Pesa rules), so a schema.safeParse both validates AND returns
 * the sanitized value (2547XXXXXXXX phone, integer KES amount) ready for the
 * domain layer. Kept transform-light so Zod 4's z.toJSONSchema() (Stage 6) can
 * render clean request schemas from these.
 */

/** Kenyan M-Pesa phone → normalized to 2547XXXXXXXX (rejects anything invalid). */
export const phoneSchema = z
  .string({ message: 'Phone number is required' })
  .transform((val, ctx) => {
    const result = validatePhone(val);
    if (!result.valid) {
      ctx.addIssue({ code: 'custom', message: result.error! });
      return z.NEVER;
    }
    return result.sanitized!;
  })
  .meta({ description: 'Customer M-Pesa number (07XXXXXXXX, 2547XXXXXXXX, or +2547XXXXXXXX)' });

/** M-Pesa amount → validated integer KES within Safaricom's 1–150,000 bounds. */
export const amountSchema = z
  .union([z.number(), z.string()])
  .transform((val, ctx) => {
    const result = validateAmount(val);
    if (!result.valid) {
      ctx.addIssue({ code: 'custom', message: result.error! });
      return z.NEVER;
    }
    return result.sanitized!;
  })
  .meta({ description: 'Amount in whole KES shillings (1–150000)' });

/** The first human-readable issue message from a failed parse (envelope-friendly). */
export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Invalid request';
}

export type ParseResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** Validate an already-parsed JSON value against a schema, returning the first
 *  issue message on failure — the one entry point routes call. */
export function parseWith<T>(schema: z.ZodType<T>, raw: unknown): ParseResult<T> {
  const result = schema.safeParse(raw);
  if (!result.success) return { ok: false, error: firstIssue(result.error) };
  return { ok: true, data: result.data };
}

// ── Shared response fragments (documented in OpenAPI) ────────────────────────

export const errorResponseSchema = z
  .object({ success: z.literal(false), error: z.string() });

/** Wraps a data schema in the platform's { success: true, data } envelope. */
export function successResponse<T extends z.ZodType>(data: T) {
  return z.object({ success: z.literal(true), data });
}
