// ─── Phone Validation ────────────────────────────────────────────────────────

/**
 * Validates and normalizes a Kenyan phone number to the Daraja-required 2547XXXXXXXX format.
 *
 * Accepts:
 * - International format: +254712345678, 254712345678
 * - Local format: 0712345678
 * - Short format: 712345678
 *
 * Strips the + prefix and all non-numeric characters before validation.
 */
export function validatePhone(phone: string): { valid: boolean; error?: string; sanitized?: string } {
  if (!phone || typeof phone !== 'string') {
    return { valid: false, error: 'Phone number is required' };
  }

  // Strip all non-numeric characters (handles +254..., spaces, dashes, etc.)
  let sanitized = phone.replace(/\D/g, '');

  // 0712345678 → 254712345678
  if (sanitized.startsWith('0') && sanitized.length === 10) {
    sanitized = `254${sanitized.substring(1)}`;
  }

  // 712345678 → 254712345678
  if (sanitized.length === 9 && !sanitized.startsWith('0')) {
    sanitized = `254${sanitized}`;
  }

  // Final validation: must be exactly 12 digits starting with 254
  if (!/^254\d{9}$/.test(sanitized)) {
    return { valid: false, error: 'Invalid Kenyan phone number. Expected format: 2547XXXXXXXX, 07XXXXXXXX, or +2547XXXXXXXX.' };
  }

  return { valid: true, sanitized };
}

// ─── Amount Validation ───────────────────────────────────────────────────────

/**
 * Validates the M-Pesa transaction amount.
 *
 * Rules:
 * - Must be a positive integer (M-Pesa does not support decimals)
 * - Minimum: KES 1 (enforced by Safaricom)
 * - Maximum: KES 150,000 (M-Pesa per-transaction limit)
 */
export function validateAmount(amount: unknown): { valid: boolean; error?: string; sanitized?: number } {
  const parsed = Number(amount);

  if (amount === null || amount === undefined || amount === '') {
    return { valid: false, error: 'Amount is required' };
  }

  if (isNaN(parsed)) {
    return { valid: false, error: 'Amount must be a number' };
  }

  if (!Number.isInteger(parsed)) {
    return { valid: false, error: 'Amount must be a whole number (M-Pesa does not support decimals)' };
  }

  if (parsed < 1) {
    return { valid: false, error: 'Minimum transaction amount is KES 1' };
  }

  if (parsed > 150_000) {
    return { valid: false, error: 'Amount exceeds M-Pesa transaction limit of KES 150,000' };
  }

  return { valid: true, sanitized: parsed };
}

// ─── Webhook URL Validation ──────────────────────────────────────────────────

/**
 * Validates a webhook URL to ensure it's a valid HTTPS endpoint.
 * Merchants must provide HTTPS URLs for webhook delivery security.
 */
export function validateWebhookUrl(url: string): { valid: boolean; error?: string; sanitized?: string } {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'Webhook URL is required' };
  }

  try {
    const parsedUrl = new URL(url);

    if (parsedUrl.protocol !== 'https:') {
      return { valid: false, error: 'Webhook URL must use HTTPS' };
    }

    // Reject localhost/private IPs in production for security
    const hostname = parsedUrl.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0') {
      return { valid: false, error: 'Webhook URL cannot point to localhost' };
    }

    return { valid: true, sanitized: parsedUrl.toString() };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}
