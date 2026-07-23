'use server';

import { cookies } from 'next/headers';
import { VIEW_ENV_COOKIE, type ViewEnvironment } from '@/lib/view-env';

/**
 * Server action that persists the dashboard view-environment filter in a cookie.
 * Used by the header toggle instead of a client-side document.cookie write, so
 * the value is set on the server and the subsequent router.refresh() re-renders
 * server components with the new filter.
 */
export async function setViewEnvironment(env: ViewEnvironment): Promise<void> {
  const store = await cookies();
  store.set(VIEW_ENV_COOKIE, env, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });
}
