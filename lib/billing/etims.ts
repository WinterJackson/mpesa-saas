import { logger } from '@/lib/logger';

/**
 * KRA eTIMS provider seam (Stage F).
 *
 * RECOGNIZED APPROACH (from the Stage F research): a SaaS issues KRA-compliant
 * tax invoices via **OSCU** (Online Sales Control Unit) system-to-system
 * integration, in practice through a **KRA-certified third-party integrator**
 * (e.g. Slade360, Paybill.ke) rather than self-certifying. The provider validates
 * & signs each sale and returns a Control Unit invoice number, a receipt
 * signature, and QR data that must be printed on the invoice.
 *
 * This interface is that seam. Today PaySwift is NOT VAT-registered, so there is
 * no eTIMS obligation and the active provider is the NullEtimsProvider (returns
 * null → invoices render as honest interim/non-tax documents). When PaySwift
 * registers for VAT and picks a certified integrator, implement that provider
 * here and select it in getEtimsProvider(); NO call site changes.
 */

export interface EtimsInvoiceInput {
  invoiceId: string;
  /** VAT-inclusive total, whole KES. */
  totalKes: number;
  vatKes: number;
  buyerName: string;
  buyerKraPin: string | null;
  issuedAt: Date;
}

/** What KRA/eTIMS returns and we stamp onto the invoice. */
export interface EtimsStamp {
  cuInvoiceNumber: string;
  cuReceiptSignature: string;
  /** Opaque QR payload to encode on the invoice. */
  qrData: string;
}

export interface EtimsProvider {
  readonly name: string;
  /** Registers a sale with eTIMS; returns the CU stamp, or null if unavailable. */
  registerInvoice(input: EtimsInvoiceInput): Promise<EtimsStamp | null>;
}

/**
 * Interim provider used until PaySwift is VAT-registered and a certified OSCU
 * integrator is wired. Never fabricates a CU number — returns null so invoices
 * are honestly labelled as non-tax documents.
 */
class NullEtimsProvider implements EtimsProvider {
  readonly name = 'none';
  async registerInvoice(): Promise<EtimsStamp | null> {
    return null;
  }
}

let cached: EtimsProvider | null = null;

/**
 * Returns the active eTIMS provider. Currently always the NullEtimsProvider.
 * The single place to swap in a certified OSCU integrator later.
 */
export function getEtimsProvider(): EtimsProvider {
  if (cached) return cached;
  // TODO(vat): when VAT-registered, select the chosen certified OSCU provider
  // here (e.g. new Slade360EtimsProvider(env...)). Keep it env-gated + fail-safe.
  cached = new NullEtimsProvider();
  return cached;
}

/**
 * Best-effort eTIMS registration — NEVER throws. A provider outage must not block
 * issuing/serving an invoice; the CU stamp can be back-filled on retry.
 */
export async function tryRegisterWithEtims(input: EtimsInvoiceInput): Promise<EtimsStamp | null> {
  try {
    return await getEtimsProvider().registerInvoice(input);
  } catch (error) {
    logger.error('[eTIMS] registration failed', error);
    return null;
  }
}
