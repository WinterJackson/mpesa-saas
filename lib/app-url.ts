/**
 * Resolves the app's public base URL (scheme + host, no trailing slash) for
 * building absolute URLs (Shopify OAuth redirect_uri, auto-registered webhook
 * addresses). Prefers the explicit APP_BASE_URL env var; otherwise derives it
 * from the incoming request's forwarded host/proto headers. Kept tiny and
 * dependency-free so routes and the Shopify lib can share one source of truth.
 */
export function getAppBaseUrl(request: Request): string {
  const explicit = process.env.APP_BASE_URL;
  if (explicit) return explicit.replace(/\/$/, '');

  const url = new URL(request.url);
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto');
  const host = forwardedHost ?? url.host;
  const proto = forwardedProto ?? url.protocol.replace(':', '');
  return `${proto}://${host}`;
}
