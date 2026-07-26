import type { Payout, Refund } from '@prisma/client';
import { sendEmail, isEmailConfigured } from '@/lib/email/client';
import { resolveOrgRecipients, resolveStaffRecipients } from '@/lib/email/recipients';
import * as t from '@/lib/email/templates';
import { recordNotification } from '@/lib/inapp-notify';
import { logger } from '@/lib/logger';

/** Small money formatter for in-app notification bodies (no email dependency). */
function kesText(amount: number): string {
  return `KES ${Number(amount).toLocaleString('en-KE')}`;
}

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
  recordNotification({ organizationId, type: 'kyc.approved', title: 'KYC approved', body: 'Your business is verified. You can now request go-live to accept real payments.', href: '/settings/kyc' });
  return safe('kyc_approved', () => sendToOrg(organizationId, (name) => t.kycApprovedEmail(name), 'kyc_approved'));
}

export function notifyKycRejected(organizationId: string, reason?: string): Promise<void> {
  recordNotification({ organizationId, type: 'kyc.rejected', title: 'KYC needs attention', body: reason ? `Your verification was not approved: ${reason}` : 'Your verification was not approved. Please re-upload your documents.', href: '/settings/kyc' });
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
  recordNotification({ organizationId, type: 'golive.approved', title: 'You’re approved to go live', body: 'Your account can now accept real M-Pesa payments. Switch to live mode in Settings.', href: '/settings' });
  return safe('go_live_approved', () => sendToOrg(organizationId, (name) => t.goLiveApprovedEmail(name), 'go_live_approved'));
}

// ─── Payouts / refunds ───────────────────────────────────────────────────────

export function notifyPayoutConcluded(payout: Payout): Promise<void> {
  recordNotification({
    organizationId: payout.organizationId,
    type: payout.status === 'completed' ? 'payout.completed' : 'payout.failed',
    title: payout.status === 'completed' ? 'Payout completed' : 'Payout failed',
    body: payout.status === 'completed'
      ? `${kesText(payout.amount)} was sent successfully.`
      : `Your ${kesText(payout.amount)} payout didn’t go through${payout.resultDesc ? `: ${payout.resultDesc}` : '.'}`,
    href: '/payouts',
  });
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
  recordNotification({
    organizationId: refund.organizationId,
    type: refund.status === 'completed' ? 'refund.completed' : 'refund.failed',
    title: refund.status === 'completed' ? 'Refund completed' : 'Refund failed',
    body: refund.status === 'completed'
      ? `${kesText(refund.amount)} was refunded to your customer.`
      : `A ${kesText(refund.amount)} refund didn’t go through${refund.resultDesc ? `: ${refund.resultDesc}` : '.'}`,
    href: '/payouts',
  });
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
  recordNotification({ organizationId, type: 'invoice.paid', title: 'Subscription paid', body: `Your ${kesText(amount)} subscription payment was received. Thank you!`, href: '/billing' });
  return safe('invoice_paid', () => sendToOrg(organizationId, (name) => t.invoicePaidEmail({ businessName: name, amount }), 'invoice_paid'));
}

export function notifyInvoicePaymentFailed(organizationId: string, amount: number, attemptsRemaining: number): Promise<void> {
  recordNotification({ organizationId, type: 'invoice.failed', title: 'Subscription payment failed', body: `We couldn’t collect your ${kesText(amount)} subscription payment. Pay now from Billing to keep your account active.`, href: '/billing' });
  return safe('invoice_payment_failed', () =>
    sendToOrg(organizationId, (name) => t.invoicePaymentFailedEmail({ businessName: name, amount, attemptsRemaining }), 'invoice_payment_failed'));
}

export function notifySubscriptionSuspended(organizationId: string, amount: number): Promise<void> {
  recordNotification({ organizationId, type: 'subscription.suspended', title: 'Subscription paused', body: `Your subscription was paused after an unpaid ${kesText(amount)} invoice. Pay now to restore full access.`, href: '/billing' });
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

export function notifyLowBalance(organizationId: string, balanceKes: number, thresholdKes: number): Promise<void> {
  // 'balance.low' has no matching prefix in categoryForNotificationType — this is
  // deliberate (see notification-preferences.ts): a merchant must never be able to
  // silence the one alert that tells them payouts are about to start failing.
  recordNotification({
    organizationId,
    type: 'balance.low',
    title: 'Low shortcode balance',
    body: `Your working balance is ${kesText(balanceKes)}, below your ${kesText(thresholdKes)} threshold. Payouts and refunds may fail.`,
    href: '/payouts',
  });
  return safe('low_balance', async () => {
    const recipients = await resolveOrgRecipients(organizationId);
    if (recipients) {
      await sendToOrg(organizationId, (name) => t.lowBalanceAlertEmail({ businessName: name, balanceKes, thresholdKes }), 'low_balance');
      await sendToStaff(t.staffLowBalanceAlertEmail({ businessName: recipients.businessName, balanceKes }), 'staff_low_balance', 'alerts:manage');
    }
  });
}

// ─── Platform admin invites ───────────────────────────────────────────────────
// These target a single explicit recipient (the invited email), not org/staff
// resolution. This is an internal STAFF-ACCESS notification, not a Clerk
// identity/auth email — the actual account sign-in stays entirely with Clerk.

async function sendToEmail(recipient: string, email: t.RenderedEmail, tag: string): Promise<void> {
  await sendEmail({ to: recipient, subject: email.subject, html: email.html, text: email.text, tags: [{ name: 'type', value: tag }] });
}

/** New person (no PaySwift account yet): invite them to sign up and gain admin access. */
export function notifyAdminInvited(recipient: string, role: string, acceptUrl: string): Promise<void> {
  return safe('admin_invite', () => sendToEmail(recipient, t.adminInviteEmail({ role, acceptUrl }), 'admin_invite'));
}

/** Existing PaySwift user just granted admin access — no sign-up needed. */
export function notifyAdminAccessGranted(recipient: string, role: string, adminUrl: string): Promise<void> {
  return safe('admin_access_granted', () => sendToEmail(recipient, t.adminAccessGrantedEmail({ role, adminUrl }), 'admin_access_granted'));
}
