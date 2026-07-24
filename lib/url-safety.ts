// SSRF defense-in-depth for merchant-supplied URLs (Phase 4, Stage 8 OWASP
// pass). This is a set-time speed bump, NOT the primary defense — a
// hostname can resolve differently later (DNS rebinding), which is why
// lib/webhook.ts also sets `redirect: 'manual'` on the actual delivery
// fetch. Both layers matter; neither replaces the other.

const BLOCKED_HOSTNAMES = new Set(['localhost', '0.0.0.0', '::1', '[::1]']);

// Private/reserved IPv4 ranges, including the cloud-metadata link-local
// block (169.254.0.0/16 — e.g. AWS/GCP/Azure instance metadata).
const BLOCKED_IPV4_PATTERNS: RegExp[] = [
  /^127\./, // loopback
  /^10\./, // RFC1918
  /^172\.(1[6-9]|2\d|3[01])\./, // RFC1918
  /^192\.168\./, // RFC1918
  /^169\.254\./, // link-local / cloud metadata
];

export function isBlockedWebhookHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(normalized)) return true;
  if (BLOCKED_IPV4_PATTERNS.some((pattern) => pattern.test(normalized))) return true;
  // Any other literal IPv6 address, not just ::1 — merchants should be
  // configuring a real public hostname, not a bracketed IP literal.
  if (normalized.startsWith('[') && normalized.endsWith(']')) return true;
  return false;
}
