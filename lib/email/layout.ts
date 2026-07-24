/**
 * Shared branded email shell + small building blocks. Every template renders
 * through `renderEmail()` so the header/footer/styles stay consistent.
 *
 * Email HTML is its own dialect: table-free flexbox is unreliable, so we use
 * simple block layout with fully INLINE styles (Gmail strips <style> blocks),
 * conservative web-safe fonts, and a light theme only (email clients don't
 * honor prefers-color-scheme reliably, and a dark shell renders badly on the
 * many clients that force a white background).
 */

const BRAND = '#0f766e'; // teal-700, PaySwift accent
const INK = '#0f172a';
const MUTED = '#64748b';
const BORDER = '#e2e8f0';
const BG = '#f1f5f9';

export function appBaseUrl(): string {
  return process.env.APP_BASE_URL || process.env.MPESA_CALLBACK_URL?.replace(/\/api\/.*$/, '') || 'https://mpesa-saas-two.vercel.app';
}

/** Escapes user-supplied strings before interpolating into email HTML. */
export function esc(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function button(label: string, href: string): string {
  return `<a href="${esc(href)}" style="display:inline-block;background:${BRAND};color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:8px;">${esc(label)}</a>`;
}

/** A label/value definition row for summaries (receipts, security notices). */
export function infoRow(label: string, value: string): string {
  return `<tr><td style="padding:6px 0;color:${MUTED};font-size:14px;">${esc(label)}</td><td style="padding:6px 0;color:${INK};font-size:14px;font-weight:600;text-align:right;">${esc(value)}</td></tr>`;
}

export function infoTable(rows: string[]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:8px 0;">${rows.join('')}</table>`;
}

export interface EmailBody {
  /** Preheader: the grey preview snippet shown in the inbox list. */
  preview: string;
  heading: string;
  /** Pre-rendered HTML paragraphs/blocks for the body. */
  bodyHtml: string;
}

/** Wraps template content in the branded shell. */
export function renderEmail({ preview, heading, bodyHtml }: EmailBody): string {
  const year = new Date().getFullYear();
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${esc(heading)}</title>
</head>
<body style="margin:0;padding:0;background:${BG};">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preview)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid ${BORDER};border-radius:14px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<tr><td style="padding:22px 28px;border-bottom:1px solid ${BORDER};">
<span style="font-size:18px;font-weight:700;color:${BRAND};letter-spacing:-0.01em;">PaySwift</span>
</td></tr>
<tr><td style="padding:28px;">
<h1 style="margin:0 0 14px;font-size:20px;line-height:1.3;color:${INK};">${esc(heading)}</h1>
<div style="font-size:15px;line-height:1.6;color:${INK};">${bodyHtml}</div>
</td></tr>
<tr><td style="padding:20px 28px;border-top:1px solid ${BORDER};">
<p style="margin:0;font-size:12px;line-height:1.5;color:${MUTED};">
This is an automated notification from PaySwift about activity on your account.
Manage notifications and security settings in your
<a href="${esc(appBaseUrl())}/settings" style="color:${BRAND};text-decoration:none;">dashboard</a>.
</p>
<p style="margin:10px 0 0;font-size:12px;color:${MUTED};">&copy; ${year} PaySwift &middot; Nairobi, Kenya</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export function paragraph(text: string): string {
  return `<p style="margin:0 0 14px;">${text}</p>`;
}
