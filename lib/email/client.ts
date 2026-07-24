import { Resend } from 'resend';
import { logger } from '@/lib/logger';

/**
 * The single Resend entry point (mirrors lib/webhook.ts / lib/idempotency.ts:
 * one module, one client, fail-open).
 *
 * Hard rules:
 *  - Business-workflow email ONLY. Clerk owns every identity/auth email
 *    (password reset, verification, sign-in, org/team invitations) — this layer
 *    never touches those.
 *  - Fails OPEN and NEVER throws. If RESEND_API_KEY is unset (local dev, or a
 *    deployment that hasn't configured it) every send is a no-op. If Resend is
 *    down or rejects, we log (masked) and move on. Email must never block a
 *    request path — least of all money movement.
 *  - PII-safe logging: we log a masked recipient + subject + tags, never the
 *    full address and never the rendered body.
 */

let _client: Resend | null = null;

function getClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  if (!_client) _client = new Resend(apiKey);
  return _client;
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

// onboarding@resend.dev is Resend's shared sandbox sender; it only delivers to
// the account owner, so it's a safe non-crashing default that makes a missing
// EMAIL_FROM obvious in logs rather than silently mis-sending.
function fromAddress(): string {
  return process.env.EMAIL_FROM || 'PaySwift <onboarding@resend.dev>';
}

/** Masks an email for logs: jane.doe@acme.com -> j***@acme.com */
export function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at <= 0) return '***';
  const first = email[0];
  const domain = email.slice(at + 1);
  return `${first}***@${domain}`;
}

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  /** Resend tags for analytics/filtering — values must be ASCII, no PII. */
  tags?: { name: string; value: string }[];
}

export interface SendEmailResult {
  delivered: boolean;
  /** true when skipped because email is not configured (not an error). */
  skipped?: boolean;
  id?: string;
  error?: string;
}

/**
 * Low-level send. Prefer the high-level notify* helpers in
 * lib/email/notifications.ts — they resolve recipients and render templates.
 * This never rejects; callers can ignore the returned promise.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const recipients = Array.isArray(input.to) ? input.to : [input.to];
  const masked = recipients.map(maskEmail).join(', ');

  const client = getClient();
  if (!client) {
    logger.debug(`[email] skipped (RESEND_API_KEY unset) subject="${input.subject}" to=${masked}`);
    return { delivered: false, skipped: true };
  }

  // Drop obviously invalid recipients rather than handing Resend garbage.
  const valid = recipients.filter((r) => typeof r === 'string' && r.includes('@'));
  if (valid.length === 0) {
    logger.warn(`[email] no valid recipient for subject="${input.subject}"`);
    return { delivered: false, error: 'no valid recipient' };
  }

  try {
    const { data, error } = await client.emails.send({
      from: fromAddress(),
      to: valid,
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo: input.replyTo || process.env.EMAIL_REPLY_TO,
      tags: input.tags,
    });

    if (error) {
      logger.error(`[email] send failed subject="${input.subject}" to=${masked}: ${error.message}`);
      return { delivered: false, error: error.message };
    }

    logger.info(`[email] sent subject="${input.subject}" to=${masked} id=${data?.id ?? 'n/a'}`);
    return { delivered: true, id: data?.id };
  } catch (err: unknown) {
    // Total fail-open: a thrown Resend/network error must not propagate.
    const message = err instanceof Error ? err.message : 'Unknown email error';
    logger.error(`[email] send threw subject="${input.subject}" to=${masked}: ${message}`);
    return { delivered: false, error: message };
  }
}
