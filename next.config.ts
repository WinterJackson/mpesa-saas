import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['@prisma/client'],
  images: {
    qualities: [75, 90],
  },
};

export default withSentryConfig(nextConfig, {
  silent: true,
  org: "payswift",
  project: "mpesa-saas",
});
