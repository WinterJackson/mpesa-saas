import type { Payout, Refund } from '@prisma/client';
import { sendEmail, isEmailConfigured } from '@/lib/email/client';
import { resolveOrgRecipients, resolveStaffRecipients } from '@/lib/email/recipients';
import * as t from '@/lib/email/templates';
import { logger } from '@/lib/logger';

/**
 * High-level notification API — the ONLY thing business code (routes,
 * finalizers, crons) should call to send a business-workflow email. Each
 * function resolves recipients, renders a template, and sends, all wrapped so
 * it can NEVER throw into the caller. Safe to `void notify...()` or `await` it;
 * it also short-circuits instantly when email isn't configured.
 *
 * Reminder: identity/auth emails (password, verification, team invites) are
 * Clerk's — nothing here overlaps them.
 */

async function safe(label: string, fn: () => Promise<unknown>): Promise<void> {
  if (!isEmailConfigured()) return;
  try {
    await fn();
  } catch (err: unknown) {
    logger.error(`[email] ${label} notification failed`, err);
  }
}

async function sendToOrg(
  organizationId: string,
  build: (businessName: string) => t.RenderedEmail,
  tag: string,
  roles?: readonly string[]
): Promise<void> {
  const recipients = await resolveOrgRecipients(organizationId, roles);
  if (!recipients || recipients.emails.length === 0) return;
  const email = build(recipients.businessName);
  await sendEmail({
    to: recipients.emails,
    subject: email.subject,
    html: email.html,
    text: email.text,
    tags: [{ name: 'type', value: tag }],
  });
}

async function sendToStaff(email: t.RenderedEmail, tag: string, capability?: Parameters<typeof resolveStaffRecipients>[0]): Promise<void> {
  const emails = await resolveStaffRecipients(capability);
  if (emails.length === 0) return;
  await sendEmail({ to: emails, subject: email.subject, html: email.html, text: email.text, tags: [{ name: 'type', value: tag }] });
}

// ─── Onboarding ──────────────────────────────────────────────────────────────

export function notifyWelcome(organizationId: string): Promise<void> {
  return safe('welcome', () => sendToOrg(organizationId, (name) => t.welcomeEmail(name), 'welcome'));
}

// ─── KYC ─────────────────────────────────────────────────────────────────────

export function notifyKycSubmitted(organizationId: string, documentType: string): Promise<void> {
  return safe('kyc_submitted', async () => {
    await sendToOrg(organizationId, (name) => t.kycSubmittedEmail(name), 'kyc_submitted');
    const recipients = await resolveOrgRecipients(organizationId);
    if (recipients) {
      await sendToStaff(t.staffNewKycEmail({ businessName: recipients.businessName, documentType }), 'staff_kyc', 'kyc:review');
    }
  });
}

export function notifyKycApproved(organizationId: string): Promise<void> {
  return safe('kyc_approved', () => sendToOrg(organizationId, (name) => t.kycApprovedEmail(name), 'kyc_approved'));
}

export function notifyKycRejected(organizationId: string, reason?: string): Promise<void> {
  return safe('kyc_rejected', () => sendToOrg(organizationId, (name) => t.kycRejectedEmail(name, reason), 'kyc_rejected'));
}

// ─── Go-live ─────────────────────────────────────────────────────────────────

export function notifyGoLiveRequested(organizationId: string): Promise<void> {
  return safe('go_live_requested', async () => {
    const recipients = await resolveOrgRecipients(organizationId);
    if (recipients) {
      await sendToStaff(t.staffGoLiveRequestedEmail(recipients.businessName), 'staff_go_live', 'org:golive');
    }
  });
}

export function notifyGoLiveApproved(organizationId: string): Promise<void> {
  return safe('go_live_approved', () => sendToOrg(organizationId, (name) => t.goLiveApprovedEmail(name), 'go_live_approved'));
}

// ─── Payouts / refunds ───────────────────────────────────────────────────────

export function notifyPayoutConcluded(payout: Payout): Promise<void> {
  return safe('payout', () =>
    sendToOrg(
      payout.organizationId,
      (name) =>
        payout.status === 'completed'
          ? t.payoutCompletedEmail({ businessName: name, amount: payout.amount, phone: payout.phone, receipt: payout.mpesaReceipt })
          : t.payoutFailedEmail({ businessName: name, amount: payout.amount, phone: payout.phone, reason: payout.resultDesc }),
      payout.status === 'completed' ? 'payout_completed' : 'payout_failed'
    )
  );
}

export function notifyRefundConcluded(refund: Refund): Promise<void> {
  // Only the terminal, successful refund gets a merchant email; a failed refund
  // surfaces via the dashboard/webhook, not a customer-facing "refund done".
  if (refund.status !== 'completed') return Promise.resolve();
  return safe('refund', () =>
    sendToOrg(refund.organizationId, (name) => t.refundCompletedEmail({ businessName: name, amount: refund.amount, receipt: refund.mpesaReceipt }), 'refund_completed')
  );
}

// ─── Billing ─────────────────────────────────────────────────────────────────

export function notifyInvoiceIssued(organizationId: string, amount: number): Promise<void> {
  return safe('invoice_issued', () => sendToOrg(organizationId, (name) => t.invoiceIssuedEmail({ businessName: name, amount }), 'invoice_issued'));
}

export function notifyInvoicePaid(organizationId: string, amount: number): Promise<void> {
  return safe('invoice_paid', () => sendToOrg(organizationId, (name) => t.invoicePaidEmail({ businessName: name, amount }), 'invoice_paid'));
}

export function notifyInvoicePaymentFailed(organizationId: string, amount: number, attemptsRemaining: number): Promise<void> {
  return safe('invoice_payment_failed', () =>
    sendToOrg(organizationId, (name) => t.invoicePaymentFailedEmail({ businessName: name, amount, attemptsRemaining }), 'invoice_payment_failed'));
}

export function notifySubscriptionSuspended(organizationId: string, amount: number): Promise<void> {
  return safe('subscription_suspended', () =>
    sendToOrg(organizationId, (name) => t.subscriptionSuspendedEmail({ businessName: name, amount }), 'subscription_suspended'));
}

// ─── Security (PaySwift-owned, not Clerk auth) ───────────────────────────────

export function notifyApiKeyCreated(organizationId: string, scope: string, keyPrefix: string): Promise<void> {
  return safe('api_key_created', () => sendToOrg(organizationId, (name) => t.apiKeyCreatedEmail({ businessName: name, scope, keyPrefix }), 'api_key_created'));
}

export function notifyWebhookSecretRotated(organizationId: string): Promise<void> {
  return safe('webhook_secret_rotated', () => sendToOrg(organizationId, (name) => t.webhookSecretRotatedEmail(name), 'webhook_secret_rotated'));
}

// ─── Compliance ──────────────────────────────────────────────────────────────

export function notifyDataExportReady(organizationId: string): Promise<void> {
  return safe('data_export', () => sendToOrg(organizationId, (name) => t.dataExportReadyEmail(name), 'data_export'));
}

export function notifyDataDeletionRequested(organizationId: string): Promise<void> {
  return safe('data_deletion', () => sendToOrg(organizationId, (name) => t.dataDeletionRequestedEmail(name), 'data_deletion', ['owner']));
}

// ─── Internal ops ────────────────────────────────────────────────────────────

export function notifyReconciliationMismatches(count: number): Promise<void> {
  if (count <= 0) return Promise.resolve();
  return safe('reconciliation', () => sendToStaff(t.staffReconciliationEmail({ count }), 'staff_reconciliation', 'recon:resolve'));
}
