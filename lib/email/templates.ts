import { renderEmail, paragraph, button, infoTable, infoRow, esc, appBaseUrl } from '@/lib/email/layout';

/**
 * Canonical catalog of business-workflow emails. Each builder returns a fully
 * rendered { subject, html, text }. Adding a notification means adding a builder
 * here first, then calling it from lib/email/notifications.ts — mirrors how
 * lib/webhook-events.ts is the single source for webhook event names.
 *
 * Every template is PII-conservative: we show a merchant their OWN data
 * (amounts, receipts, masked customer phones), never secrets (no API keys,
 * webhook secrets, or credentials are ever placed in an email body).
 */

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

function money(amount: number): string {
  return `KES ${Number(amount).toLocaleString('en-KE')}`;
}

/** Masks a phone the same way lib/logger does, for merchant-facing summaries. */
function maskPhone(phone?: string | null): string {
  if (!phone) return 'N/A';
  if (phone.length >= 10) {
    return phone.substring(0, 4) + '*'.repeat(phone.length - 6) + phone.substring(phone.length - 2);
  }
  return '*'.repeat(phone.length);
}

const dashboard = () => `${appBaseUrl()}/dashboard`;

// ─── Onboarding ──────────────────────────────────────────────────────────────

export function welcomeEmail(businessName: string): RenderedEmail {
  return {
    subject: 'Welcome to PaySwift',
    html: renderEmail({
      preview: 'Your PaySwift account is ready — start accepting M-Pesa payments.',
      // heading is plain text — renderEmail escapes it, so pass the raw name
      // (escaping here would double-encode). bodyHtml is raw, so esc() there.
      heading: `Welcome, ${businessName} 👋`,
      bodyHtml:
        paragraph('Your PaySwift business account is set up and ready in <strong>sandbox</strong> mode. You can send a test M-Pesa STK push right away — no Safaricom account required.') +
        paragraph('To accept real payments, complete KYC verification and request go-live from your dashboard.') +
        paragraph(button('Open your dashboard', dashboard())),
    }),
    text: `Welcome to PaySwift, ${businessName}!\n\nYour account is ready in sandbox mode. Complete KYC and request go-live to accept real payments.\n\n${dashboard()}`,
  };
}

// ─── KYC ─────────────────────────────────────────────────────────────────────

export function kycSubmittedEmail(businessName: string): RenderedEmail {
  return {
    subject: 'We received your KYC documents',
    html: renderEmail({
      preview: 'Your KYC documents are in review.',
      heading: 'KYC documents received',
      bodyHtml:
        paragraph(`Thanks, ${esc(businessName)}. We've received your verification documents and our team is reviewing them.`) +
        paragraph('Reviews typically complete within 1–2 business days. We\'ll email you as soon as there\'s an update.'),
    }),
    text: `Hi ${businessName},\n\nWe've received your KYC documents and our team is reviewing them (usually 1–2 business days). We'll email you when there's an update.`,
  };
}

export function kycApprovedEmail(businessName: string): RenderedEmail {
  return {
    subject: 'Your KYC is approved',
    html: renderEmail({
      preview: 'KYC approved — you can now request go-live.',
      heading: 'KYC approved ✅',
      bodyHtml:
        paragraph(`Good news, ${esc(businessName)} — your identity verification is complete.`) +
        paragraph('You can now add your live Daraja credentials and request go-live approval to start accepting real payments.') +
        paragraph(button('Request go-live', `${appBaseUrl()}/settings`)),
    }),
    text: `Hi ${businessName},\n\nYour KYC is approved. Add your live credentials and request go-live to start accepting real payments: ${appBaseUrl()}/settings`,
  };
}

export function kycRejectedEmail(businessName: string, reason?: string): RenderedEmail {
  const reasonBlock = reason ? paragraph(`<strong>Reason:</strong> ${esc(reason)}`) : '';
  return {
    subject: 'Action needed on your KYC submission',
    html: renderEmail({
      preview: 'Your KYC needs attention.',
      heading: 'KYC needs attention',
      bodyHtml:
        paragraph(`Hi ${esc(businessName)}, we couldn't verify your submission as-is.`) +
        reasonBlock +
        paragraph('Please review the requirements and re-submit your documents from your dashboard.') +
        paragraph(button('Re-submit documents', `${appBaseUrl()}/settings/kyc`)),
    }),
    text: `Hi ${businessName},\n\nWe couldn't verify your KYC submission.${reason ? ` Reason: ${reason}.` : ''} Please re-submit: ${appBaseUrl()}/settings/kyc`,
  };
}

// ─── Go-live ─────────────────────────────────────────────────────────────────

