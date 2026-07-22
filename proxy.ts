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
    
    if (pathname.startsWith('/api/v1/payments/initiate')) {
      limitResult = await paymentInitiateRateLimit.limit(apiIdentifier);
    } else if (pathname.startsWith('/api/v1/payments/status')) {
      limitResult = await paymentStatusRateLimit.limit(apiIdentifier);
    } else if (pathname.startsWith('/api/mpesa/callback') || pathname.startsWith('/api/integrations/')) {
      limitResult = await callbackRateLimit.limit(ip);
    } else {
      limitResult = await generalRateLimit.limit(userId ?? ip);
    }

    if (!limitResult.success) {
      return NextResponse.json({ success: false, error: 'Too many requests. Please slow down.' }, { status: 429 });
    }
  }

  // Skip onboarding logic for public routes, API routes, and static assets
  if (
    pathname === '/' ||
    pathname.startsWith('/sign-in') ||
    pathname.startsWith('/sign-up') ||
    pathname.startsWith('/demo-store') ||
    pathname.startsWith('/legal') ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/__clerk')
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
