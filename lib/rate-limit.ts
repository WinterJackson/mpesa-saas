import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const isConfigured = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

export const redis = isConfigured ? new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
}) : null;

// Dummy limiter for local development without Redis
const dummyLimiter = {
  limit: async () => ({ success: true, limit: 100, remaining: 99, reset: Date.now() }),
};

export const paymentInitiateRateLimit = isConfigured ? new Ratelimit({
  redis: redis!,
  limiter: Ratelimit.slidingWindow(30, '1 m'), // 30 requests per minute
  analytics: true,
  prefix: '@upstash/ratelimit/paymentInitiate',
}) : dummyLimiter;

export const paymentStatusRateLimit = isConfigured ? new Ratelimit({
  redis: redis!,
  limiter: Ratelimit.slidingWindow(90, '1 m'), // 90 requests per minute
  analytics: true,
  prefix: '@upstash/ratelimit/paymentStatus',
}) : dummyLimiter;

export const callbackRateLimit = isConfigured ? new Ratelimit({
  redis: redis!,
  limiter: Ratelimit.slidingWindow(100, '1 m'), // 100 requests per minute
  analytics: true,
  prefix: '@upstash/ratelimit/callback',
}) : dummyLimiter;

export const generalRateLimit = isConfigured ? new Ratelimit({
  redis: redis!,
  limiter: Ratelimit.slidingWindow(30, '1 m'), // 30 requests per minute
  analytics: true,
  prefix: '@upstash/ratelimit/general',
}) : dummyLimiter;