export function goLiveApprovedEmail(businessName: string): RenderedEmail {
  return {
    subject: "You're live on PaySwift 🎉",
    html: renderEmail({
      preview: 'Live mode is enabled — you can now accept real M-Pesa payments.',
      heading: "You're live 🎉",
      bodyHtml:
        paragraph(`Congratulations, ${esc(businessName)}! Your account is approved for <strong>live</strong> mode and can now accept real M-Pesa payments.`) +
        paragraph(button('Go to dashboard', dashboard())),
    }),
    text: `Congratulations ${businessName}! Your account is now live and can accept real M-Pesa payments. ${dashboard()}`,
  };
}

// ─── Payouts / refunds ───────────────────────────────────────────────────────

export function payoutCompletedEmail(p: { businessName: string; amount: number; phone?: string | null; receipt?: string | null }): RenderedEmail {
  return {
    subject: `Payout sent — ${money(p.amount)}`,
    html: renderEmail({
      preview: `Your payout of ${money(p.amount)} was completed.`,
      heading: 'Payout completed',
      bodyHtml:
        paragraph(`A payout from ${esc(p.businessName)} was completed successfully.`) +
        infoTable([
          infoRow('Amount', money(p.amount)),
          infoRow('Recipient', maskPhone(p.phone)),
          infoRow('M-Pesa receipt', p.receipt || 'N/A'),
        ]),
    }),
    text: `Payout completed.\nAmount: ${money(p.amount)}\nRecipient: ${maskPhone(p.phone)}\nReceipt: ${p.receipt || 'N/A'}`,
  };
}

export function payoutFailedEmail(p: { businessName: string; amount: number; phone?: string | null; reason?: string | null }): RenderedEmail {
  return {
    subject: `Payout failed — ${money(p.amount)}`,
    html: renderEmail({
      preview: `A payout of ${money(p.amount)} did not go through.`,
      heading: 'Payout failed',
      bodyHtml:
        paragraph(`A payout from ${esc(p.businessName)} did not complete. No funds left your account.`) +
        infoTable([
          infoRow('Amount', money(p.amount)),
          infoRow('Recipient', maskPhone(p.phone)),
          infoRow('Reason', p.reason || 'Unspecified'),
        ]) +
        paragraph('You can review and retry the payout from your dashboard.'),
    }),
    text: `Payout failed.\nAmount: ${money(p.amount)}\nRecipient: ${maskPhone(p.phone)}\nReason: ${p.reason || 'Unspecified'}\n\nReview: ${dashboard()}`,
  };
}

export function refundCompletedEmail(p: { businessName: string; amount: number; receipt?: string | null }): RenderedEmail {
  return {
    subject: `Refund processed — ${money(p.amount)}`,
    html: renderEmail({
      preview: `A refund of ${money(p.amount)} was processed.`,
      heading: 'Refund processed',
      bodyHtml:
        paragraph(`A refund from ${esc(p.businessName)} was processed successfully.`) +
        infoTable([
          infoRow('Amount', money(p.amount)),
          infoRow('M-Pesa receipt', p.receipt || 'N/A'),
        ]),
    }),
    text: `Refund processed.\nAmount: ${money(p.amount)}\nReceipt: ${p.receipt || 'N/A'}`,
  };
}

// ─── Billing ─────────────────────────────────────────────────────────────────

export function invoiceIssuedEmail(p: { businessName: string; amount: number }): RenderedEmail {
  return {
    subject: `New invoice — ${money(p.amount)}`,
    html: renderEmail({
      preview: `A new invoice of ${money(p.amount)} is available.`,
      heading: 'New invoice',
      bodyHtml:
        paragraph(`Hi ${esc(p.businessName)}, a new invoice for your PaySwift usage has been issued.`) +
        infoTable([infoRow('Amount due', money(p.amount))]) +
        paragraph(button('View billing', `${appBaseUrl()}/billing`)),
    }),
    text: `Hi ${p.businessName},\n\nA new invoice of ${money(p.amount)} has been issued. View: ${appBaseUrl()}/billing`,
  };
}

export function invoicePaidEmail(p: { businessName: string; amount: number }): RenderedEmail {
  return {
    subject: `Payment received — ${money(p.amount)}`,
    html: renderEmail({
      preview: `We received your payment of ${money(p.amount)}.`,
      heading: 'Payment received — thank you',
      bodyHtml:
        paragraph(`Thanks, ${esc(p.businessName)}. We've recorded your invoice payment.`) +
        infoTable([infoRow('Amount paid', money(p.amount))]),
    }),
    text: `Thanks ${p.businessName}, we've recorded your payment of ${money(p.amount)}.`,
  };
}

// ─── Security (events PaySwift owns — NOT Clerk auth) ─────────────────────────

