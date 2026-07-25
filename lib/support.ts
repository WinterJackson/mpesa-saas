/**
 * Central support-contact configuration. Read once here so the floating widget,
 * the merchant Support page, and the admin console all show the same channels.
 * Values are overridable per-deploy via NEXT_PUBLIC_* env (safe to expose — a
 * public WhatsApp number and support inbox are meant to be seen).
 */

/** Digits-only E.164 WhatsApp number (no "+"), used to build wa.me links. */
export const SUPPORT_WHATSAPP_NUMBER =
  process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP?.replace(/\D/g, "") || "254700000000";

/** Human-friendly display form of the same number. */
export const SUPPORT_WHATSAPP_DISPLAY =
  process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP_DISPLAY ||
  `+${SUPPORT_WHATSAPP_NUMBER.replace(/^(\d{3})(\d{3})(\d{3})(\d+)$/, "$1 $2 $3 $4")}`;

export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@payswift.co.ke";

const DEFAULT_WHATSAPP_MESSAGE = "Hi PaySwift support, I need help with";

/** Builds a wa.me deep-link with an optional pre-filled message. */
export function whatsappUrl(message: string = DEFAULT_WHATSAPP_MESSAGE): string {
  return `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}
