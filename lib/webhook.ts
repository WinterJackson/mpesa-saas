import { createHmac } from 'node:crypto';
import { logger } from '@/lib/logger';
import { withApiSpan } from '@/lib/tracing';

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
  extraHeaders?: Record<string, string>,
  maxAttempts: number = 3,
  organizationId?: string | null,
): Promise<{ delivered: boolean; statusCode?: number; attempts: number }> {
  return withApiSpan('webhook.deliver', 'http.client', organizationId, async () => {
    const payloadString = JSON.stringify(payload);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'PaySwift-Webhook/1.0',
      ...(extraHeaders || {}),
    };

    // Generate HMAC-SHA256 signature so merchants can verify the payload
    if (secretKey) {
      const hmac = createHmac('sha256', secretKey);
      hmac.update(payloadString);
      headers['x-payswift-signature'] = hmac.digest('hex');
    }

    let attempts = 0;
    let lastStatusCode: number | undefined;

    while (attempts < maxAttempts) {
      attempts++;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5_000);

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: payloadString,
          signal: controller.signal as AbortSignal,
        });

        clearTimeout(timeoutId);
        lastStatusCode = response.status;

        if (response.ok) {
          logger.info(`[Webhook] Successfully delivered to ${url} (Attempt ${attempts}): HTTP ${response.status}`);
          return { delivered: true, statusCode: response.status, attempts };
        }

        logger.warn(`[Webhook] Delivery failed to ${url} (Attempt ${attempts}): HTTP ${response.status}`);

        // Do NOT retry on 4xx (merchant endpoint issue)
        if (response.status >= 400 && response.status < 500) {
          return { delivered: false, statusCode: response.status, attempts };
        }
      } catch (error: unknown) {
        clearTimeout(timeoutId);

        if (error instanceof DOMException && error.name === 'AbortError') {
          logger.warn(`[Webhook] Delivery to ${url} timed out after 5 seconds (Attempt ${attempts})`);
        } else {
          const message = error instanceof Error ? error.message : 'Unknown error';
          logger.warn(`[Webhook] Delivery error for ${url} (Attempt ${attempts}):`, message);
        }
      }

      if (attempts < maxAttempts) {
        const delayMs = attempts === 1 ? 1000 : 3000;
        logger.info(`[Webhook] Retrying ${url} in ${delayMs}ms...`);
        await new Promise(r => setTimeout(r, delayMs));
      }
    }

    logger.error(`[Webhook] Exhausted ${maxAttempts} attempts for ${url}`);
    return { delivered: false, statusCode: lastStatusCode, attempts };
  });
}