export function apiKeyCreatedEmail(p: { businessName: string; scope: string; keyPrefix: string }): RenderedEmail {
  return {
    subject: 'A new API key was created',
    html: renderEmail({
      preview: 'Security notice: a new API key was created for your account.',
      heading: 'New API key created',
      bodyHtml:
        paragraph(`A new API key was generated for ${esc(p.businessName)}. Any previous key was revoked at the same time.`) +
        infoTable([
          infoRow('Key prefix', p.keyPrefix),
          infoRow('Scope', p.scope),
        ]) +
        paragraph("If this wasn't you, revoke the key and rotate your credentials immediately from your dashboard."),
    }),
    // Never include the full secret key in email — only the non-secret prefix.
    text: `Security notice: a new API key (${p.keyPrefix}…, scope ${p.scope}) was created for ${p.businessName}, and any previous key was revoked. If this wasn't you, rotate immediately: ${appBaseUrl()}/settings`,
  };
}

export function webhookSecretRotatedEmail(businessName: string): RenderedEmail {
  return {
    subject: 'Your webhook signing secret was rotated',
    html: renderEmail({
      preview: 'Security notice: your webhook signing secret changed.',
      heading: 'Webhook secret rotated',
      bodyHtml:
        paragraph(`The webhook signing secret for ${esc(businessName)} was rotated. Update your endpoint with the new secret to keep verifying signatures.`) +
        paragraph("If this wasn't you, review your account security immediately."),
    }),
    text: `Security notice: the webhook signing secret for ${businessName} was rotated. Update your endpoint with the new secret. If this wasn't you, review your account security: ${appBaseUrl()}/settings/webhooks`,
  };
}

// ─── Compliance (Kenya DPA) ──────────────────────────────────────────────────

export function dataExportReadyEmail(businessName: string): RenderedEmail {
  return {
    subject: 'Your data export is ready',
    html: renderEmail({
      preview: 'Your requested data export has been generated.',
      heading: 'Data export generated',
      bodyHtml:
        paragraph(`Hi ${esc(businessName)}, the data export you requested has been generated and downloaded from your dashboard.`) +
        paragraph("If you didn't request this, please review your account security."),
    }),
    text: `Hi ${businessName}, your requested data export has been generated. If you didn't request this, review your account security.`,
  };
}

export function dataDeletionRequestedEmail(businessName: string): RenderedEmail {
  return {
    subject: 'We received your data-deletion request',
    html: renderEmail({
      preview: 'Your data-deletion request is under review.',
      heading: 'Data-deletion request received',
      bodyHtml:
        paragraph(`Hi ${esc(businessName)}, we've received your request to delete your organization's data.`) +
        paragraph('Because of financial record-retention obligations under Kenyan law, deletion is reviewed by our team rather than executed automatically. We\'ll follow up with next steps.'),
    }),
    text: `Hi ${businessName}, we've received your data-deletion request. Due to financial record-retention law, it's reviewed by our team rather than auto-executed. We'll follow up.`,
  };
}

// ─── Internal / platform staff ───────────────────────────────────────────────

export function staffNewKycEmail(p: { businessName: string; documentType: string }): RenderedEmail {
  return {
    subject: `[Review] New KYC from ${p.businessName}`,
    html: renderEmail({
      preview: 'A merchant submitted KYC documents for review.',
      heading: 'New KYC awaiting review',
      bodyHtml:
        paragraph(`<strong>${esc(p.businessName)}</strong> submitted a KYC document (${esc(p.documentType)}) for review.`) +
        paragraph(button('Open review queue', `${appBaseUrl()}/admin/kyc-review`)),
    }),
    text: `${p.businessName} submitted a KYC document (${p.documentType}). Review: ${appBaseUrl()}/admin/kyc-review`,
  };
}

export function staffGoLiveRequestedEmail(businessName: string): RenderedEmail {
  return {
    subject: `[Action] Go-live requested by ${businessName}`,
    html: renderEmail({
      preview: 'A merchant requested go-live approval.',
      heading: 'Go-live requested',
      bodyHtml:
        paragraph(`<strong>${esc(businessName)}</strong> requested go-live approval. Validate their live credentials before approving.`) +
        paragraph(button('Open organization', `${appBaseUrl()}/admin/organizations`)),
    }),
    text: `${businessName} requested go-live approval. Review: ${appBaseUrl()}/admin/organizations`,
  };
}

export function staffReconciliationEmail(p: { count: number }): RenderedEmail {
  return {
    subject: `[Ops] ${p.count} reconciliation mismatch${p.count === 1 ? '' : 'es'} detected`,
    html: renderEmail({
      preview: 'Reconciliation surfaced mismatches for review.',
      heading: 'Reconciliation mismatches detected',
      bodyHtml:
        paragraph(`The nightly ledger reconciliation surfaced <strong>${p.count}</strong> mismatch${p.count === 1 ? '' : 'es'} needing review. Nothing was auto-failed.`) +
        paragraph(button('Open reconciliation', `${appBaseUrl()}/admin/reconciliation`)),
    }),
    text: `Reconciliation surfaced ${p.count} mismatch(es) for review (nothing auto-failed): ${appBaseUrl()}/admin/reconciliation`,
  };
}
