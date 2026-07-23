import { cookies } from 'next/headers';

/**
 * The dashboard "view" environment — a per-user VIEW FILTER over list pages
 * (transactions, payment links, …), NOT the merchant's operational payment
 * routing. Switching it only changes which records you see; it never moves the
 * merchant between sandbox and live (that is the admin-gated EnvironmentCard).
 * Persisted in a cookie so it survives navigation and server renders.
 */
export const VIEW_ENV_COOKIE = 'payswift_view_env';

export type ViewEnvironment = 'sandbox' | 'live';

/**
 * Resolves the current view environment from the cookie, falling back to the
 * merchant's own operational environment when unset (so a live merchant defaults
 * to seeing live data, a sandbox merchant to sandbox).
 */
export async function getViewEnvironment(fallback: string = 'sandbox'): Promise<ViewEnvironment> {
  const store = await cookies();
  const value = store.get(VIEW_ENV_COOKIE)?.value;
  if (value === 'live' || value === 'sandbox') return value;
  return fallback === 'live' ? 'live' : 'sandbox';
}
