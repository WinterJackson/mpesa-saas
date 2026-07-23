import { clerkMiddleware } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { paymentInitiateRateLimit, paymentStatusRateLimit, callbackRateLimit, generalRateLimit } from '@/lib/rate-limit';

/**
 * Proxy (Middleware) for M-Pesa SaaS Platform
 *
 * Next.js 16 renamed middleware.ts → proxy.ts.
 * Clerk v7 deprecated createRouteMatcher() — we use native pathname checks instead.
 *
 * Responsibilities:
 * 1. Initialize Clerk auth state for every request (via clerkMiddleware)
 * 2. Redirect authenticated-but-not-onboarded users to /onboarding
 * 3. Redirect already-onboarded users away from /onboarding to /dashboard
 *
 * Route protection is NOT done here per Clerk v7 best practices.
 * Instead, each route handler / server component calls auth() or auth.protect()
 * to enforce access control close to the resource.
 */
export default clerkMiddleware(async (auth, req) => {
  const { userId, sessionClaims } = await auth();
  const pathname = req.nextUrl.pathname;

  // Rate Limiting for all /api/* routes
  if (pathname.startsWith('/api/')) {
    const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? '127.0.0.1';
    let limitResult;
    
    const xApiKey = req.headers.get('x-api-key');
    const authHeader = req.headers.get('authorization');
    
    let apiIdentifier = ip;
    if (xApiKey) {
      apiIdentifier = `key_${xApiKey.substring(0, 12)}`;
    } else if (authHeader?.startsWith('Bearer ')) {
      apiIdentifier = `bearer_${authHeader.substring(7, 19)}`;
    }
    
    if (
      pathname.startsWith('/api/v1/payments/initiate') ||
      pathname.startsWith('/api/v1/payouts') ||
      pathname.startsWith('/api/v1/refunds')
    ) {
      // Money-movement endpoints share the tightest limit.
      limitResult = await paymentInitiateRateLimit.limit(apiIdentifier);
    } else if (pathname.startsWith('/api/v1/payments/status')) {
      limitResult = await paymentStatusRateLimit.limit(apiIdentifier);
    } else if (
      pathname.startsWith('/api/mpesa/') ||
      pathname.startsWith('/api/integrations/') ||
      pathname.startsWith('/api/pay/')
    ) {
      // Safaricom-originated callbacks (STK, B2C, C2B, reversal, balance, status)
      // AND the public hosted-checkout endpoints (/api/pay/*): both are keyed by
      // IP since they carry no API key / user session.
      limitResult = await callbackRateLimit.limit(ip);
    } else {
      limitResult = await generalRateLimit.limit(userId ?? ip);
    }

    if (!limitResult.success) {
      return NextResponse.json({ success: false, error: 'Too many requests. Please slow down.' }, { status: 429 });
    }
  }

  // Skip onboarding logic for public routes, API routes, static assets, and
  // the admin console — admins are platform-level (AdminUser table) and are
  // never expected to have a Merchant/Organization of their own, so the
  // merchant-onboarding gate below must not apply to /admin at all. Auth and
  // role enforcement for /admin is handled by app/admin/layout.tsx via
  // lib/admin-auth.ts's requireAdmin(), not here.
  if (
    pathname === '/' ||
    pathname.startsWith('/sign-in') ||
    pathname.startsWith('/sign-up') ||
    pathname.startsWith('/demo-store') ||
    pathname.startsWith('/pay/') ||
    pathname.startsWith('/legal') ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/__clerk') ||
    pathname.startsWith('/admin')
  ) {
    return NextResponse.next();
  }

  // Only enforce onboarding flow for authenticated users
  if (userId) {
    // Read the onboarded flag from Clerk session claims (publicMetadata).
    // This requires the Clerk Dashboard Session Token to include:
    //   { "publicMetadata": "{{user.public_metadata}}" }
    const onboarded = (sessionClaims?.publicMetadata as { onboarded?: boolean } | undefined)
      ?.onboarded;
    const justOnboarded = req.cookies.get('payswift_just_onboarded');

    // Authenticated + NOT onboarded + NOT on /onboarding → redirect to onboarding
    if (!onboarded && !justOnboarded && pathname !== '/onboarding') {
      return NextResponse.redirect(new URL('/onboarding', req.url));
    }

    // Authenticated + ALREADY onboarded + ON /onboarding → redirect to dashboard
    if (onboarded && pathname === '/onboarding') {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
    // Always run for Clerk-specific frontend API routes
    '/__clerk/(.*)',
  ],
};
