/**
 * Pure generators for the copy-paste embed snippets shown per Payment Link in
 * the dashboard. Kept framework-free and side-effect-free so they can be unit
 * tested and reused. Two flavours:
 *
 *  - buttonSnippet:  a zero-JS styled anchor a non-technical merchant can paste
 *                    into any site builder (Wix, Squarespace, a raw HTML block).
 *  - popupSnippet:   the same anchor plus a tiny <script> (public/pay-button.js)
 *                    that opens the hosted checkout in a centered popup so the
 *                    merchant's own page stays open behind it.
 */

const BUTTON_STYLE =
  'display:inline-block;background:#00A651;color:#ffffff;padding:12px 28px;' +
  'border-radius:8px;font-family:system-ui,-apple-system,sans-serif;font-size:16px;' +
  'font-weight:600;text-decoration:none;line-height:1;';

const BUTTON_LABEL = 'Pay with M-Pesa';

export function buttonSnippet(payUrl: string): string {
  return (
    `<a href="${payUrl}" target="_blank" rel="noopener noreferrer"\n` +
    `   style="${BUTTON_STYLE}">${BUTTON_LABEL}</a>`
  );
}

export function popupSnippet(payUrl: string, scriptUrl: string): string {
  return (
    `<a href="${payUrl}" data-payswift-url="${payUrl}" target="_blank" rel="noopener noreferrer"\n` +
    `   style="${BUTTON_STYLE}">${BUTTON_LABEL}</a>\n` +
    `<script src="${scriptUrl}" async></script>`
  );
}
