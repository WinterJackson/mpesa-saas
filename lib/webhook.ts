import { createHmac } from 'node:crypto';

// ─── Webhook Delivery ────────────────────────────────────────────────────────

/**
 * Delivers a webhook payload to the specified merchant URL.
 *
 * Security:
 * - Enforces a 5-second timeout via AbortController
 * - Attaches an HMAC-SHA256 signature header (x-payswift-signature) when a secret key is provided,
 *   allowing merchants to verify payload authenticity and integrity
 * - All errors are logged server-side but never propagated to the caller
 *
 * Execution model:
 * - This function is awaited directly (NOT wrapped in setTimeout) because
 *   Vercel's serverless functions terminate after the response is sent,
 *   which would kill any queued setTimeout callbacks.
 * - The caller should use `void deliverWebhook(...)` if fire-and-forget semantics are needed
 *   within a request handler that has already sent its response.
 */
export async function deliverWebhook(
  url: string,
  payload: Record<string, unknown>,
  secretKey?: string,
): Promise<{ delivered: boolean; statusCode?: number }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5_000);

  try {
    const payloadString = JSON.stringify(payload);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'PaySwift-Webhook/1.0',
    };

    // Generate HMAC-SHA256 signature so merchants can verify the payload
    if (secretKey) {
      const hmac = createHmac('sha256', secretKey);
      hmac.update(payloadString);
      headers['x-payswift-signature'] = hmac.digest('hex');
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: payloadString,
      signal: controller.signal as AbortSignal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`[Webhook] Delivery failed to ${url}: HTTP ${response.status}`);
      return { delivered: false, statusCode: response.status };
    }

    console.log(`[Webhook] Successfully delivered to ${url}: HTTP ${response.status}`);
    return { delivered: true, statusCode: response.status };
  } catch (error: unknown) {
    clearTimeout(timeoutId);

    if (error instanceof DOMException && error.name === 'AbortError') {
      console.error(`[Webhook] Delivery to ${url} timed out after 5 seconds`);
    } else {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[Webhook] Delivery error for ${url}:`, message);
    }

    return { delivered: false };
  }
}
